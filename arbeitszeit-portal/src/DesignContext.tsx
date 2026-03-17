import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fetchDesignFromLicense, getDefaultAppName } from '../../shared/fetchDesignFromLicense'

type DesignContextType = {
  appName: string
  isLoading: boolean
  refresh: () => Promise<void>
}

const DesignContext = createContext<DesignContextType | null>(null)

export const useDesign = (): DesignContextType => {
  const ctx = useContext(DesignContext)
  if (!ctx) {
    return {
      appName: getDefaultAppName(),
      isLoading: false,
      refresh: async () => {},
    }
  }
  return ctx
}

export const DesignProvider = ({ children }: { children: React.ReactNode }) => {
  const [appName, setAppName] = useState(getDefaultAppName())
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    const apiUrl = (import.meta.env.VITE_LICENSE_API_URL ?? '').trim()
    const licenseNumber = (import.meta.env.VITE_LICENSE_NUMBER ?? '').trim()
    if (!apiUrl || !licenseNumber) {
      setAppName(getDefaultAppName())
      setIsLoading(false)
      return
    }
    const apiKey = (import.meta.env.VITE_LICENSE_API_KEY ?? '').trim()
    const design = await fetchDesignFromLicense(apiUrl, licenseNumber, {
      apiKey: apiKey || undefined,
    })
    if (design?.app_name) {
      setAppName(design.app_name)
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
    <DesignContext.Provider value={{ appName, isLoading, refresh: load }}>
      {children}
    </DesignContext.Provider>
  )
}
