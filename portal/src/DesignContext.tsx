import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fetchLicenseFull, getDefaultAppName } from '../../shared/fetchDesignFromLicense'
import { applyVicoPrimaryCssVars, clearVicoPrimaryCssVars } from '../../shared/vicoCssPrimary'
import type { AppVersionEntry } from '../../shared/appVersions'
import { useLicenseClientConfigVersionPoll } from '../../shared/useLicenseClientConfigVersionPoll'

type DesignContextType = {
  appName: string
  /** Mandanten-Logo aus Lizenz-API (design.logo_url) */
  logoUrl: string | null
  /** Optional: Version/Release Notes für dieses Portal aus Lizenz-API (`appVersions.kundenportal`). */
  appVersionInfo: AppVersionEntry | null
  isLoading: boolean
  /** Lizenz-Features (nur explizit in Lizenz/Lizenzmodell gesetzt) */
  features: Record<string, boolean>
  /** false, wenn Lizenz-API konfiguriert ist und Modul „Kundenportal“ nicht gebucht ist */
  kundenportalAllowed: boolean
  /** Lizenz-API war konfiguriert, Antwort aber fehlgeschlagen (Netzwerk o. Ä.) */
  licenseLoadError: string | null
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
      kundenportalAllowed: true,
      licenseLoadError: null,
      refresh: async () => {},
    }
  }
  return ctx
}

export const DesignProvider = ({ children }: { children: React.ReactNode }) => {
  const [appName, setAppName] = useState(getDefaultAppName())
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [kundenportalAllowed, setKundenportalAllowed] = useState(true)
  const [licenseLoadError, setLicenseLoadError] = useState<string | null>(null)
  const [appVersionInfo, setAppVersionInfo] = useState<AppVersionEntry | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    const apiUrl = (import.meta.env.VITE_LICENSE_API_URL ?? '').trim()
    const licenseNumber = (import.meta.env.VITE_LICENSE_NUMBER ?? '').trim()
    if (!apiUrl) {
      setAppName(getDefaultAppName())
      setLogoUrl(null)
      setFeatures({})
      setKundenportalAllowed(true)
      setLicenseLoadError(null)
      setAppVersionInfo(null)
      applyVicoPrimaryCssVars('#5b7895')
      setIsLoading(false)
      return
    }
    setLicenseLoadError(null)
    const apiKey = (import.meta.env.VITE_LICENSE_API_KEY ?? '').trim()
    const full = await fetchLicenseFull(apiUrl, licenseNumber, {
      apiKey: apiKey || undefined,
      /** Ohne VITE_LICENSE_NUMBER: Lizenz-API ermittelt Mandant per Browser-Origin (Host-Lookup). */
      resolveByHost: !licenseNumber,
    })
    if (!full?.design) {
      setAppName(getDefaultAppName())
      setLogoUrl(null)
      setFeatures({})
      setKundenportalAllowed(false)
      setLicenseLoadError('Lizenz konnte nicht geladen werden. Bitte Konfiguration prüfen.')
      setAppVersionInfo(null)
      applyVicoPrimaryCssVars('#5b7895')
      setIsLoading(false)
      return
    }
    setAppVersionInfo(full.appVersions?.kundenportal ?? null)
    if (full.design.app_name) setAppName(full.design.app_name)
    setLogoUrl(full.design.logo_url?.trim() ? full.design.logo_url.trim() : null)
    applyVicoPrimaryCssVars(full.design.primary_color)
    const raw = full.license.features ?? {}
    setFeatures(raw)
    setKundenportalAllowed(raw.kundenportal === true)
    setLicenseLoadError(null)
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
    document.title = `${appName} Kundenportal`
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
        kundenportalAllowed,
        licenseLoadError,
        refresh: load,
      }}
    >
      {children}
    </DesignContext.Provider>
  )
}
