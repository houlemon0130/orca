import type { QoderCliUsageSessionRow } from '../../../../shared/qodercli-usage-types'
import { translate } from '@/i18n/i18n'
import { formatSessionTime, formatTokens } from './usage-formatters'

export function QoderCliUsageRecentSessionsTable({
  recentSessions
}: {
  recentSessions: QoderCliUsageSessionRow[]
}): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-foreground">
          {translate('auto.components.stats.QoderCliUsagePane.recentSessions', 'Recent sessions')}
        </h4>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.stats.QoderCliUsagePane.recentSessionsSubtitle',
            'Most recent local Qoder CLI sessions in this scope.'
          )}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">
                {translate('auto.components.stats.QoderCliUsagePane.colLastActive', 'Last active')}
              </th>
              <th className="px-2 py-2 font-medium">
                {translate('auto.components.stats.QoderCliUsagePane.colProject', 'Project')}
              </th>
              <th className="px-2 py-2 font-medium">
                {translate('auto.components.stats.QoderCliUsagePane.colModel', 'Model')}
              </th>
              <th className="px-2 py-2 font-medium">
                {translate('auto.components.stats.QoderCliUsagePane.colTurns', 'Turns')}
              </th>
              <th className="px-2 py-2 font-medium">
                {translate('auto.components.stats.QoderCliUsagePane.colInput', 'Input')}
              </th>
              <th className="px-2 py-2 font-medium">
                {translate('auto.components.stats.QoderCliUsagePane.colOutput', 'Output')}
              </th>
              <th className="px-2 py-2 font-medium">
                {translate('auto.components.stats.QoderCliUsagePane.colCredits', 'Credits')}
              </th>
            </tr>
          </thead>
          <tbody>
            {recentSessions.map((row) => (
              <tr key={row.sessionId} className="border-b border-border/40 last:border-b-0">
                <td className="px-2 py-2 text-muted-foreground">
                  {formatSessionTime(row.lastActiveAt)}
                </td>
                <td className="px-2 py-2 text-foreground">{row.projectLabel}</td>
                <td className="px-2 py-2 text-muted-foreground">
                  {row.model ??
                    translate('auto.components.stats.QoderCliUsagePane.unknownModel', 'Unknown')}
                </td>
                <td className="px-2 py-2 text-muted-foreground">{row.turns}</td>
                <td className="px-2 py-2 text-muted-foreground">{formatTokens(row.inputTokens)}</td>
                <td className="px-2 py-2 text-muted-foreground">
                  {formatTokens(row.outputTokens)}
                </td>
                <td className="px-2 py-2 text-muted-foreground">{row.credits.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
