import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadDashboardLayout,
  type DashboardLayoutStored,
  type DashboardWidgetId,
  setWidgetVisible,
  moveWidgetInOrder,
  setRecentEditsOpen,
  dismissRecentEditKey,
  clearDismissedRecentEdits,
  saveDashboardLayout,
} from '../lib/dashboardLayoutPreferences'
import { updateProfileDashboardLayout } from '../lib/userService'

/**
 * @param serverDashboardLayout `undefined` = Server noch nicht geladen; `null` = kein Layout in DB; sonst Stand vom Server (Multi-Gerät).
 */
export const useDashboardLayout = (
  userId: string | null,
  serverDashboardLayout?: DashboardLayoutStored | null
) => {
  const [layout, setLayout] = useState<DashboardLayoutStored>(() => loadDashboardLayout(userId))
  const lastServerJsonRef = useRef<string | null>(null)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    lastServerJsonRef.current = null
  }, [userId])

  const syncFromStorage = useCallback(() => {
    setLayout(loadDashboardLayout(userId))
  }, [userId])

  useEffect(() => {
    syncFromStorage()
  }, [userId, syncFromStorage])

  useEffect(() => {
    if (!userId) return
    if (serverDashboardLayout === undefined) return
    if (serverDashboardLayout === null) return
    const j = JSON.stringify(serverDashboardLayout)
    if (lastServerJsonRef.current === j) return
    lastServerJsonRef.current = j
    setLayout(serverDashboardLayout)
    saveDashboardLayout(userId, serverDashboardLayout)
  }, [userId, serverDashboardLayout])

  useEffect(() => {
    const handleChanged = (ev: Event) => {
      const ce = ev as CustomEvent<{ userId: string }>
      if (ce.detail?.userId === userId) syncFromStorage()
    }
    window.addEventListener('vico-dashboard-layout-changed', handleChanged)
    return () => window.removeEventListener('vico-dashboard-layout-changed', handleChanged)
  }, [userId, syncFromStorage])

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    }
  }, [])

  const schedulePersistToProfile = useCallback(
    (next: DashboardLayoutStored) => {
      if (!userId) return
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null
        void updateProfileDashboardLayout(userId, next)
      }, 650)
    },
    [userId]
  )

  const updateWidgetVisible = useCallback(
    (id: DashboardWidgetId, visible: boolean) => {
      if (!userId) return
      setLayout((prev) => {
        const next = setWidgetVisible(userId, prev, id, visible)
        schedulePersistToProfile(next)
        return next
      })
    },
    [userId, schedulePersistToProfile]
  )

  const moveWidgetOrder = useCallback(
    (id: DashboardWidgetId, direction: 'up' | 'down') => {
      if (!userId) return
      setLayout((prev) => {
        const next = moveWidgetInOrder(userId, prev, id, direction)
        schedulePersistToProfile(next)
        return next
      })
    },
    [userId, schedulePersistToProfile]
  )

  const updateRecentEditsOpen = useCallback(
    (open: boolean) => {
      if (!userId) return
      setLayout((prev) => {
        const next = setRecentEditsOpen(userId, prev, open)
        schedulePersistToProfile(next)
        return next
      })
    },
    [userId, schedulePersistToProfile]
  )

  const dismissRecentEdit = useCallback(
    (key: string) => {
      if (!userId) return
      setLayout((prev) => {
        const next = dismissRecentEditKey(userId, prev, key)
        schedulePersistToProfile(next)
        return next
      })
    },
    [userId, schedulePersistToProfile]
  )

  const resetDismissedRecentEdits = useCallback(() => {
    if (!userId) return
    setLayout((prev) => {
      const next = clearDismissedRecentEdits(userId, prev)
      schedulePersistToProfile(next)
      return next
    })
  }, [userId, schedulePersistToProfile])

  return {
    layout,
    updateWidgetVisible,
    moveWidgetOrder,
    updateRecentEditsOpen,
    dismissRecentEdit,
    resetDismissedRecentEdits,
  }
}
