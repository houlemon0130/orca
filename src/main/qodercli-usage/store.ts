import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { UsageCacheSnapshotWriter } from '../usage-cache-snapshot-writer'
import type {
  QoderCliUsageBreakdownKind,
  QoderCliUsageBreakdownRow,
  QoderCliUsageDailyPoint,
  QoderCliUsageRange,
  QoderCliUsageScanState,
  QoderCliUsageScope,
  QoderCliUsageSessionRow,
  QoderCliUsageSnapshot,
  QoderCliUsageSummary
} from '../../shared/qodercli-usage-types'
import type { Store } from '../persistence'
import { loadKnownUsageWorktreesByRepo, type UsageWorktreeRef } from '../usage-worktree-metadata'
import type { ClaudeUsagePersistedState } from '../claude-usage/types'
import { createWorktreeRefs } from '../usage/usage-worktree-refs'
import { scanClaudeUsageFiles } from '../claude-usage/scanner'
import {
  buildQoderCliBreakdown,
  buildQoderCliDaily,
  buildQoderCliRecentSessions,
  buildQoderCliSummary,
  filterQoderCliDaily,
  filterQoderCliSessions
} from './usage-projections'

const SCHEMA_VERSION = 1
const STALE_MS = 5 * 60_000

// Why: capture the path after configureDevUserDataPath() but before app.setName()
// mutates Electron's derived userData location, matching the persistence/store pattern.
let _qoderCliUsageFile: string | null = null

// Why: qodercli writes the Claude transcript layout under its own roots — the
// global build's `~/.qoder` and the CN build's `~/.qoder-cn`. Computed per call
// so the scan tracks the live home (SSH remotes resolve their own).
function qoderCliTranscriptRoots(): string[] {
  return [join(homedir(), '.qoder', 'projects'), join(homedir(), '.qoder-cn', 'projects')]
}

function getDefaultState(): ClaudeUsagePersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    worktreeFingerprint: null,
    processedFiles: [],
    sessions: [],
    dailyAggregates: [],
    scanState: {
      enabled: false,
      lastScanStartedAt: null,
      lastScanCompletedAt: null,
      lastScanError: null
    }
  }
}

export function initQoderCliUsagePath(): void {
  _qoderCliUsageFile = join(app.getPath('userData'), 'orca-qodercli-usage.json')
}

function getQoderCliUsageFile(): string {
  if (!_qoderCliUsageFile) {
    _qoderCliUsageFile = join(app.getPath('userData'), 'orca-qodercli-usage.json')
  }
  return _qoderCliUsageFile
}

function getWorktreeFingerprint(worktreesByRepo: Map<string, UsageWorktreeRef[]>): string {
  const rows = [...worktreesByRepo.entries()]
    .flatMap(([repoId, worktrees]) =>
      worktrees.map((worktree) =>
        JSON.stringify({
          repoId,
          worktreeId: worktree.worktreeId,
          path: worktree.path,
          displayName: worktree.displayName
        })
      )
    )
    .sort()
  return JSON.stringify(rows)
}

export class QoderCliUsageStore {
  private state: ClaudeUsagePersistedState
  private readonly store: Store
  private scanPromise: Promise<void> | null = null
  private readonly writer = new UsageCacheSnapshotWriter('[qodercli-usage]', getQoderCliUsageFile)

  constructor(store: Store) {
    this.store = store
    this.state = this.load()
  }

  private load(): ClaudeUsagePersistedState {
    try {
      const usageFile = getQoderCliUsageFile()
      if (!existsSync(usageFile)) {
        return getDefaultState()
      }
      const parsed = JSON.parse(readFileSync(usageFile, 'utf-8')) as ClaudeUsagePersistedState
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        const defaults = getDefaultState()
        return {
          ...defaults,
          scanState: {
            ...defaults.scanState,
            enabled: parsed.scanState?.enabled ?? defaults.scanState.enabled
          }
        }
      }
      return {
        ...getDefaultState(),
        ...parsed,
        scanState: {
          ...getDefaultState().scanState,
          ...parsed.scanState
        }
      }
    } catch (error) {
      console.error('[qodercli-usage] Failed to load persisted state, starting fresh:', error)
      return getDefaultState()
    }
  }

  private writeToDisk(): Promise<void> {
    return this.writer.write(() => JSON.stringify(this.state, null, 2))
  }

  /** Await queued cache writes so quit does not drop the final snapshot. */
  flush(): Promise<void> {
    return this.writer.flush()
  }

  async setEnabled(enabled: boolean): Promise<QoderCliUsageScanState> {
    this.state.scanState.enabled = enabled
    await this.writeToDisk()
    return this.getScanState()
  }

  getScanState(): QoderCliUsageScanState {
    return {
      ...this.state.scanState,
      isScanning: this.scanPromise !== null,
      hasAnyQoderCliData: this.state.sessions.length > 0 || this.state.dailyAggregates.length > 0
    }
  }

  getSnapshot(
    scope: QoderCliUsageScope,
    range: QoderCliUsageRange,
    recentSessionLimit = 10
  ): QoderCliUsageSnapshot {
    return {
      scanState: this.getScanState(),
      summary: this.buildSummary(scope, range),
      daily: this.buildDaily(scope, range),
      modelBreakdown: this.buildBreakdown(scope, range, 'model'),
      projectBreakdown: this.buildBreakdown(scope, range, 'project'),
      recentSessions: this.buildRecentSessions(scope, range, recentSessionLimit)
    }
  }

  async refresh(force = false): Promise<QoderCliUsageScanState> {
    if (!this.state.scanState.enabled) {
      return this.getScanState()
    }
    const currentWorktreeFingerprint = await this.getCurrentWorktreeFingerprint()
    if (!force && this.state.scanState.lastScanCompletedAt) {
      const ageMs = Date.now() - this.state.scanState.lastScanCompletedAt
      if (ageMs < STALE_MS && this.state.worktreeFingerprint === currentWorktreeFingerprint) {
        return this.getScanState()
      }
    }
    await this.runScan()
    return this.getScanState()
  }

  private async runScan(): Promise<void> {
    if (this.scanPromise) {
      await this.scanPromise
      return
    }

    this.state.scanState.lastScanStartedAt = Date.now()
    this.state.scanState.lastScanError = null

    // Why: assign scanPromise before any await so concurrent refresh shares one scan.
    this.scanPromise = (async () => {
      try {
        const repos = this.store.getRepos()
        const worktreesByRepo = loadKnownUsageWorktreesByRepo(this.store, repos)
        const worktreeFingerprint = getWorktreeFingerprint(worktreesByRepo)
        const result = await scanClaudeUsageFiles(
          createWorktreeRefs(repos, worktreesByRepo),
          this.state.worktreeFingerprint === worktreeFingerprint ? this.state.processedFiles : [],
          // Why: qodercli zeroes token counts but reports credits, so zero-token
          // turns are real billed turns and must be kept.
          { roots: qoderCliTranscriptRoots(), acceptZeroTokenTurns: true }
        )
        this.state.processedFiles = result.processedFiles
        this.state.sessions = result.sessions
        this.state.dailyAggregates = result.dailyAggregates
        this.state.worktreeFingerprint = worktreeFingerprint
        this.state.scanState.lastScanCompletedAt = Date.now()
        this.state.scanState.lastScanError = null
        await this.writeToDisk().catch(() => {})
      } catch (error) {
        this.state.scanState.lastScanError = error instanceof Error ? error.message : String(error)
        await this.writeToDisk().catch(() => {})
      } finally {
        this.scanPromise = null
      }
    })()

    await this.scanPromise
  }

  async getSummary(
    scope: QoderCliUsageScope,
    range: QoderCliUsageRange
  ): Promise<QoderCliUsageSummary> {
    await this.refresh(false)
    return this.buildSummary(scope, range)
  }

  private buildSummary(scope: QoderCliUsageScope, range: QoderCliUsageRange): QoderCliUsageSummary {
    return buildQoderCliSummary(
      filterQoderCliDaily(this.state.dailyAggregates, scope, range),
      filterQoderCliSessions(this.state.sessions, scope, range),
      scope,
      range
    )
  }

  async getDaily(
    scope: QoderCliUsageScope,
    range: QoderCliUsageRange
  ): Promise<QoderCliUsageDailyPoint[]> {
    await this.refresh(false)
    return this.buildDaily(scope, range)
  }

  private buildDaily(
    scope: QoderCliUsageScope,
    range: QoderCliUsageRange
  ): QoderCliUsageDailyPoint[] {
    return buildQoderCliDaily(filterQoderCliDaily(this.state.dailyAggregates, scope, range))
  }

  async getBreakdown(
    scope: QoderCliUsageScope,
    range: QoderCliUsageRange,
    kind: QoderCliUsageBreakdownKind
  ): Promise<QoderCliUsageBreakdownRow[]> {
    await this.refresh(false)
    return this.buildBreakdown(scope, range, kind)
  }

  private buildBreakdown(
    scope: QoderCliUsageScope,
    range: QoderCliUsageRange,
    kind: QoderCliUsageBreakdownKind
  ): QoderCliUsageBreakdownRow[] {
    return buildQoderCliBreakdown(
      filterQoderCliDaily(this.state.dailyAggregates, scope, range),
      filterQoderCliSessions(this.state.sessions, scope, range),
      scope,
      kind
    )
  }

  async getRecentSessions(
    scope: QoderCliUsageScope,
    range: QoderCliUsageRange,
    limit = 12
  ): Promise<QoderCliUsageSessionRow[]> {
    await this.refresh(false)
    return this.buildRecentSessions(scope, range, limit)
  }

  private buildRecentSessions(
    scope: QoderCliUsageScope,
    range: QoderCliUsageRange,
    limit = 12
  ): QoderCliUsageSessionRow[] {
    return buildQoderCliRecentSessions(
      filterQoderCliSessions(this.state.sessions, scope, range),
      scope,
      limit
    )
  }

  private async getCurrentWorktreeFingerprint(): Promise<string> {
    const repos = this.store.getRepos()
    const worktreesByRepo = loadKnownUsageWorktreesByRepo(this.store, repos)
    return getWorktreeFingerprint(worktreesByRepo)
  }
}
