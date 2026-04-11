import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import {
  fetchLicenseStatus,
  fetchUsageCounts,
  fetchStorageUsageMb,
  mapApiToLicenseStatus,
  type LicenseStatus,
} from './lib/licenseService'
import {
  isLicenseApiConfigured,
  getStoredLicenseNumber,
  fetchLicenseFromApi,
  getLastLicenseCheck,
  setLastLicenseCheck,
  getStoredCheckInterval,
  setStoredCheckInterval,
  getCachedLicenseResponse,
  setCachedLicenseResponse,
  LICENSE_NUMBER_STORAGE_EVENT,
} from './lib/licensePortalApi'
import DesignApplier from './components/DesignApplier'
import type { AppVersionsMap } from '../shared/appVersions'
import type { MandantenReleasesApiPayload } from '../shared/mandantenReleaseApi'
import { parseMandantenReleasesPayload } from '../shared/mandantenReleaseApi'

export type DesignConfig = {
  app_name: string
  /** Mandanten-Name aus Lizenzportal (`tenants.name`) */
  tenant_name?: string | null
  logo_url: string | null
  kundenportal_url?: string | null
  primary_color: string
  secondary_color?: string | null
  favicon_url?: string | null
}

export type TenantMaintenanceInfo = {
  mode_enabled: boolean
  mode_message: string | null
  mode_starts_at: string | null
  mode_ends_at: string | null
  mode_duration_min: number | null
  mode_auto_end: boolean
  mode_apply_main_app: boolean
  mode_apply_arbeitszeit_portal: boolean
  mode_apply_customer_portal: boolean
  announcement_enabled: boolean
  announcement_message: string | null
  announcement_from: string | null
  announcement_until: string | null
}

type LicenseContextType = {
  license: LicenseStatus | null
  design: DesignConfig | null
  /** Optional: mandantenweise gepflegte Versionen je App (Lizenz-API). */
  appVersions: AppVersionsMap | null
  /** §11.20: Incoming-/Kanal-Info aus Lizenz-API */
  mandantenReleases: MandantenReleasesApiPayload | null
  maintenance: TenantMaintenanceInfo | null
  isLoading: boolean
  /** true wenn Lizenz abgelaufen, aber innerhalb Schonfrist (Nur-Lesen). */
  readOnly: boolean
  /** Speichernutzung in MB (für 80%-Warnung). */
  storageUsageMb: number
  /**
   * §11.18#6 / WP-NET-05: Lizenz-API zuletzt fehlgeschlagen; Anzeige aus lokalem Cache (nicht Mandanten-Degraded).
   */
  licensePortalStale: boolean
  refresh: (options?: { force?: boolean }) => Promise<void>
}

const LicenseContext = createContext<LicenseContextType | null>(null)

const DEFAULT_DESIGN: DesignConfig = {
  app_name: 'AMRtech',
  logo_url: null,
  kundenportal_url: null,
  primary_color: '#5b7895',
  secondary_color: null,
  favicon_url: null,
}

const mapMaintenance = (raw: unknown): TenantMaintenanceInfo | null => {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return {
    mode_enabled: Boolean(o.mode_enabled),
    mode_message: o.mode_message != null ? String(o.mode_message) : null,
    mode_starts_at: o.mode_starts_at != null ? String(o.mode_starts_at) : null,
    mode_ends_at: o.mode_ends_at != null ? String(o.mode_ends_at) : null,
    mode_duration_min:
      o.mode_duration_min != null && Number.isFinite(Number(o.mode_duration_min))
        ? Math.max(1, Math.floor(Number(o.mode_duration_min)))
        : null,
    mode_auto_end: Boolean(o.mode_auto_end),
    mode_apply_main_app: o.mode_apply_main_app !== false,
    mode_apply_arbeitszeit_portal: o.mode_apply_arbeitszeit_portal !== false,
    mode_apply_customer_portal: o.mode_apply_customer_portal !== false,
    announcement_enabled: Boolean(o.announcement_enabled),
    announcement_message: o.announcement_message != null ? String(o.announcement_message) : null,
    announcement_from: o.announcement_from != null ? String(o.announcement_from) : null,
    announcement_until: o.announcement_until != null ? String(o.announcement_until) : null,
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_WEEK = 7 * MS_PER_DAY
/** Abstand für Abgleich „client_config_version“ (Lizenzportal-Push) – unabhängig von daily/weekly */
const LICENSE_CLIENT_CONFIG_POLL_MS = 90_000

const mandantenReleasesFromApiField = (raw: unknown): MandantenReleasesApiPayload | null => {
  if (raw == null) return null
  return parseMandantenReleasesPayload(raw) ?? null
}

export const LicenseProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, userRole } = useAuth()
  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [design, setDesign] = useState<DesignConfig | null>(null)
  const [appVersions, setAppVersions] = useState<AppVersionsMap | null>(null)
  const [mandantenReleases, setMandantenReleases] = useState<MandantenReleasesApiPayload | null>(null)
  const [maintenance, setMaintenance] = useState<TenantMaintenanceInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [storageUsageMb, setStorageUsageMb] = useState(0)
  const [licensePortalStale, setLicensePortalStale] = useState(false)

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force === true

    const applyFromCachedApi = (licenseNumber: string, stale: boolean): boolean => {
      const cached = getCachedLicenseResponse(licenseNumber)
      if (!cached) {
        if (!stale) setLicensePortalStale(false)
        return false
      }
      const base = mapApiToLicenseStatus(cached)
      setLicense({ ...base, current_customers: 0, current_users: 0 })
      setDesign({ ...DEFAULT_DESIGN, ...cached.design })
      setAppVersions(cached.appVersions ?? null)
      setMandantenReleases(mandantenReleasesFromApiField(cached.mandantenReleases))
      setMaintenance(mapMaintenance(cached.maintenance))
      setLicensePortalStale(stale)
      fetchUsageCounts()
        .then((counts) => {
          setLicense((prev) => (prev ? { ...prev, ...counts } : null))
        })
        .catch((err) => console.warn('LicenseContext: fetchUsageCounts', err))
      if (base.max_storage_mb != null) {
        fetchStorageUsageMb().then(setStorageUsageMb).catch((err) => console.warn('LicenseContext: fetchStorageUsageMb', err))
      } else {
        setStorageUsageMb(0)
      }
      return true
    }

    try {
      if (isLicenseApiConfigured()) {
        const licenseNumber = getStoredLicenseNumber()
        if (!licenseNumber) {
          setLicense(null)
          setDesign(null)
          setAppVersions(null)
          setMandantenReleases(null)
          setMaintenance(null)
          setStorageUsageMb(0)
          setLicensePortalStale(false)
          return
        }

        const interval = force ? null : getStoredCheckInterval(licenseNumber)
        const lastCheck = force ? null : getLastLicenseCheck(licenseNumber)
        const now = Date.now()

        const shouldSkipApi =
          interval === 'daily' && lastCheck !== null && now - lastCheck < MS_PER_DAY
        const shouldSkipWeekly =
          interval === 'weekly' && lastCheck !== null && now - lastCheck < MS_PER_WEEK

        if (!force && (shouldSkipApi || shouldSkipWeekly)) {
          const cached = getCachedLicenseResponse(licenseNumber)
          if (cached) {
            setStoredCheckInterval(cached.license.check_interval ?? 'daily', licenseNumber)
            const base = mapApiToLicenseStatus(cached)
            setLicense({ ...base, current_customers: 0, current_users: 0 })
            setDesign({ ...DEFAULT_DESIGN, ...cached.design })
            setAppVersions(cached.appVersions ?? null)
            setMandantenReleases(mandantenReleasesFromApiField(cached.mandantenReleases))
            setMaintenance(mapMaintenance(cached.maintenance))
            fetchUsageCounts().then((counts) => {
              setLicense((prev) => (prev ? { ...prev, ...counts } : null))
            }).catch((err) => console.warn('LicenseContext: fetchUsageCounts', err))
            if (base.max_storage_mb != null) {
              fetchStorageUsageMb().then(setStorageUsageMb).catch((err) => console.warn('LicenseContext: fetchStorageUsageMb', err))
            } else {
              setStorageUsageMb(0)
            }
            setLicensePortalStale(false)
            return
          }
          setIsLoading(true)
          const api = await fetchLicenseFromApi(licenseNumber, 8_000)
          if (api) {
            setLicensePortalStale(false)
            const base = mapApiToLicenseStatus(api)
            const [counts, usageMb] = await Promise.all([
              fetchUsageCounts(),
              base.max_storage_mb != null ? fetchStorageUsageMb() : Promise.resolve(0),
            ])
            setLicense({ ...base, ...counts })
            setStorageUsageMb(usageMb)
            setDesign({ ...DEFAULT_DESIGN, ...api.design })
            setAppVersions(api.appVersions ?? null)
            setMandantenReleases(mandantenReleasesFromApiField(api.mandantenReleases))
            setMaintenance(mapMaintenance(api.maintenance))
            setLastLicenseCheck(now, licenseNumber)
            setStoredCheckInterval(api.license.check_interval ?? 'daily', licenseNumber)
            setCachedLicenseResponse(api, licenseNumber)
          } else if (!applyFromCachedApi(licenseNumber, true)) {
            setLicense(null)
            setDesign(null)
            setAppVersions(null)
            setMandantenReleases(null)
            setMaintenance(null)
            setStorageUsageMb(0)
            setLicensePortalStale(false)
          }
          return
        }

        const cached = getCachedLicenseResponse(licenseNumber)
        if (!force && cached) {
          const base = mapApiToLicenseStatus(cached)
          setLicense({ ...base, current_customers: 0, current_users: 0 })
          setDesign({ ...DEFAULT_DESIGN, ...cached.design })
          setAppVersions(cached.appVersions ?? null)
          setMandantenReleases(mandantenReleasesFromApiField(cached.mandantenReleases))
          setMaintenance(mapMaintenance(cached.maintenance))
          setLicensePortalStale(false)
          fetchUsageCounts().then((counts) => {
            setLicense((prev) => (prev ? { ...prev, ...counts } : null))
          }).catch(() => {})
          if (base.max_storage_mb != null) {
            fetchStorageUsageMb().then(setStorageUsageMb).catch((err) => console.warn('LicenseContext: fetchStorageUsageMb', err))
          } else {
            setStorageUsageMb(0)
          }
          fetchLicenseFromApi(licenseNumber, 8_000)
            .then((api) => {
              if (api) {
                setLicensePortalStale(false)
                const base = mapApiToLicenseStatus(api)
                setLastLicenseCheck(Date.now(), licenseNumber)
                setStoredCheckInterval(api.license.check_interval ?? 'daily', licenseNumber)
                setCachedLicenseResponse(api, licenseNumber)
                setDesign({ ...DEFAULT_DESIGN, ...api.design })
                setAppVersions(api.appVersions ?? null)
                setMandantenReleases(mandantenReleasesFromApiField(api.mandantenReleases))
                setMaintenance(mapMaintenance(api.maintenance))
                Promise.all([
                  fetchUsageCounts(),
                  base.max_storage_mb != null ? fetchStorageUsageMb() : Promise.resolve(0),
                ])
                  .then(([counts, usageMb]) => {
                    setLicense((prev) => (prev ? { ...base, ...counts } : null))
                    setStorageUsageMb(usageMb)
                  })
                  .catch((err) => console.warn('LicenseContext: fetchUsageCounts/fetchStorageUsageMb', err))
              } else {
                setLicensePortalStale(true)
              }
            })
            .catch((err) => {
              console.warn('LicenseContext: fetchLicenseFromApi (background)', err)
              setLicensePortalStale(true)
            })
          return
        }

        setIsLoading(true)
        const api = await fetchLicenseFromApi(licenseNumber, 8_000)
        if (api) {
          setLicensePortalStale(false)
          const base = mapApiToLicenseStatus(api)
          const counts = await fetchUsageCounts()
          setLicense({ ...base, ...counts })
          setDesign({ ...DEFAULT_DESIGN, ...api.design })
          setAppVersions(api.appVersions ?? null)
          setMandantenReleases(mandantenReleasesFromApiField(api.mandantenReleases))
          setMaintenance(mapMaintenance(api.maintenance))
          setLastLicenseCheck(now, licenseNumber)
          setStoredCheckInterval(api.license.check_interval ?? 'daily', licenseNumber)
          setCachedLicenseResponse(api, licenseNumber)
        } else if (!applyFromCachedApi(licenseNumber, true)) {
          setLicense(null)
          setDesign(null)
          setAppVersions(null)
          setMandantenReleases(null)
          setMaintenance(null)
          setLicensePortalStale(false)
        }
      } else {
        setIsLoading(true)
        const status = await fetchLicenseStatus()
        setLicense(status)
        setDesign(null)
        setAppVersions(null)
        setMandantenReleases(null)
        setMaintenance(null)
        setLicensePortalStale(false)
        if (status.max_storage_mb != null) {
          fetchStorageUsageMb().then(setStorageUsageMb).catch((err) => console.warn('LicenseContext: fetchStorageUsageMb', err))
        } else {
          setStorageUsageMb(0)
        }
      }
    } catch {
      const licenseNumber = getStoredLicenseNumber()
      if (!licenseNumber || !applyFromCachedApi(licenseNumber, true)) {
        setLicense(null)
        setDesign(null)
        setAppVersions(null)
        setMandantenReleases(null)
        setMaintenance(null)
        setStorageUsageMb(0)
        setLicensePortalStale(false)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || userRole === 'kunde') return
    refresh()
  }, [isAuthenticated, userRole, refresh])

  /** Nach Lizenz-Aktivierung (localStorage) — ohne Full-Reload; isAuthenticated ändert sich nicht. */
  useEffect(() => {
    if (!isAuthenticated || userRole === 'kunde') return
    if (!isLicenseApiConfigured()) return
    const onLicenseStorage = () => {
      void refresh({ force: true })
    }
    window.addEventListener(LICENSE_NUMBER_STORAGE_EVENT, onLicenseStorage)
    return () => window.removeEventListener(LICENSE_NUMBER_STORAGE_EVENT, onLicenseStorage)
  }, [isAuthenticated, userRole, refresh])

  /**
   * Regelmäßige Aktualisierung der Lizenz-/Wartungsdaten:
   * - Intervall (60s): hält Wartungsmodus/Ankündigung zeitnah
   * - Beim Tab-Fokus sofort nachziehen
   */
  useEffect(() => {
    if (!isAuthenticated || userRole === 'kunde') return
    if (!isLicenseApiConfigured()) return

    const id = window.setInterval(() => {
      void refresh()
    }, 60_000)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isAuthenticated, userRole, refresh])

  useEffect(() => {
    if (!license?.check_interval || license.check_interval === 'on_start') return
    const licenseNumber = getStoredLicenseNumber()
    if (!licenseNumber) return
    const lastCheck = getLastLicenseCheck(licenseNumber)
    if (lastCheck === null) return

    const now = Date.now()
    const msUntilNext =
      license.check_interval === 'daily'
        ? MS_PER_DAY - (now - lastCheck)
        : MS_PER_WEEK - (now - lastCheck)

    if (msUntilNext <= 0) return

    const id = setTimeout(() => refresh(), msUntilNext)
    return () => clearTimeout(id)
  }, [license?.check_interval, refresh])

  /**
   * Wenn das Lizenzportal `client_config_version` erhöht (Button „an Apps signalisieren“),
   * erkennen wir das hier – ohne auf daily/weekly zu warten.
   */
  useEffect(() => {
    if (!isAuthenticated || userRole === 'kunde') return
    if (!isLicenseApiConfigured()) return

    const checkClientConfigVersion = async () => {
      const licenseNumber = getStoredLicenseNumber()
      if (!licenseNumber) return
      const cached = getCachedLicenseResponse(licenseNumber)
      const prev = Math.max(0, Math.floor(Number(cached?.license?.client_config_version) || 0))
      const api = await fetchLicenseFromApi(licenseNumber, 8_000, { bustCache: true })
      if (!api?.license) return
      const next = Math.max(0, Math.floor(Number(api.license.client_config_version) || 0))
      if (next !== prev) {
        await refresh({ force: true })
      }
    }

    const id = window.setInterval(() => {
      void checkClientConfigVersion()
    }, LICENSE_CLIENT_CONFIG_POLL_MS)

    /** Einmal kurz nach Start: Admin-Push muss nicht bis zum ersten 90s-Takt warten */
    const kickoff = window.setTimeout(() => void checkClientConfigVersion(), 5_000)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkClientConfigVersion()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(id)
      window.clearTimeout(kickoff)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isAuthenticated, userRole, refresh])

  const readOnly = license?.read_only === true

  return (
    <LicenseContext.Provider
      value={{
        license,
        design,
        appVersions,
        mandantenReleases,
        maintenance,
        isLoading,
        readOnly,
        storageUsageMb,
        licensePortalStale,
        refresh,
      }}
    >
      <DesignApplier />
      {children}
    </LicenseContext.Provider>
  )
}

export const useLicense = (): LicenseContextType => {
  const ctx = useContext(LicenseContext)
  if (!ctx) {
    throw new Error('useLicense must be used within LicenseProvider')
  }
  return ctx
}

export const useLicenseOptional = (): LicenseContextType | null => {
  return useContext(LicenseContext)
}
