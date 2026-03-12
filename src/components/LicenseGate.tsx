import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  isLicenseApiConfigured,
  getStoredLicenseNumber,
  fetchLicenseFromApi,
} from '../lib/licensePortalApi'
import { LoadingSpinner } from './LoadingSpinner'
import AktivierungsScreen from '../pages/AktivierungsScreen'

const PUBLIC_PATHS = ['/aktivierung', '/impressum', '/datenschutz']

type LicenseGateProps = {
  children: React.ReactNode
}

/**
 * Prüft Lizenz bei API-Modus (Mandantenfähigkeit).
 * Legacy-Modus (keine VITE_LICENSE_API_URL): Kinder werden direkt gerendert.
 */
const LicenseGate = ({ children }: LicenseGateProps) => {
  const location = useLocation()
  const [status, setStatus] = useState<'checking' | 'needs_activation' | 'ready'>('checking')

  useEffect(() => {
    if (PUBLIC_PATHS.some((p) => location.pathname.startsWith(p))) {
      setStatus('ready')
      return
    }

    if (!isLicenseApiConfigured()) {
      setStatus('ready')
      return
    }

    const check = async () => {
      const licenseNumber = getStoredLicenseNumber()
      if (!licenseNumber?.trim()) {
        setStatus('needs_activation')
        return
      }

      try {
        const data = await fetchLicenseFromApi(licenseNumber)
        if (!data || !data.license?.valid) {
          setStatus('needs_activation')
          return
        }
        setStatus('ready')
      } catch {
        setStatus('needs_activation')
      }
    }

    check()
  }, [location.pathname])

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#5b7895] dark:bg-slate-900">
        <LoadingSpinner message="Lizenz wird geprüft…" size="lg" variant="light" />
      </div>
    )
  }

  if (status === 'needs_activation') {
    return <AktivierungsScreen />
  }

  return <>{children}</>
}

export default LicenseGate
