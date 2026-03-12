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
    max_users: number | null
    max_customers: number | null
    check_interval: 'on_start' | 'daily' | 'weekly'
    features: Record<string, boolean>
    valid: boolean
    expired: boolean
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

export const fetchLicenseFromApi = async (
  licenseNumber: string
): Promise<LicenseApiResponse | null> => {
  const apiUrl = (import.meta.env.VITE_LICENSE_API_URL ?? '').trim()
  if (!apiUrl) return null

  const base = apiUrl.replace(/\/$/, '')
  const url = new URL(`${base}/license`)
  url.searchParams.set('licenseNumber', licenseNumber.trim())

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15_000)

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
