import type {
  QoderCliUsageBreakdownRow,
  QoderCliUsageDailyPoint,
  QoderCliUsageSessionRow,
  QoderCliUsageSummary
} from '../../../../shared/qodercli-usage-types'
import { QoderCliUsageDailyChart } from './QoderCliUsageDailyChart'
import { QoderCliUsageRecentSessionsTable } from './QoderCliUsageRecentSessionsTable'
import { UsageBreakdownSection } from './UsageBreakdownSection'
import { translate } from '@/i18n/i18n'

type QoderCliUsageDetailsProps = {
  daily: QoderCliUsageDailyPoint[]
  modelBreakdown: QoderCliUsageBreakdownRow[]
  projectBreakdown: QoderCliUsageBreakdownRow[]
  recentSessions: QoderCliUsageSessionRow[]
  summary: QoderCliUsageSummary | null | undefined
}

export function QoderCliUsageDetails({
  daily,
  modelBreakdown,
  projectBreakdown,
  recentSessions,
  summary
}: QoderCliUsageDetailsProps): React.JSX.Element {
  return (
    <>
      <QoderCliUsageDailyChart daily={daily} />

      <div className="grid gap-4 xl:grid-cols-2">
        <UsageBreakdownSection
          title={translate('auto.components.stats.QoderCliUsagePane.byModel', 'By model')}
          topLabel={translate('auto.components.stats.QoderCliUsagePane.topModel', 'Top model:')}
          topValue={summary?.topModel}
          rows={modelBreakdown.map((row) => ({
            key: row.key,
            label: row.label,
            tokens: row.inputTokens + row.outputTokens,
            sessions: row.sessions,
            eventsOrTurns: row.turns,
            credits: row.credits
          }))}
          eventsOrTurns="turns"
        />
        <UsageBreakdownSection
          title={translate('auto.components.stats.QoderCliUsagePane.byProject', 'By project')}
          topLabel={translate('auto.components.stats.QoderCliUsagePane.topProject', 'Top project:')}
          topValue={summary?.topProject}
          rows={projectBreakdown.map((row) => ({
            key: row.key,
            label: row.label,
            tokens: row.inputTokens + row.outputTokens,
            sessions: row.sessions,
            eventsOrTurns: row.turns,
            credits: row.credits
          }))}
          eventsOrTurns="turns"
        />
      </div>

      <QoderCliUsageRecentSessionsTable recentSessions={recentSessions} />
    </>
  )
}
