/**
 * §11.18 WP-NET-02: Optionaler Erreichbarkeits-Ping zum Mandanten-Supabase (Standard aus).
 * Speicherung: localStorage (pro Browser). Kein Lizenz-Host (§11.18#6/#8).
 */

import {
  MANDANT_DEGRADED_FAILURE_THRESHOLD,
  reportMandantTransportFailureBatch,
  reportMandantTransportSuccess,
} from './mandantDegradedStore'

export const MANDANT_PING_STORAGE_KEY = 'vico.mandantReachabilityPing.enabled'

/** Nach §11.18#8: leichtgewichtig; nicht zu häufig. */
export const MANDANT_PING_INTERVAL_MS = 120_000

/** Einzelner Ping darf nicht ewig hängen. */
export const MANDANT_PING_REQUEST_TIMEOUT_MS = 8_000

export const MANDANT_PING_PREFERENCE_EVENT = 'vico-mandant-ping-changed'

export const getMandantPingEnabled = (): boolean => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(MANDANT_PING_STORAGE_KEY) === '1'
}

export const setMandantPingEnabled = (enabled: boolean): void => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(MANDANT_PING_STORAGE_KEY, enabled ? '1' : '0')
}

const normalizeBase = (url: string): string => url.trim().replace(/\/$/, '')

/**
 * HEAD auf REST-Root (wie warmUp); aktualisiert Degraded-Store bei Erfolg/Fehler.
 * Nutzt rohes fetch (nicht den Supabase-Client-Wrap), meldet Outcomes explizit.
 */
export const pingMandantSupabaseOnce = async (
  supabaseUrl: string,
  anonKey: string
): Promise<{ ok: boolean }> => {
  const base = normalizeBase(supabaseUrl)
  const key = anonKey.trim()
  if (!base || !key) return { ok: false }

  const ctrl = new AbortController()
  const tid = globalThis.setTimeout(() => ctrl.abort(), MANDANT_PING_REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: key },
      signal: ctrl.signal,
    })
    reportMandantTransportSuccess()
    return { ok: res.ok }
  } catch {
    reportMandantTransportFailureBatch(MANDANT_DEGRADED_FAILURE_THRESHOLD)
    return { ok: false }
  } finally {
    globalThis.clearTimeout(tid)
  }
}
