/**
 * Holt Design (app_name, etc.) aus der Lizenz-API.
 * Für Portal und Arbeitszeitenportal – nutzt VITE_LICENSE_API_URL und VITE_LICENSE_NUMBER.
 */

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
  options?: { timeoutMs?: number; apiKey?: string }
): Promise<DesignFromLicense | null> => {
  const timeoutMs = options?.timeoutMs ?? 8_000
  const base = apiUrl.replace(/\/$/, '')
  const url = new URL(`${base}/license`)
  url.searchParams.set('licenseNumber', licenseNumber.trim())

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
