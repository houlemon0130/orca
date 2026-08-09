import type { StateCreator } from 'zustand'
import type {
  QoderCliUsageBreakdownRow,
  QoderCliUsageDailyPoint,
  QoderCliUsageRange,
  QoderCliUsageScanState,
  QoderCliUsageScope,
  QoderCliUsageSessionRow,
  QoderCliUsageSnapshot,
  QoderCliUsageSummary
} from '../../../../shared/qodercli-usage-types'
import type { AppState } from '../types'

export type QoderCliUsageSlice = {
  qoderCliUsageScope: QoderCliUsageScope
  qoderCliUsageRange: QoderCliUsageRange
  qoderCliUsageScanState: QoderCliUsageScanState | null
  qoderCliUsageSummary: QoderCliUsageSummary | null
  qoderCliUsageDaily: QoderCliUsageDailyPoint[]
  qoderCliUsageModelBreakdown: QoderCliUsageBreakdownRow[]
  qoderCliUsageProjectBreakdown: QoderCliUsageBreakdownRow[]
  qoderCliUsageRecentSessions: QoderCliUsageSessionRow[]
  setQoderCliUsageEnabled: (enabled: boolean) => Promise<void>
  setQoderCliUsageScope: (scope: QoderCliUsageScope) => Promise<void>
  setQoderCliUsageRange: (range: QoderCliUsageRange) => Promise<void>
  fetchQoderCliUsage: (opts?: { forceRefresh?: boolean }) => Promise<void>
  enableQoderCliUsage: () => Promise<void>
  refreshQoderCliUsage: () => Promise<void>
}

export const createQoderCliUsageSlice: StateCreator<AppState, [], [], QoderCliUsageSlice> = (
  set,
  get
) => ({
  qoderCliUsageScope: 'orca',
  qoderCliUsageRange: '30d',
  qoderCliUsageScanState: null,
  qoderCliUsageSummary: null,
  qoderCliUsageDaily: [],
  qoderCliUsageModelBreakdown: [],
  qoderCliUsageProjectBreakdown: [],
  qoderCliUsageRecentSessions: [],

  setQoderCliUsageEnabled: async (enabled) => {
    try {
      const nextScanState = (await window.api.qoderCliUsage.setEnabled({
        enabled
      })) as QoderCliUsageScanState | undefined
      // Why: the web client (paired runtime) does not bridge the desktop-only
      // usage IPC; its preload fallback resolves this call to `undefined`. Bail
      // so the toggle no-ops instead of seeding an empty scan state and then
      // crashing on the follow-up fetch.
      if (!nextScanState) {
        return
      }
      set({
        qoderCliUsageScanState: enabled
          ? {
              ...nextScanState,
              isScanning: true,
              lastScanCompletedAt: null,
              lastScanError: null
            }
          : nextScanState,
        qoderCliUsageSummary: null,
        qoderCliUsageDaily: [],
        qoderCliUsageModelBreakdown: [],
        qoderCliUsageProjectBreakdown: [],
        qoderCliUsageRecentSessions: []
      })
      if (enabled) {
        await get().fetchQoderCliUsage({ forceRefresh: true })
      }
    } catch (error) {
      console.error('Failed to update Qoder CLI usage setting:', error)
    }
  },

  setQoderCliUsageScope: async (scope) => {
    set({ qoderCliUsageScope: scope })
    await get().fetchQoderCliUsage()
  },

  setQoderCliUsageRange: async (range) => {
    set({ qoderCliUsageRange: range })
    await get().fetchQoderCliUsage()
  },

  fetchQoderCliUsage: async (opts) => {
    try {
      const scanState = (await window.api.qoderCliUsage.getScanState()) as
        | QoderCliUsageScanState
        | undefined
      // Why: in the web client the usage IPC is unavailable and the preload
      // fallback resolves to `undefined`; treat an absent scan state as
      // "usage unavailable" and stop.
      if (!scanState) {
        return
      }
      const currentScanState = get().qoderCliUsageScanState
      const shouldPreserveLoadingState =
        opts?.forceRefresh === true &&
        currentScanState?.enabled === true &&
        get().qoderCliUsageSummary === null
      set({
        qoderCliUsageScanState: shouldPreserveLoadingState
          ? {
              ...scanState,
              isScanning: true,
              lastScanCompletedAt: null,
              lastScanError: null
            }
          : scanState
      })
      if (!scanState.enabled) {
        return
      }

      const { qoderCliUsageScope, qoderCliUsageRange } = get()
      const snapshot = (await window.api.qoderCliUsage.getSnapshot({
        scope: qoderCliUsageScope,
        range: qoderCliUsageRange,
        limit: 10
      })) as QoderCliUsageSnapshot
      const hasCachedSnapshot =
        snapshot.scanState.lastScanCompletedAt !== null || snapshot.scanState.hasAnyQoderCliData

      if (hasCachedSnapshot) {
        set({
          qoderCliUsageScanState:
            opts?.forceRefresh === true
              ? { ...snapshot.scanState, isScanning: true }
              : snapshot.scanState,
          qoderCliUsageSummary: snapshot.summary,
          qoderCliUsageDaily: snapshot.daily,
          qoderCliUsageModelBreakdown: snapshot.modelBreakdown,
          qoderCliUsageProjectBreakdown: snapshot.projectBreakdown,
          qoderCliUsageRecentSessions: snapshot.recentSessions
        })
      } else {
        set({
          qoderCliUsageScanState: {
            ...scanState,
            isScanning: true,
            lastScanError: null
          }
        })
      }

      await window.api.qoderCliUsage.refresh({
        force: opts?.forceRefresh ?? false
      })
      const { qoderCliUsageScope: refreshedScope, qoderCliUsageRange: refreshedRange } = get()
      const refreshedSnapshot = (await window.api.qoderCliUsage.getSnapshot({
        scope: refreshedScope,
        range: refreshedRange,
        limit: 10
      })) as QoderCliUsageSnapshot

      set({
        qoderCliUsageScanState: refreshedSnapshot.scanState,
        qoderCliUsageSummary: refreshedSnapshot.summary,
        qoderCliUsageDaily: refreshedSnapshot.daily,
        qoderCliUsageModelBreakdown: refreshedSnapshot.modelBreakdown,
        qoderCliUsageProjectBreakdown: refreshedSnapshot.projectBreakdown,
        qoderCliUsageRecentSessions: refreshedSnapshot.recentSessions
      })
    } catch (error) {
      console.error('Failed to fetch Qoder CLI usage:', error)
    }
  },

  enableQoderCliUsage: async () => {
    await get().setQoderCliUsageEnabled(true)
  },

  refreshQoderCliUsage: async () => {
    await get().fetchQoderCliUsage({ forceRefresh: true })
  }
})
