import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import type { QoderCliUsageDailyPoint } from '../../../../shared/qodercli-usage-types'
import { translate } from '@/i18n/i18n'

function getMaxDailyCredits(daily: QoderCliUsageDailyPoint[]): number {
  let max = 1
  for (const entry of daily) {
    max = Math.max(max, entry.credits)
  }
  return max
}

type QoderCliUsageDailyChartProps = {
  daily: QoderCliUsageDailyPoint[]
}

// Why credits (not tokens) drive the bars: current qodercli builds zero their
// token counts, so a token chart would always be flat; credits are the real
// billed signal. Turns ride along in the tooltip.
export function QoderCliUsageDailyChart({
  daily
}: QoderCliUsageDailyChartProps): React.JSX.Element {
  const maxDailyCredits = getMaxDailyCredits(daily)

  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-foreground">
          {translate('auto.components.stats.QoderCliUsageDailyChart.title', 'Daily usage')}
        </h4>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.stats.QoderCliUsageDailyChart.subtitle',
            'Credits and turns by day.'
          )}
        </p>
      </div>
      <div className="grid h-56 grid-cols-10 items-end gap-3">
        {daily.slice(-10).map((entry) => {
          const heightPercent = Math.max(
            (entry.credits / maxDailyCredits) * 100,
            entry.turns > 0 ? 2 : 0
          )
          return (
            <TooltipProvider key={entry.day} delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-full cursor-default flex-col items-center justify-end gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-sm bg-foreground/70"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{entry.day.slice(5)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  <div className="space-y-0.5 text-xs">
                    <div>{entry.day}</div>
                    <div>
                      {translate(
                        'auto.components.stats.QoderCliUsageDailyChart.tooltipCredits',
                        '{{value0}} credits',
                        { value0: entry.credits.toFixed(2) }
                      )}
                    </div>
                    <div>
                      {translate(
                        'auto.components.stats.QoderCliUsageDailyChart.tooltipTurns',
                        '{{value0}} turns',
                        { value0: entry.turns.toLocaleString() }
                      )}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>
    </section>
  )
}
