import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fetchLicenseFull, getDefaultAppName } from '../../shared/fetchDesignFromLicense'
import { applyVicoPrimaryCssVars, clearVicoPrimaryCssVars } from '../../shared/vicoCssPrimary'
import { TIER_DEFAULT_FEATURES } from '../../shared/licenseFeatures'
import type { AppVersionEntry } from '../../shared/appVersions'
import { useLicenseClientConfigVersionPoll } from '../../shared/useLicenseClientConfigVersionPoll'
import type { TenantMaintenanceApiShape } from '../../shared/tenantMaintenanceMode'
import type { MandantenReleasesApiPayload } from '../../shared/mandantenReleaseApi'

type DesignContextType = {
  appName: string
  logoUrl: string | null
  /** Optional: Version/Release Notes aus Lizenz-API (`appVersions.arbeitszeit_portal`). */
  appVersionInfo: AppVersionEntry | null
  isLoading: boolean
  /** Lizenz-Features (effektiv inkl. Tier-Defaults) */
  features: Record<string, boolean>
  maintenance: TenantMaintenanceApiShape | null
  mandantenReleases: MandantenReleasesApiPayload | null
  refresh: () => Promise<void>
}

const DesignContext = createContext<DesignContextType | null>(null)

export const useDesign = (): DesignContextType => {
  const ctx = useContext(DesignContext)
  if (!ctx) {
    return {
      appName: getDefaultAppName(),
      logoUrl: null,
      appVersionInfo: null,
      isLoading: false,
      features: {},
      maintenance: null,
      mandantenReleases: null,
      refresh: async () => {},
    }
  }
  return ctx
}

export const DesignProvider = ({ children }: { children: React.ReactNode }) => {
  const [appName, setAppName] = useState(getDefaultAppName())
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [appVersionInfo, setAppVersionInfo] = useState<AppVersionEntry | null>(null)
  const [maintenance, setMaintenance] = useState<TenantMaintenanceApiShape | null>(null)
  const [mandantenReleases, setMandantenReleases] = useState<MandantenReleasesApiPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    const apiUrl = (import.meta.env.VITE_LICENSE_API_URL ?? '').trim()
    const licenseNumber = (import.meta.env.VITE_LICENSE_NUMBER ?? '').trim()
    if (!apiUrl) {
      setAppName(getDefaultAppName())
      setLogoUrl(null)
      setAppVersionInfo(null)
      setMaintenance(null)
      setMandantenReleases(null)
      setFeatures(TIER_DEFAULT_FEATURES.professional)
      applyVicoPrimaryCssVars('#5b7895')
      setIsLoading(false)
      return
    }
    const apiKey = (import.meta.env.VITE_LICENSE_API_KEY ?? '').trim()
    const full = await fetchLicenseFull(apiUrl, licenseNumber, {
      apiKey: apiKey || undefined,
      resolveByHost: !licenseNumber,
    })
    if (!full?.design) {
      setAppName(getDefaultAppName())
      setLogoUrl(null)
      setAppVersionInfo(null)
      setMaintenance(null)
      setMandantenReleases(null)
      setFeatures({})
      applyVicoPrimaryCssVars('#5b7895')
    } else {
      setMaintenance(full.maintenance ?? null)
      setMandantenReleases(full.mandantenReleases ?? null)
      setAppVersionInfo(full.appVersions?.arbeitszeit_portal ?? null)
      if (full.design.app_name) setAppName(full.design.app_name)
      setLogoUrl(full.design.logo_url?.trim() ? full.design.logo_url.trim() : null)
      applyVicoPrimaryCssVars(full.design.primary_color)
      setFeatures(full.license.features ?? {})
    }
    setIsLoading(false)
  }, [])

  const fetchClientConfigVersion = useCallback(async (): Promise<number | null> => {
    const apiUrl = (import.meta.env.VITE_LICENSE_API_URL ?? '').trim()
    const licenseNumber = (import.meta.env.VITE_LICENSE_NUMBER ?? '').trim()
    if (!apiUrl) return null
    const apiKey = (import.meta.env.VITE_LICENSE_API_KEY ?? '').trim()
    const full = await fetchLicenseFull(apiUrl, licenseNumber, {
      apiKey: apiKey || undefined,
      resolveByHost: !licenseNumber,
    })
    if (!full?.license) return null
    return Math.max(0, Math.floor(Number(full.license.client_config_version) || 0))
  }, [])

  useLicenseClientConfigVersionPoll({
    enabled: Boolean((import.meta.env.VITE_LICENSE_API_URL ?? '').trim()),
    fetchVersion: fetchClientConfigVersion,
    onVersionChanged: load,
  })

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    document.title = `${appName} Arbeitszeitenportal`
  }, [appName])

  useEffect(() => {
    return () => {
      clearVicoPrimaryCssVars()
    }
  }, [])

  return (
    <DesignContext.Provider
      value={{
        appName,
        logoUrl,
        appVersionInfo,
        isLoading,
        features,
        maintenance,
        mandantenReleases,
        refresh: load,
      }}
    >
      {children}
    </DesignContext.Provider>
  )
}
