import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { fetchLicenseStatus, type LicenseStatus } from './lib/licenseService'

type LicenseContextType = {
  license: LicenseStatus | null
  isLoading: boolean
  refresh: () => Promise<void>
}

const LicenseContext = createContext<LicenseContextType | null>(null)

export const LicenseProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, userRole } = useAuth()
  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const status = await fetchLicenseStatus()
      setLicense(status)
    } catch {
      setLicense(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || userRole === 'kunde') return
    refresh()
  }, [isAuthenticated, userRole, refresh])

  return (
    <LicenseContext.Provider value={{ license, isLoading, refresh }}>
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
