/**
 * Lizenz-API-Client für Mandantenfähigkeit.
 * Ruft Lizenz + Design-Config vom Lizenzportal ab.
 *
 * Env:
 *   VITE_LICENSE_API_URL – Basis-URL der Lizenz-API
 *     - Supabase Edge Function: https://ojryoosqwfbzlmdeywzs.supabase.co/functions/v1
 *     - Netlify (Fallback): https://lizenz.amrtech.de/api
 *   VITE_LICENSE_API_KEY – Optional, für Supabase Edge Function (anon key) wenn verify_jwt=true
 * Wenn nicht gesetzt: Legacy-Modus (Lizenz aus Mandanten-Supabase via get_license_status).
 */

const STORAGE_KEY = 'vico-license-number'
const STORAGE_LAST_CHECK_PREFIX = 'vico-license-last-check-'
const STORAGE_CHECK_INTERVAL_PREFIX = 'vico-license-check-interval-'
const STORAGE_CACHE = 'vico-license-cache'

type CachedLicense = { data: LicenseApiResponse; ts: number; licenseNumber: string }

export const getCachedLicenseResponse = (licenseNumber: string): LicenseApiResponse | null => {
  const meta = getCachedLicenseWithMeta(licenseNumber)
  return meta?.data ?? null
}

/** Cache inkl. Zeitstempel für „Cache frisch?“-Prüfung (z. B. < 5 Min = sofort nutzen). */
export const getCachedLicenseWithMeta = (
  licenseNumber: string
): { data: LicenseApiResponse; ts: number } | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_CACHE)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedLicense
    if (!parsed?.data?.license || parsed.licenseNumber !== licenseNumber) return null
    return { data: parsed.data, ts: parsed.ts ?? 0 }
  } catch {
    return null
  }
}

export const setCachedLicenseResponse = (
  data: LicenseApiResponse,
  licenseNumber: string
): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(
      STORAGE_CACHE,
      JSON.stringify({ data, ts: Date.now(), licenseNumber })
    )
  }
}

export const getLastLicenseCheck = (licenseNumber: string): number | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(`${STORAGE_LAST_CHECK_PREFIX}${licenseNumber}`)
  if (!raw) return null
  const ts = parseInt(raw, 10)
  return Number.isFinite(ts) ? ts : null
}

export const setLastLicenseCheck = (timestamp: number, licenseNumber: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${STORAGE_LAST_CHECK_PREFIX}${licenseNumber}`, String(timestamp))
  }
}

export const getStoredCheckInterval = (
  licenseNumber: string
): 'on_start' | 'daily' | 'weekly' | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(`${STORAGE_CHECK_INTERVAL_PREFIX}${licenseNumber}`)
  if (raw !== 'on_start' && raw !== 'daily' && raw !== 'weekly') return null
  return raw
}

export const setStoredCheckInterval = (
  interval: 'on_start' | 'daily' | 'weekly',
  licenseNumber: string
): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${STORAGE_CHECK_INTERVAL_PREFIX}${licenseNumber}`, interval)
  }
}

export const getStoredLicenseNumber = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

export const setStoredLicenseNumber = (licenseNumber: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, licenseNumber.trim())
  }
}

export const clearStoredLicenseNumber = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export type LicenseApiResponse = {
  license: {
    tier: string
    valid_until: string | null
    grace_period_days?: number
    max_users: number | null
    max_customers: number | null
    max_storage_mb?: number | null
    check_interval: 'on_start' | 'daily' | 'weekly'
    features: Record<string, boolean>
    valid: boolean
    expired: boolean
    read_only?: boolean
    is_trial?: boolean
  }
  design: {
    app_name: string
    logo_url: string | null
    primary_color: string
    secondary_color?: string | null
    favicon_url?: string | null
  }
  impressum?: {
    company_name?: string
    address?: string
    contact?: string
    represented_by?: string
    register?: string
    vat_id?: string
  }
  datenschutz?: {
    responsible?: string
    contact_email?: string
    dsb_email?: string
  }
}

const DEFAULT_DESIGN: LicenseApiResponse['design'] = {
  app_name: 'AMRtech',
  logo_url: null,
  primary_color: '#5b7895',
  secondary_color: null,
  favicon_url: null,
}

/** Timeout in ms (Standard 10s für schnellere Fehlerbehandlung). */
export const fetchLicenseFromApi = async (
  licenseNumber: string,
  timeoutMs = 10_000
): Promise<LicenseApiResponse | null> => {
  const apiUrl = (import.meta.env.VITE_LICENSE_API_URL ?? '').trim()
  if (!apiUrl) return null

  const base = apiUrl.replace(/\/$/, '')
  const url = new URL(`${base}/license`)
  url.searchParams.set('licenseNumber', licenseNumber.trim())

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const apiKey = (import.meta.env.VITE_LICENSE_API_KEY ?? '').trim()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const data = (await res.json()) as LicenseApiResponse
    if (!data?.license) return null
    return {
      ...data,
      design: { ...DEFAULT_DESIGN, ...data.design },
    }
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

export const isLicenseApiConfigured = (): boolean => {
  const url = (import.meta.env.VITE_LICENSE_API_URL ?? '').trim()
  return url.length > 0
}

export type LimitExceededPayload = {
  licenseNumber: string
  limit_type: 'users' | 'customers'
  current_value: number
  max_value: number
  reported_from?: string
}

export type ImpressumUpdate = {
  company_name?: string | null
  address?: string | null
  contact?: string | null
  represented_by?: string | null
  register?: string | null
  vat_id?: string | null
}

export type DatenschutzUpdate = {
  responsible?: string | null
  contact_email?: string | null
  dsb_email?: string | null
}

export const updateImpressum = async (
  licenseNumber: string,
  payload: { impressum?: ImpressumUpdate; datenschutz?: DatenschutzUpdate }
): Promise<{ ok: boolean; error?: string }> => {
  const apiUrl = (import.meta.env.VITE_LICENSE_API_URL ?? '').trim()
  if (!apiUrl) return { ok: false, error: 'Lizenz-API nicht konfiguriert' }

  const base = apiUrl.replace(/\/$/, '')
  const url = `${base}/update-impressum`

  const apiKey = (import.meta.env.VITE_LICENSE_API_KEY ?? '').trim()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ licenseNumber: licenseNumber.trim(), ...payload }),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      return { ok: false, error: err.error ?? `Fehler ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Netzwerkfehler' }
  }
}

export const reportLimitExceeded = async (payload: LimitExceededPayload): Promise<boolean> => {
  const apiUrl = (import.meta.env.VITE_LICENSE_API_URL ?? '').trim()
  const apiEndpoint = apiUrl ? `${apiUrl.replace(/\/$/, '')}/limit-exceeded` : null

  let localOk = false
  try {
    const { supabase } = await import('../supabase')
    const { error } = await supabase.rpc('report_limit_exceeded', {
      p_license_number: payload.licenseNumber,
      p_limit_type: payload.limit_type,
      p_current_value: payload.current_value,
      p_max_value: payload.max_value,
      p_reported_from: payload.reported_from ?? null,
      p_api_url: null,
    })
    localOk = !error
  } catch {
    localOk = false
  }

  let apiOk = false
  if (apiEndpoint) {
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      apiOk = res.ok
    } catch {
      apiOk = false
    }
  }

  return localOk || apiOk
}
