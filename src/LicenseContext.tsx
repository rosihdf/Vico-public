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
} from './lib/licensePortalApi'
import DesignApplier from './components/DesignApplier'
import type { AppVersionsMap } from '../shared/appVersions'

export type DesignConfig = {
  app_name: string
  logo_url: string | null
  primary_color: string
  secondary_color?: string | null
  favicon_url?: string | null
}

type LicenseContextType = {
  license: LicenseStatus | null
  design: DesignConfig | null
  /** Optional: mandantenweise gepflegte Versionen je App (Lizenz-API). */
  appVersions: AppVersionsMap | null
  isLoading: boolean
  /** true wenn Lizenz abgelaufen, aber innerhalb Schonfrist (Nur-Lesen). */
  readOnly: boolean
  /** Speichernutzung in MB (für 80%-Warnung). */
  storageUsageMb: number
  refresh: (options?: { force?: boolean }) => Promise<void>
}

const LicenseContext = createContext<LicenseContextType | null>(null)

const DEFAULT_DESIGN: DesignConfig = {
  app_name: 'AMRtech',
  logo_url: null,
  primary_color: '#5b7895',
  secondary_color: null,
  favicon_url: null,
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_WEEK = 7 * MS_PER_DAY

export const LicenseProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, userRole } = useAuth()
  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [design, setDesign] = useState<DesignConfig | null>(null)
  const [appVersions, setAppVersions] = useState<AppVersionsMap | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [storageUsageMb, setStorageUsageMb] = useState(0)

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force === true
    try {
      if (isLicenseApiConfigured()) {
        const licenseNumber = getStoredLicenseNumber()
        if (!licenseNumber) {
          setLicense(null)
          setDesign(null)
          setAppVersions(null)
          setStorageUsageMb(0)
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
            fetchUsageCounts().then((counts) => {
              setLicense((prev) => (prev ? { ...prev, ...counts } : null))
            }).catch((err) => console.warn('LicenseContext: fetchUsageCounts', err))
            if (base.max_storage_mb != null) {
              fetchStorageUsageMb().then(setStorageUsageMb).catch((err) => console.warn('LicenseContext: fetchStorageUsageMb', err))
            } else {
              setStorageUsageMb(0)
            }
            return
          }
          setIsLoading(true)
          const api = await fetchLicenseFromApi(licenseNumber, 8_000)
          if (api) {
            const base = mapApiToLicenseStatus(api)
            const [counts, usageMb] = await Promise.all([
              fetchUsageCounts(),
              base.max_storage_mb != null ? fetchStorageUsageMb() : Promise.resolve(0),
            ])
            setLicense({ ...base, ...counts })
            setStorageUsageMb(usageMb)
            setDesign({ ...DEFAULT_DESIGN, ...api.design })
            setAppVersions(api.appVersions ?? null)
            setLastLicenseCheck(now, licenseNumber)
            setStoredCheckInterval(api.license.check_interval ?? 'daily', licenseNumber)
            setCachedLicenseResponse(api, licenseNumber)
          } else {
            setLicense(null)
            setDesign(null)
            setAppVersions(null)
            setStorageUsageMb(0)
          }
          return
        }

        const cached = getCachedLicenseResponse(licenseNumber)
        if (!force && cached) {
          const base = mapApiToLicenseStatus(cached)
          setLicense({ ...base, current_customers: 0, current_users: 0 })
          setDesign({ ...DEFAULT_DESIGN, ...cached.design })
          setAppVersions(cached.appVersions ?? null)
          fetchUsageCounts().then((counts) => {
            setLicense((prev) => (prev ? { ...prev, ...counts } : null))
          }).catch(() => {})
          if (base.max_storage_mb != null) {
            fetchStorageUsageMb().then(setStorageUsageMb).catch((err) => console.warn('LicenseContext: fetchStorageUsageMb', err))
          } else {
            setStorageUsageMb(0)
          }
          fetchLicenseFromApi(licenseNumber, 8_000).then((api) => {
            if (api) {
              const base = mapApiToLicenseStatus(api)
              setLastLicenseCheck(Date.now(), licenseNumber)
              setStoredCheckInterval(api.license.check_interval ?? 'daily', licenseNumber)
              setCachedLicenseResponse(api, licenseNumber)
              setDesign({ ...DEFAULT_DESIGN, ...api.design })
              setAppVersions(api.appVersions ?? null)
              Promise.all([
                fetchUsageCounts(),
                base.max_storage_mb != null ? fetchStorageUsageMb() : Promise.resolve(0),
              ]).then(([counts, usageMb]) => {
                setLicense((prev) => (prev ? { ...base, ...counts } : null))
                setStorageUsageMb(usageMb)
              }).catch((err) => console.warn('LicenseContext: fetchUsageCounts/fetchStorageUsageMb', err))
            }
          }).catch((err) => console.warn('LicenseContext: fetchLicenseFromApi (background)', err))
          return
        }

        setIsLoading(true)
        const api = await fetchLicenseFromApi(licenseNumber, 8_000)
        if (api) {
          const base = mapApiToLicenseStatus(api)
          const counts = await fetchUsageCounts()
          setLicense({ ...base, ...counts })
          setDesign({ ...DEFAULT_DESIGN, ...api.design })
          setAppVersions(api.appVersions ?? null)
          setLastLicenseCheck(now, licenseNumber)
          setStoredCheckInterval(api.license.check_interval ?? 'daily', licenseNumber)
          setCachedLicenseResponse(api, licenseNumber)
        } else {
          setLicense(null)
          setDesign(null)
          setAppVersions(null)
        }
      } else {
        setIsLoading(true)
        const status = await fetchLicenseStatus()
        setLicense(status)
        setDesign(null)
        setAppVersions(null)
        if (status.max_storage_mb != null) {
          fetchStorageUsageMb().then(setStorageUsageMb).catch((err) => console.warn('LicenseContext: fetchStorageUsageMb', err))
        } else {
          setStorageUsageMb(0)
        }
      }
    } catch {
      setLicense(null)
      setDesign(null)
      setAppVersions(null)
      setStorageUsageMb(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || userRole === 'kunde') return
    refresh()
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

  const readOnly = license?.read_only === true

  return (
    <LicenseContext.Provider value={{ license, design, appVersions, isLoading, readOnly, storageUsageMb, refresh }}>
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
