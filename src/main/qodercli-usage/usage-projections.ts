import type {
  QoderCliUsageBreakdownKind,
  QoderCliUsageBreakdownRow,
  QoderCliUsageDailyPoint,
  QoderCliUsageRange,
  QoderCliUsageScope,
  QoderCliUsageSessionRow,
  QoderCliUsageSummary
} from '../../shared/qodercli-usage-types'
import type { ClaudeUsageDailyAggregate, ClaudeUsageSession } from '../claude-usage/types'
import { getSessionProjectLabel } from '../claude-usage/scanner'

function getRangeCutoff(range: QoderCliUsageRange): string | null {
  if (range === 'all') {
    return null
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  now.setDate(now.getDate() - (days - 1))
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocalDay(timestamp: string): string | null {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function filterQoderCliDaily(
  dailyAggregates: readonly ClaudeUsageDailyAggregate[],
  scope: QoderCliUsageScope,
  range: QoderCliUsageRange
): ClaudeUsageDailyAggregate[] {
  const cutoff = getRangeCutoff(range)
  return dailyAggregates.filter((entry) => {
    if (cutoff && entry.day < cutoff) {
      return false
    }
    if (scope === 'orca' && entry.worktreeId === null) {
      return false
    }
    return true
  })
}

export function filterQoderCliSessions(
  sessions: readonly ClaudeUsageSession[],
  scope: QoderCliUsageScope,
  range: QoderCliUsageRange
): ClaudeUsageSession[] {
  const cutoff = getRangeCutoff(range)
  return sessions.filter((session) => {
    // Why: daily aggregates use local calendar days, so session filtering has
    // to use the same conversion or the sessions table/counts can disagree
    // with the chart around UTC day boundaries.
    const day = getLocalDay(session.lastTimestamp)
    if (!day) {
      return false
    }
    if (cutoff && day < cutoff) {
      return false
    }
    if (scope === 'orca') {
      return session.locationBreakdown.some((entry) => entry.worktreeId !== null)
    }
    return true
  })
}

export function buildQoderCliSummary(
  filteredDaily: readonly ClaudeUsageDailyAggregate[],
  filteredSessions: readonly ClaudeUsageSession[],
  scope: QoderCliUsageScope,
  range: QoderCliUsageRange
): QoderCliUsageSummary {
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  let turns = 0
  let credits = 0
  const byModel = new Map<string, number>()
  const byProject = new Map<string, number>()

  for (const row of filteredDaily) {
    inputTokens += row.inputTokens
    outputTokens += row.outputTokens
    cacheReadTokens += row.cacheReadTokens
    cacheWriteTokens += row.cacheWriteTokens
    turns += row.turnCount
    credits += row.credits ?? 0
    // Why turns (not tokens) rank models/projects: token counts are zeroed on
    // current CLIs, so token-weighted ranking would always report null tops.
    const modelKey = row.model ?? 'Unknown model'
    byModel.set(modelKey, (byModel.get(modelKey) ?? 0) + row.turnCount)
    byProject.set(row.projectLabel, (byProject.get(row.projectLabel) ?? 0) + row.turnCount)
  }

  const topModel = [...byModel.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
  const topProject =
    [...byProject.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null

  return {
    scope,
    range,
    sessions: filteredSessions.length,
    turns,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    credits,
    topModel,
    topProject,
    hasAnyQoderCliData: filteredSessions.length > 0 || filteredDaily.length > 0
  }
}

export function buildQoderCliDaily(
  filteredDaily: readonly ClaudeUsageDailyAggregate[]
): QoderCliUsageDailyPoint[] {
  const byDay = new Map<string, QoderCliUsageDailyPoint>()
  for (const row of filteredDaily) {
    const existing = byDay.get(row.day) ?? {
      day: row.day,
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      credits: 0
    }
    existing.turns += row.turnCount
    existing.inputTokens += row.inputTokens
    existing.outputTokens += row.outputTokens
    existing.cacheReadTokens += row.cacheReadTokens
    existing.cacheWriteTokens += row.cacheWriteTokens
    existing.credits += row.credits ?? 0
    byDay.set(row.day, existing)
  }
  return [...byDay.values()].sort((left, right) => left.day.localeCompare(right.day))
}

export function buildQoderCliBreakdown(
  filteredDaily: readonly ClaudeUsageDailyAggregate[],
  filteredSessions: readonly ClaudeUsageSession[],
  scope: QoderCliUsageScope,
  kind: QoderCliUsageBreakdownKind
): QoderCliUsageBreakdownRow[] {
  const rows = new Map<string, QoderCliUsageBreakdownRow>()

  for (const daily of filteredDaily) {
    const key = kind === 'model' ? (daily.model ?? 'unknown') : daily.projectKey
    const label = kind === 'model' ? (daily.model ?? 'Unknown model') : daily.projectLabel
    const existing = rows.get(key) ?? {
      key,
      label,
      sessions: 0,
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      credits: 0
    }
    existing.turns += daily.turnCount
    existing.inputTokens += daily.inputTokens
    existing.outputTokens += daily.outputTokens
    existing.cacheReadTokens += daily.cacheReadTokens
    existing.cacheWriteTokens += daily.cacheWriteTokens
    existing.credits += daily.credits ?? 0
    rows.set(key, existing)
  }

  for (const session of filteredSessions) {
    if (kind === 'model') {
      const key = session.model ?? 'unknown'
      const row = rows.get(key)
      if (row) {
        row.sessions++
      }
      continue
    }
    const matchingLocations = session.locationBreakdown.filter((entry) =>
      scope === 'all' ? true : entry.worktreeId !== null
    )
    const seen = new Set<string>()
    for (const location of matchingLocations) {
      if (seen.has(location.locationKey)) {
        continue
      }
      seen.add(location.locationKey)
      const row = rows.get(location.locationKey)
      if (row) {
        row.sessions++
      }
    }
  }

  // Why turn-ranked: token totals are zero on current CLIs (see summary).
  return [...rows.values()].sort((left, right) => right.turns - left.turns)
}

export function buildQoderCliRecentSessions(
  filteredSessions: readonly ClaudeUsageSession[],
  scope: QoderCliUsageScope,
  limit: number
): QoderCliUsageSessionRow[] {
  return filteredSessions.slice(0, limit).map((session) => {
    const matchingLocations = session.locationBreakdown.filter((entry) =>
      scope === 'all' ? true : entry.worktreeId !== null
    )
    const scopedLocations =
      matchingLocations.length > 0 ? matchingLocations : session.locationBreakdown
    const totals = scopedLocations.reduce(
      (acc, entry) => {
        acc.turns += entry.turnCount
        acc.inputTokens += entry.inputTokens
        acc.outputTokens += entry.outputTokens
        acc.cacheReadTokens += entry.cacheReadTokens
        acc.cacheWriteTokens += entry.cacheWriteTokens
        acc.credits += entry.credits ?? 0
        return acc
      },
      {
        turns: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        credits: 0
      }
    )
    const durationMinutes = Math.max(
      0,
      Math.round(
        (new Date(session.lastTimestamp).getTime() - new Date(session.firstTimestamp).getTime()) /
          60_000
      )
    )
    return {
      sessionId: session.sessionId,
      lastActiveAt: session.lastTimestamp,
      durationMinutes,
      projectLabel: getSessionProjectLabel([...scopedLocations]),
      branch: session.lastGitBranch,
      model: session.model,
      turns: totals.turns,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheReadTokens: totals.cacheReadTokens,
      cacheWriteTokens: totals.cacheWriteTokens,
      credits: totals.credits
    }
  })
}
