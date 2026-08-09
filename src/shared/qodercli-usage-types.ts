export type QoderCliUsageScope = 'orca' | 'all'
export type QoderCliUsageRange = '7d' | '30d' | '90d' | 'all'
export type QoderCliUsageBreakdownKind = 'model' | 'project'

export type QoderCliUsageScanState = {
  enabled: boolean
  isScanning: boolean
  lastScanStartedAt: number | null
  lastScanCompletedAt: number | null
  lastScanError: string | null
  hasAnyQoderCliData: boolean
}

// Why credits instead of estimatedCostUsd: qodercli bills in provider credits
// (`message.usage.credits`); its model ids are gateway aliases with no public
// USD pricing, so a dollar estimate would be fiction. Token fields are reported
// as written — current CLIs zero them, so turn/session/credit counts carry the
// real signal until the CLI populates tokens.
export type QoderCliUsageSummary = {
  scope: QoderCliUsageScope
  range: QoderCliUsageRange
  sessions: number
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  credits: number
  topModel: string | null
  topProject: string | null
  hasAnyQoderCliData: boolean
}

export type QoderCliUsageDailyPoint = {
  day: string
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  credits: number
}

export type QoderCliUsageBreakdownRow = {
  key: string
  label: string
  sessions: number
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  credits: number
}

export type QoderCliUsageSessionRow = {
  sessionId: string
  lastActiveAt: string
  durationMinutes: number
  projectLabel: string
  branch: string | null
  model: string | null
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  credits: number
}

export type QoderCliUsageSnapshot = {
  scanState: QoderCliUsageScanState
  summary: QoderCliUsageSummary
  daily: QoderCliUsageDailyPoint[]
  modelBreakdown: QoderCliUsageBreakdownRow[]
  projectBreakdown: QoderCliUsageBreakdownRow[]
  recentSessions: QoderCliUsageSessionRow[]
}
