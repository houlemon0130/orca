import { useEffect } from 'react'
import {
  Activity,
  Coins,
  DatabaseZap,
  FolderKanban,
  RefreshCw,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react'
import type {
  QoderCliUsageRange,
  QoderCliUsageScope
} from '../../../../shared/qodercli-usage-types'
import { useAppStore } from '../../store'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { ClaudeUsageLoadingState } from './ClaudeUsageLoadingState'
import { QoderCliUsageDetails } from './QoderCliUsageDetails'
import { StatCard } from './StatCard'
import { formatTokens, formatUpdatedAt } from './usage-formatters'
import { translate } from '@/i18n/i18n'

const RANGE_OPTIONS: QoderCliUsageRange[] = ['7d', '30d', '90d', 'all']
const SCOPE_OPTIONS: { value: QoderCliUsageScope; label: string }[] = [
  {
    value: 'orca',
    get label() {
      return translate('auto.components.stats.QoderCliUsagePane.scopeOrca', 'Orca worktrees only')
    }
  },
  {
    value: 'all',
    get label() {
      return translate(
        'auto.components.stats.QoderCliUsagePane.scopeAll',
        'All local Qoder CLI usage'
      )
    }
  }
]
const RANGE_LABELS: Record<QoderCliUsageRange, string> = {
  get '7d'() {
    return translate('auto.components.stats.QoderCliUsagePane.rangeLast7Days', 'Last 7 days')
  },
  get '30d'() {
    return translate('auto.components.stats.QoderCliUsagePane.rangeLast30Days', 'Last 30 days')
  },
  get '90d'() {
    return translate('auto.components.stats.QoderCliUsagePane.rangeLast90Days', 'Last 90 days')
  },
  get all() {
    return translate('auto.components.stats.QoderCliUsagePane.rangeAllTime', 'All time')
  }
}

export function QoderCliUsagePane(): React.JSX.Element {
  const scanState = useAppStore((state) => state.qoderCliUsageScanState)
  const summary = useAppStore((state) => state.qoderCliUsageSummary)
  const daily = useAppStore((state) => state.qoderCliUsageDaily)
  const modelBreakdown = useAppStore((state) => state.qoderCliUsageModelBreakdown)
  const projectBreakdown = useAppStore((state) => state.qoderCliUsageProjectBreakdown)
  const recentSessions = useAppStore((state) => state.qoderCliUsageRecentSessions)
  const scope = useAppStore((state) => state.qoderCliUsageScope)
  const range = useAppStore((state) => state.qoderCliUsageRange)
  const fetchQoderCliUsage = useAppStore((state) => state.fetchQoderCliUsage)
  const setQoderCliUsageEnabled = useAppStore((state) => state.setQoderCliUsageEnabled)
  const refreshQoderCliUsage = useAppStore((state) => state.refreshQoderCliUsage)
  const setQoderCliUsageScope = useAppStore((state) => state.setQoderCliUsageScope)
  const setQoderCliUsageRange = useAppStore((state) => state.setQoderCliUsageRange)
  const recordFeatureInteraction = useAppStore((state) => state.recordFeatureInteraction)

  useEffect(() => {
    void fetchQoderCliUsage()
  }, [fetchQoderCliUsage])

  const handleSetEnabled = (enabled: boolean): void => {
    recordFeatureInteraction('usage-tracking')
    void setQoderCliUsageEnabled(enabled)
  }

  if (!scanState?.enabled) {
    return (
      <div className="rounded-lg border border-border/60 bg-card/40 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              {translate(
                'auto.components.stats.QoderCliUsagePane.title',
                'Qoder CLI Usage Tracking'
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              {translate(
                'auto.components.stats.QoderCliUsagePane.description',
                'Reads local Qoder CLI session transcripts to show credit, model, and session stats.'
              )}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={false}
            aria-label={translate(
              'auto.components.stats.QoderCliUsagePane.enableAria',
              'Enable Qoder CLI usage analytics'
            )}
            onClick={() => handleSetEnabled(true)}
            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-muted-foreground/30 transition-colors"
          >
            <span className="pointer-events-none block size-3.5 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform" />
          </button>
        </div>
      </div>
    )
  }

  if (!summary && (scanState.isScanning || scanState.lastScanCompletedAt === null)) {
    return (
      <ClaudeUsageLoadingState
        title={translate(
          'auto.components.stats.QoderCliUsagePane.title',
          'Qoder CLI Usage Tracking'
        )}
        summaryCardCount={6}
        summaryGridClassName="md:grid-cols-3"
      />
    )
  }

  const hasAnyData = summary?.hasAnyQoderCliData ?? scanState.hasAnyQoderCliData

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-card/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {translate('auto.components.stats.QoderCliUsagePane.title', 'Qoder CLI Usage Tracking')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatUpdatedAt(scanState.lastScanCompletedAt)}
            {scanState.lastScanError
              ? translate(
                  'auto.components.stats.QoderCliUsagePane.lastScanError',
                  ' • Last scan error: {{value0}}',
                  { value0: scanState.lastScanError }
                )
              : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          <DropdownMenu>
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={translate(
                        'auto.components.stats.QoderCliUsagePane.optionsAria',
                        'Qoder CLI usage options'
                      )}
                    >
                      <SlidersHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  {translate('auto.components.stats.QoderCliUsagePane.filters', 'Filters')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                {translate('auto.components.stats.QoderCliUsagePane.scope', 'Scope')}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={scope}
                onValueChange={(value) => void setQoderCliUsageScope(value as QoderCliUsageScope)}
              >
                {SCOPE_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                {translate('auto.components.stats.QoderCliUsagePane.range', 'Range')}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={range}
                onValueChange={(value) => void setQoderCliUsageRange(value as QoderCliUsageRange)}
              >
                {RANGE_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {RANGE_LABELS[option]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipProvider delayDuration={250}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => void refreshQoderCliUsage()}
                  disabled={scanState.isScanning}
                  aria-label={translate(
                    'auto.components.stats.QoderCliUsagePane.refreshAria',
                    'Refresh Qoder CLI usage'
                  )}
                >
                  <RefreshCw className={`size-3.5 ${scanState.isScanning ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {translate('auto.components.stats.QoderCliUsagePane.refresh', 'Refresh')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            type="button"
            role="switch"
            aria-checked={true}
            aria-label={translate(
              'auto.components.stats.QoderCliUsagePane.enableAria',
              'Enable Qoder CLI usage analytics'
            )}
            onClick={() => handleSetEnabled(false)}
            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-foreground transition-colors"
          >
            <span className="pointer-events-none block size-3.5 translate-x-4 rounded-full bg-background shadow-sm transition-transform" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {SCOPE_OPTIONS.find((option) => option.value === scope)?.label} • {RANGE_LABELS[range]}
        </p>
      </div>

      {!hasAnyData ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-card/30 px-4 py-6 text-sm text-muted-foreground">
          {translate(
            'auto.components.stats.QoderCliUsagePane.noData',
            'No local Qoder CLI usage found yet for this scope.'
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard
              label={translate('auto.components.stats.QoderCliUsagePane.credits', 'Credits')}
              value={(summary?.credits ?? 0).toFixed(2)}
              icon={<Coins className="size-4" />}
            />
            <StatCard
              label={translate(
                'auto.components.stats.QoderCliUsagePane.sessionsTurns',
                'Sessions / Turns'
              )}
              value={`${(summary?.sessions ?? 0).toLocaleString()} / ${(summary?.turns ?? 0).toLocaleString()}`}
              icon={<FolderKanban className="size-4" />}
            />
            <StatCard
              label={translate(
                'auto.components.stats.QoderCliUsagePane.inputTokens',
                'Input tokens'
              )}
              value={formatTokens(summary?.inputTokens ?? 0)}
              icon={<Sparkles className="size-4" />}
            />
            <StatCard
              label={translate(
                'auto.components.stats.QoderCliUsagePane.outputTokens',
                'Output tokens'
              )}
              value={formatTokens(summary?.outputTokens ?? 0)}
              icon={<Activity className="size-4" />}
            />
            <StatCard
              label={translate('auto.components.stats.QoderCliUsagePane.cacheRead', 'Cache read')}
              value={formatTokens(summary?.cacheReadTokens ?? 0)}
              icon={<DatabaseZap className="size-4" />}
            />
            <StatCard
              label={translate('auto.components.stats.QoderCliUsagePane.cacheWrite', 'Cache write')}
              value={formatTokens(summary?.cacheWriteTokens ?? 0)}
              icon={<DatabaseZap className="size-4" />}
            />
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            {translate(
              'auto.components.stats.QoderCliUsagePane.creditsNote',
              'Credits come from Qoder CLI transcript usage records. Token counts are shown as written; current CLI builds report zeros.'
            )}
          </p>

          <QoderCliUsageDetails
            daily={daily}
            modelBreakdown={modelBreakdown}
            projectBreakdown={projectBreakdown}
            recentSessions={recentSessions}
            summary={summary}
          />
        </>
      )}
    </div>
  )
}
