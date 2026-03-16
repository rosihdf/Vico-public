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
    check_interval: 'on_start' | 'daily' | 'weekly'
    features: Record<string, boolean>
    valid: boolean
    expired: boolean
    read_only?: boolean
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
  app_name: 'Vico',
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
}

export const reportLimitExceeded = async (payload: LimitExceededPayload): Promise<boolean> => {
  const apiUrl = (import.meta.env.VITE_LICENSE_API_URL ?? '').trim()
  if (!apiUrl) return false

  const url = `${apiUrl.replace(/\/$/, '')}/limit-exceeded`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}
