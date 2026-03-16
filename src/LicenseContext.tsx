import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import {
  fetchLicenseStatus,
  fetchUsageCounts,
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
  isLoading: boolean
  /** true wenn Lizenz abgelaufen, aber innerhalb Schonfrist (Nur-Lesen). */
  readOnly: boolean
  refresh: (options?: { force?: boolean }) => Promise<void>
}

const LicenseContext = createContext<LicenseContextType | null>(null)

const DEFAULT_DESIGN: DesignConfig = {
  app_name: 'Vico',
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
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force === true
    try {
      if (isLicenseApiConfigured()) {
        const licenseNumber = getStoredLicenseNumber()
        if (!licenseNumber) {
          setLicense(null)
          setDesign(null)
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
            fetchUsageCounts().then((counts) => {
              setLicense((prev) => (prev ? { ...prev, ...counts } : null))
            }).catch(() => {})
            return
          }
          setIsLoading(true)
          const api = await fetchLicenseFromApi(licenseNumber, 8_000)
          if (api) {
            const base = mapApiToLicenseStatus(api)
            const counts = await fetchUsageCounts()
            setLicense({ ...base, ...counts })
            setDesign({ ...DEFAULT_DESIGN, ...api.design })
            setLastLicenseCheck(now, licenseNumber)
            setStoredCheckInterval(api.license.check_interval ?? 'daily', licenseNumber)
            setCachedLicenseResponse(api, licenseNumber)
          } else {
            setLicense(null)
            setDesign(null)
          }
          return
        }

        const cached = getCachedLicenseResponse(licenseNumber)
        if (!force && cached) {
          const base = mapApiToLicenseStatus(cached)
          setLicense({ ...base, current_customers: 0, current_users: 0 })
          setDesign({ ...DEFAULT_DESIGN, ...cached.design })
          fetchUsageCounts().then((counts) => {
            setLicense((prev) => (prev ? { ...prev, ...counts } : null))
          }).catch(() => {})
          fetchLicenseFromApi(licenseNumber, 8_000).then((api) => {
            if (api) {
              const base = mapApiToLicenseStatus(api)
              setLastLicenseCheck(Date.now(), licenseNumber)
              setStoredCheckInterval(api.license.check_interval ?? 'daily', licenseNumber)
              setCachedLicenseResponse(api, licenseNumber)
              setDesign({ ...DEFAULT_DESIGN, ...api.design })
              fetchUsageCounts().then((counts) => {
                setLicense((prev) => (prev ? { ...base, ...counts } : null))
              }).catch(() => {})
            }
          }).catch(() => {})
          return
        }

        setIsLoading(true)
        const api = await fetchLicenseFromApi(licenseNumber, 8_000)
        if (api) {
          const base = mapApiToLicenseStatus(api)
          const counts = await fetchUsageCounts()
          setLicense({ ...base, ...counts })
          setDesign({ ...DEFAULT_DESIGN, ...api.design })
          setLastLicenseCheck(now, licenseNumber)
          setStoredCheckInterval(api.license.check_interval ?? 'daily', licenseNumber)
          setCachedLicenseResponse(api, licenseNumber)
        } else {
          setLicense(null)
          setDesign(null)
        }
      } else {
        setIsLoading(true)
        const status = await fetchLicenseStatus()
        setLicense(status)
        setDesign(null)
      }
    } catch {
      setLicense(null)
      setDesign(null)
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
    <LicenseContext.Provider value={{ license, design, isLoading, readOnly, refresh }}>
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
