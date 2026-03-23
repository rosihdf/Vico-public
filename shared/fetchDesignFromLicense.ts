/**
 * Holt Design (app_name, etc.) aus der Lizenz-API.
 * Für Portal und Arbeitszeitenportal – nutzt VITE_LICENSE_API_URL und optional VITE_LICENSE_NUMBER.
 * Ohne Nummer: GET …/license (Host-Lookup per Browser-Origin), siehe Phase B / Netlify-README.
 */

import type { AppVersionsMap } from './appVersions'
import { parseAppVersionsFromDb } from './appVersions'

export type DesignFromLicense = {
  app_name: string
  logo_url: string | null
  primary_color: string
  secondary_color?: string | null
  favicon_url?: string | null
}

const DEFAULT_APP_NAME = 'AMRtech'

export const fetchDesignFromLicense = async (
  apiUrl: string,
  licenseNumber: string,
  options?: { timeoutMs?: number; apiKey?: string; resolveByHost?: boolean }
): Promise<DesignFromLicense | null> => {
  const timeoutMs = options?.timeoutMs ?? 8_000
  const base = apiUrl.replace(/\/$/, '')
  const url = new URL(`${base}/license`)
  const num = licenseNumber.trim()
  if (num) {
    url.searchParams.set('licenseNumber', num)
  } else if (!options?.resolveByHost) {
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options?.apiKey) headers['Authorization'] = `Bearer ${options.apiKey}`

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const data = (await res.json()) as { license?: unknown; design?: Partial<DesignFromLicense> }
    if (!data?.design?.app_name) return null
    return {
      app_name: data.design.app_name,
      logo_url: data.design.logo_url ?? null,
      primary_color: data.design.primary_color ?? '#5b7895',
      secondary_color: data.design.secondary_color ?? null,
      favicon_url: data.design.favicon_url ?? null,
    }
  } catch {
    return null
  }
}

export const getDefaultAppName = (): string => DEFAULT_APP_NAME

/** Antwort der Lizenz-API (GET …/license) – für Kundenportal / Arbeitszeit-Portal. */
export type LicenseApiPayload = {
  license: {
    tier?: string
    valid_until?: string | null
    max_users?: number | null
    max_customers?: number | null
    max_storage_mb?: number | null
    features: Record<string, boolean>
    valid?: boolean
    expired?: boolean
    read_only?: boolean
    is_trial?: boolean
  }
  design: DesignFromLicense
  /** Optional: mandantenweise gepflegte Versionen/Release Notes pro App (Lizenzportal). */
  appVersions?: AppVersionsMap
}

/** Holt die vollständige Lizenz-Response (license + design) von der API. */
export type LicenseFullResponse = LicenseApiPayload

export const fetchLicenseFull = async (
  apiUrl: string,
  licenseNumber: string,
  options?: { timeoutMs?: number; apiKey?: string; resolveByHost?: boolean }
): Promise<LicenseFullResponse | null> => {
  const timeoutMs = options?.timeoutMs ?? 8_000
  const base = apiUrl.replace(/\/$/, '')
  const url = new URL(`${base}/license`)
  const num = licenseNumber.trim()
  if (num) {
    url.searchParams.set('licenseNumber', num)
  } else if (!options?.resolveByHost) {
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options?.apiKey) headers['Authorization'] = `Bearer ${options.apiKey}`

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const data = (await res.json()) as Partial<LicenseApiPayload> & { appVersions?: unknown }
    if (!data?.license?.features || !data?.design?.app_name) return null
    const appVersions =
      parseAppVersionsFromDb(data.appVersions) ??
      parseAppVersionsFromDb((data as { app_versions?: unknown }).app_versions)
    return {
      license: {
        tier: data.license.tier,
        valid_until: data.license.valid_until ?? null,
        max_users: data.license.max_users ?? null,
        max_customers: data.license.max_customers ?? null,
        max_storage_mb: data.license.max_storage_mb ?? null,
        features: data.license.features ?? {},
        valid: data.license.valid,
        expired: data.license.expired,
        read_only: data.license.read_only,
        is_trial: data.license.is_trial,
      },
      design: {
        app_name: data.design.app_name,
        logo_url: data.design.logo_url ?? null,
        primary_color: data.design.primary_color ?? '#5b7895',
        secondary_color: data.design.secondary_color ?? null,
        favicon_url: data.design.favicon_url ?? null,
      },
      ...(appVersions ? { appVersions } : {}),
    }
  } catch {
    return null
  }
}
