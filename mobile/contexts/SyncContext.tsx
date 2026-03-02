import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react'
import NetInfo from '@react-native-community/netinfo'
import type { SyncStatus } from '../lib/types'
import { initOfflineStorage } from '../lib/offlineStorage'
import { getIsOnline, setIsOnline } from '../lib/networkState'
import { runSync, getPendingCount } from '../lib/syncService'
import { subscribeToDataChange } from '../lib/dataService'

type SyncContextType = {
  syncStatus: SyncStatus
  setSyncStatus: (status: SyncStatus) => void
  syncNow: () => Promise<void>
  pendingCount: number
}

const SyncContext = createContext<SyncContextType | null>(null)

const deriveStatus = (isOnline: boolean, pending: number): SyncStatus => {
  if (!isOnline) return 'offline'
  if (pending > 0) return 'ready'
  return 'synced'
}

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(true)
  const [pendingCount, setPendingCountState] = useState(0)
  const [syncStatus, setSyncStatusState] = useState<SyncStatus>('synced')
  const [isInitialized, setIsInitialized] = useState(false)

  const refreshPending = useCallback(() => {
    setPendingCountState(getPendingCount())
  }, [])

  const updateStatus = useCallback(() => {
    setIsOnline(isConnected)
    setSyncStatusState(deriveStatus(isConnected, pendingCount))
  }, [isConnected, pendingCount])

  useEffect(() => {
    const init = async () => {
      await initOfflineStorage()
      setIsInitialized(true)
      refreshPending()
    }
    init()
  }, [refreshPending])

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false
      setIsConnected(connected)
      setIsOnline(connected)
    })
    return () => unsub()
  }, [])

  // Auto-Sync bei Wiederkehr des Netzwerks
  const prevConnectedRef = useRef(false)
  useEffect(() => {
    if (isConnected && !prevConnectedRef.current && isInitialized) {
      prevConnectedRef.current = true
      setTimeout(() => {
        runSync().then(() => refreshPending())
      }, 500)
    }
    if (!isConnected) prevConnectedRef.current = false
  }, [isConnected, isInitialized, refreshPending])

  useEffect(() => {
    if (!isInitialized) return
    const unsub = subscribeToDataChange(refreshPending)
    return () => unsub()
  }, [isInitialized, refreshPending])

  useEffect(() => {
    setSyncStatusState(deriveStatus(isConnected, pendingCount))
  }, [isConnected, pendingCount])

  const setSyncStatus = (status: SyncStatus) => setSyncStatusState(status)
  const syncNow = async () => {
    if (!isConnected) return
    setSyncStatusState('ready')
    const result = await runSync()
    refreshPending()
    if (result.success) {
      setSyncStatusState(deriveStatus(isConnected, result.pendingCount))
    }
  }

  return (
    <SyncContext.Provider
      value={{
        syncStatus,
        setSyncStatus,
        syncNow,
        pendingCount,
      }}
    >
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
