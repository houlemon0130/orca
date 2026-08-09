import { ipcMain } from 'electron'
import type { QoderCliUsageStore } from '../qodercli-usage/store'
import type {
  QoderCliUsageBreakdownKind,
  QoderCliUsageRange,
  QoderCliUsageScope
} from '../../shared/qodercli-usage-types'

export function registerQoderCliUsageHandlers(qoderCliUsage: QoderCliUsageStore): void {
  ipcMain.handle('qoderCliUsage:getScanState', () => qoderCliUsage.getScanState())
  ipcMain.handle('qoderCliUsage:setEnabled', (_event, args: { enabled: boolean }) =>
    qoderCliUsage.setEnabled(args.enabled)
  )
  ipcMain.handle('qoderCliUsage:refresh', (_event, args?: { force?: boolean }) =>
    qoderCliUsage.refresh(args?.force ?? false)
  )
  ipcMain.handle(
    'qoderCliUsage:getSnapshot',
    (_event, args: { scope: QoderCliUsageScope; range: QoderCliUsageRange; limit?: number }) =>
      qoderCliUsage.getSnapshot(args.scope, args.range, args.limit)
  )
  ipcMain.handle(
    'qoderCliUsage:getSummary',
    (_event, args: { scope: QoderCliUsageScope; range: QoderCliUsageRange }) =>
      qoderCliUsage.getSummary(args.scope, args.range)
  )
  ipcMain.handle(
    'qoderCliUsage:getDaily',
    (_event, args: { scope: QoderCliUsageScope; range: QoderCliUsageRange }) =>
      qoderCliUsage.getDaily(args.scope, args.range)
  )
  ipcMain.handle(
    'qoderCliUsage:getBreakdown',
    (
      _event,
      args: {
        scope: QoderCliUsageScope
        range: QoderCliUsageRange
        kind: QoderCliUsageBreakdownKind
      }
    ) => qoderCliUsage.getBreakdown(args.scope, args.range, args.kind)
  )
  ipcMain.handle(
    'qoderCliUsage:getRecentSessions',
    (_event, args: { scope: QoderCliUsageScope; range: QoderCliUsageRange; limit?: number }) =>
      qoderCliUsage.getRecentSessions(args.scope, args.range, args.limit)
  )
}
