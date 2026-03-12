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
  refresh: () => Promise<void>
}

const LicenseContext = createContext<LicenseContextType | null>(null)

const DEFAULT_DESIGN: DesignConfig = {
  app_name: 'Vico',
  logo_url: null,
  primary_color: '#5b7895',
  secondary_color: null,
  favicon_url: null,
}

export const LicenseProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, userRole } = useAuth()
  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [design, setDesign] = useState<DesignConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      if (isLicenseApiConfigured()) {
        const licenseNumber = getStoredLicenseNumber()
        if (licenseNumber) {
          const api = await fetchLicenseFromApi(licenseNumber)
          if (api) {
            const base = mapApiToLicenseStatus(api)
            const counts = await fetchUsageCounts()
            setLicense({ ...base, ...counts })
            setDesign({ ...DEFAULT_DESIGN, ...api.design })
          } else {
            setLicense(null)
            setDesign(null)
          }
        } else {
          setLicense(null)
          setDesign(null)
        }
      } else {
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

  return (
    <LicenseContext.Provider value={{ license, design, isLoading, refresh }}>
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
