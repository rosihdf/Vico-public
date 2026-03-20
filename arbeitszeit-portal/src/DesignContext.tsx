import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fetchLicenseFull, getDefaultAppName } from '../../shared/fetchDesignFromLicense'

type DesignContextType = {
  appName: string
  isLoading: boolean
  refresh: () => Promise<void>
  /** Lizenz-Features (standortabfrage, kundenportal, etc.) */
  features: Record<string, boolean>
}

const DesignContext = createContext<DesignContextType | null>(null)

export const useDesign = (): DesignContextType => {
  const ctx = useContext(DesignContext)
  if (!ctx) {
    return {
      appName: getDefaultAppName(),
      isLoading: false,
      refresh: async () => {},
      features: {},
    }
  }
  return ctx
}

export const DesignProvider = ({ children }: { children: React.ReactNode }) => {
  const [appName, setAppName] = useState(getDefaultAppName())
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    const apiUrl = (import.meta.env.VITE_LICENSE_API_URL ?? '').trim()
    const licenseNumber = (import.meta.env.VITE_LICENSE_NUMBER ?? '').trim()
    if (!apiUrl || !licenseNumber) {
      setAppName(getDefaultAppName())
      setFeatures({
        standortabfrage: true,
        arbeitszeiterfassung: true,
        kundenportal: false,
        historie: false,
      })
      setIsLoading(false)
      return
    }
    const apiKey = (import.meta.env.VITE_LICENSE_API_KEY ?? '').trim()
    const full = await fetchLicenseFull(apiUrl, licenseNumber, {
      apiKey: apiKey || undefined,
    })
    if (full?.design?.app_name) {
      setAppName(full.design.app_name)
    }
    if (full?.license?.features) {
      setFeatures(full.license.features)
    } else {
      setFeatures({})
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    document.title = `${appName} Arbeitszeitenportal`
  }, [appName])

  return (
    <DesignContext.Provider value={{ appName, isLoading, refresh: load, features }}>
      {children}
    </DesignContext.Provider>
  )
}
