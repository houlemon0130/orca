import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanClaudeUsageFiles } from '../claude-usage/scanner'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function makeQoderRoots(): Promise<{ globalRoot: string; cnRoot: string }> {
  const root = await mkdtemp(join(tmpdir(), 'orca-qodercli-usage-'))
  tempRoots.push(root)
  const globalRoot = join(root, '.qoder', 'projects')
  const cnRoot = join(root, '.qoder-cn', 'projects')
  await mkdir(join(globalRoot, '-Users-ada-repo'), { recursive: true })
  return { globalRoot, cnRoot }
}

function qoderAssistantRecord(args: {
  sessionId: string
  timestamp: string
  messageId: string
  credits?: number
}): string {
  // Real qodercli 1.1.17 shape: zeroed token counts, credits inside usage.
  return JSON.stringify({
    type: 'assistant',
    uuid: `uuid-${args.messageId}`,
    sessionId: args.sessionId,
    timestamp: args.timestamp,
    cwd: '/workspace/repo-a',
    message: {
      id: args.messageId,
      model: 'ultimate',
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        ...(args.credits !== undefined ? { credits: args.credits } : {})
      }
    }
  })
}

describe('qodercli usage scan (claude scanner with qoder options)', () => {
  it('keeps zero-token turns and aggregates credits across both roots', async () => {
    const { globalRoot, cnRoot } = await makeQoderRoots()
    await mkdir(join(cnRoot, '-Users-ada-repo'), { recursive: true })

    await writeFile(
      join(globalRoot, '-Users-ada-repo', 's1.jsonl'),
      [
        JSON.stringify({ type: 'workspace-directories', sessionId: 's1', directories: ['/x'] }),
        qoderAssistantRecord({
          sessionId: 's1',
          timestamp: '2026-08-01T10:00:00.000Z',
          messageId: 'm1',
          credits: 5.5
        }),
        // A streamed repeat of m1 must dedupe, not double-count credits.
        qoderAssistantRecord({
          sessionId: 's1',
          timestamp: '2026-08-01T10:00:01.000Z',
          messageId: 'm1',
          credits: 5.5
        }),
        qoderAssistantRecord({
          sessionId: 's1',
          timestamp: '2026-08-01T10:05:00.000Z',
          messageId: 'm2'
        })
      ].join('\n')
    )
    await writeFile(
      join(cnRoot, '-Users-ada-repo', 's2.jsonl'),
      qoderAssistantRecord({
        sessionId: 's2',
        timestamp: '2026-08-02T09:00:00.000Z',
        messageId: 'm3',
        credits: 2.25
      })
    )

    const result = await scanClaudeUsageFiles([], [], {
      roots: [globalRoot, cnRoot],
      acceptZeroTokenTurns: true
    })

    expect(result.sessions).toHaveLength(2)
    const s1 = result.sessions.find((session) => session.sessionId === 's1')
    expect(s1).toMatchObject({ turnCount: 2, totalCredits: 5.5, totalInputTokens: 0 })
    const s2 = result.sessions.find((session) => session.sessionId === 's2')
    expect(s2).toMatchObject({ turnCount: 1, totalCredits: 2.25 })
    const totalDailyCredits = result.dailyAggregates.reduce(
      (sum, entry) => sum + (entry.credits ?? 0),
      0
    )
    expect(totalDailyCredits).toBeCloseTo(7.75)
  })

  it('drops zero-token turns without the acceptance flag (Claude behavior unchanged)', async () => {
    const { globalRoot } = await makeQoderRoots()
    await writeFile(
      join(globalRoot, '-Users-ada-repo', 's3.jsonl'),
      qoderAssistantRecord({
        sessionId: 's3',
        timestamp: '2026-08-03T10:00:00.000Z',
        messageId: 'm4',
        credits: 1
      })
    )

    const result = await scanClaudeUsageFiles([], [], { roots: [globalRoot] })
    expect(result.sessions).toHaveLength(0)
  })

  it('skips a missing CN root safely', async () => {
    const { globalRoot, cnRoot } = await makeQoderRoots()
    await writeFile(
      join(globalRoot, '-Users-ada-repo', 's4.jsonl'),
      qoderAssistantRecord({
        sessionId: 's4',
        timestamp: '2026-08-04T10:00:00.000Z',
        messageId: 'm5',
        credits: 3
      })
    )

    const result = await scanClaudeUsageFiles([], [], {
      roots: [globalRoot, cnRoot],
      acceptZeroTokenTurns: true
    })
    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]).toMatchObject({ sessionId: 's4', totalCredits: 3 })
  })
})
