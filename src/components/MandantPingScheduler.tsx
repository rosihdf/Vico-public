import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../AuthContext'
import { isOnline } from '../../shared/networkUtils'
import {
  getMandantPingEnabled,
  MANDANT_PING_INTERVAL_MS,
  MANDANT_PING_PREFERENCE_EVENT,
  pingMandantSupabaseOnce,
} from '../../shared/mandantReachabilityPing'

/**
 * Periodischer Ping nur wenn aktiviert (localStorage) und Nutzer angemeldet.
 */
const MandantPingScheduler = () => {
  const { isAuthenticated } = useAuth()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      globalThis.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startSchedule = useCallback(() => {
    clearTimer()
    if (!isAuthenticated || !getMandantPingEnabled()) return
    const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
    if (!url || !key) return

    const tick = (): void => {
      if (!getMandantPingEnabled() || !isOnline()) return
      void pingMandantSupabaseOnce(url, key)
    }
    void tick()
    timerRef.current = globalThis.setInterval(tick, MANDANT_PING_INTERVAL_MS)
  }, [clearTimer, isAuthenticated])

  useEffect(() => {
    startSchedule()
    const onPrefs = (): void => {
      startSchedule()
    }
    window.addEventListener(MANDANT_PING_PREFERENCE_EVENT, onPrefs)
    return () => {
      window.removeEventListener(MANDANT_PING_PREFERENCE_EVENT, onPrefs)
      clearTimer()
    }
  }, [startSchedule, clearTimer])

  return null
}

export default MandantPingScheduler
