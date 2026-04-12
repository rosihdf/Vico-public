/**
 * §11.18 WP-NET-10: Realtime-Subscribe-Status entprellt in Mandanten-Degraded einbeziehen.
 * Mindestens 2 relevante Fehler innerhalb von 2 Minuten; einmal SUBSCRIBED setzt zurück.
 */

import {
  MANDANT_DEGRADED_FAILURE_THRESHOLD,
  reportMandantTransportFailureBatch,
  reportMandantTransportSuccess,
} from './mandantDegradedStore'

const FAILURE_WINDOW_MS = 120_000
const FAILURES_REQUIRED = 2

let failureTimestamps: number[] = []

export const resetMandantRealtimeDegradedForTests = (): void => {
  failureTimestamps = []
}

const pruneOldFailures = (now: number): void => {
  const cutoff = now - FAILURE_WINDOW_MS
  while (failureTimestamps.length > 0 && failureTimestamps[0] < cutoff) {
    failureTimestamps.shift()
  }
}

/**
 * In jedem `channel.subscribe((status, err) => …)` des Mandanten-Supabase-Clients aufrufen.
 * Zählt nur CHANNEL_ERROR und TIMED_OUT (nicht CLOSED bei normalem removeChannel).
 */
export const recordMandantRealtimeSubscribeStatus = (status: string, _err?: Error): void => {
  const now = Date.now()
  if (status === 'SUBSCRIBED') {
    failureTimestamps = []
    reportMandantTransportSuccess()
    return
  }
  if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT') return
  failureTimestamps.push(now)
  pruneOldFailures(now)
  if (failureTimestamps.length >= FAILURES_REQUIRED) {
    reportMandantTransportFailureBatch(MANDANT_DEGRADED_FAILURE_THRESHOLD)
  }
}
