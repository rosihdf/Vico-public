import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import type { SyncStatus } from './types'
import { getPendingCount, runSync } from './lib/syncService'
import { subscribeToDataChange } from './lib/dataService'

type SyncContextType = {
  syncStatus: SyncStatus
  isOffline: boolean
  setSyncStatus: (status: SyncStatus) => void
  syncNow: () => Promise<void>
  pendingCount: number
  lastSyncError: string | null
  clearSyncError: () => void
}

const SyncContext = createContext<SyncContextType | null>(null)

const computeStatus = (online: boolean, pending: number): SyncStatus => {
  if (!online) return 'offline'
  if (pending > 0) return 'ready'
  return 'synced'
}

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [online, setOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const [syncStatus, setSyncStatusState] = useState<SyncStatus>(() =>
    computeStatus(online, getPendingCount())
  )

  const refreshStatus = useCallback(() => {
    const p = getPendingCount()
    setPendingCount(p)
    setSyncStatusState(computeStatus(online, p))
  }, [online])

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      setPendingCount(getPendingCount())
    }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [online, refreshStatus])

  useEffect(() => {
    return subscribeToDataChange(refreshStatus)
  }, [refreshStatus])

  const syncNow = useCallback(async () => {
    if (!online) return
    setLastSyncError(null)
    const result = await runSync()
    setPendingCount(result.pendingCount)
    setSyncStatusState(computeStatus(true, result.pendingCount))
    if (result.error) setLastSyncError(result.error)
  }, [online])

  const clearSyncError = useCallback(() => setLastSyncError(null), [])

  useEffect(() => {
    if (!online) return
    const t = setTimeout(syncNow, 300)
    return () => clearTimeout(t)
  }, [online, syncNow])

  const setSyncStatus = useCallback((status: SyncStatus) => {
    setSyncStatusState(status)
  }, [])

  const value = useMemo<SyncContextType>(() => ({
    syncStatus,
    isOffline: syncStatus === 'offline',
    setSyncStatus,
    syncNow,
    pendingCount,
    lastSyncError,
    clearSyncError,
  }), [syncStatus, setSyncStatus, syncNow, pendingCount, lastSyncError, clearSyncError])

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  )
}

export const useSync = (): SyncContextType => {
  const ctx = useContext(SyncContext)
  if (!ctx) {
    throw new Error('useSync must be used within SyncProvider')
  }
  return ctx
}
