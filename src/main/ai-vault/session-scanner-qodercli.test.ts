import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanAiVaultSessions } from './session-scanner'
import { isolatedScanRoots, writeJsonlFile } from './session-scanner-test-fixtures'

let tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })))
  tempRoots = []
})

// qodercli is a Claude Code fork with a byte-compatible transcript store split
// across a global (`~/.qoder`) and CN (`~/.qoder-cn`) install; Orca scans both
// as one agent.
describe('scanAiVaultSessions qodercli discovery', () => {
  it('indexes Qoder CLI transcripts from both install roots and prunes subagent transcripts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-ai-vault-qodercli-'))
    tempRoots.push(root)
    const roots = isolatedScanRoots(root)
    const [globalRoot, cnRoot] = roots.qoderProjectsDirs
    const sessionId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    const projectDir = join(globalRoot, '-Users-ada-repo')

    await writeJsonlFile(join(projectDir, `${sessionId}.jsonl`), [
      {
        type: 'user',
        sessionId,
        timestamp: '2026-05-01T10:00:00.000Z',
        cwd: '/Users/ada/repo',
        gitBranch: 'feature/qoder',
        isMeta: false,
        message: { role: 'user', content: 'Wire up the vault' }
      },
      {
        type: 'assistant',
        sessionId,
        timestamp: '2026-05-01T10:01:00.000Z',
        cwd: '/Users/ada/repo',
        message: { model: 'qoder-model', usage: { input_tokens: 100, output_tokens: 40 } }
      }
    ])
    // Task subagent transcripts share the parent sessionId; listed as top-level
    // rows they'd duplicate the parent, so the subtree must be pruned.
    await writeJsonlFile(join(projectDir, sessionId, 'subagents', 'agent-abc.jsonl'), [
      {
        type: 'user',
        sessionId,
        timestamp: '2026-05-01T10:00:30.000Z',
        message: { role: 'user', content: 'subagent task' }
      }
    ])
    // The CN build's separate store is the same agent; assistant-only so the
    // title falls back to the agent label.
    const cnSessionId = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
    await writeJsonlFile(join(cnRoot, '-Users-ada-repo', `${cnSessionId}.jsonl`), [
      {
        type: 'assistant',
        sessionId: cnSessionId,
        timestamp: '2026-05-01T11:00:00.000Z',
        cwd: '/Users/ada/repo',
        message: { model: 'qoder-model', content: 'CN build answer' }
      }
    ])

    const result = await scanAiVaultSessions({ ...roots, platform: 'darwin' })

    expect(result.issues).toEqual([])
    expect(result.sessions).toHaveLength(2)
    expect(result.sessions.every((session) => session.agent === 'qodercli')).toBe(true)
    expect(result.sessions.find((session) => session.sessionId === sessionId)).toMatchObject({
      title: 'Wire up the vault',
      cwd: '/Users/ada/repo',
      branch: 'feature/qoder',
      model: 'qoder-model',
      messageCount: 2,
      totalTokens: 140,
      subagentTranscriptCount: 1,
      resumeCommand: `cd '/Users/ada/repo' && qodercli --resume '${sessionId}'`
    })
    expect(result.sessions.find((session) => session.sessionId === cnSessionId)?.title).toBe(
      `Qoder CLI ${cnSessionId.slice(0, 8)}`
    )
  })
})
