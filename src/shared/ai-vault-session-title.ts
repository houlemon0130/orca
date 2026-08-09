import type { AiVaultAgent } from './ai-vault-types'

export type AiVaultSessionTitle = {
  agent: Extract<AiVaultAgent, 'claude' | 'qodercli' | 'codex'>
  sessionId: string
  title: string
}

export function isAiVaultTitleAgent(
  agent: string | null | undefined
): agent is AiVaultSessionTitle['agent'] {
  return agent === 'claude' || agent === 'qodercli' || agent === 'codex'
}
