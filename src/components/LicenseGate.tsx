import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  isLicenseApiConfigured,
  getStoredLicenseNumber,
  getCachedLicenseResponse,
  getCachedLicenseWithMeta,
  fetchLicenseFromApi,
  setCachedLicenseResponse,
} from '../lib/licensePortalApi'
import { LoadingSpinner } from './LoadingSpinner'
import AktivierungsScreen from '../pages/AktivierungsScreen'

const PUBLIC_PATHS = ['/aktivierung', '/impressum', '/datenschutz']

/** Cache frisch genug für sofort „ready“ ohne API-Call (5 Min). */
const CACHE_FRESH_MS = 5 * 60 * 1000

const isAllowed = (data: { license?: { valid?: boolean; read_only?: boolean } } | null) =>
  data?.license?.valid === true || data?.license?.read_only === true

type LicenseGateProps = {
  children: React.ReactNode
}

/**
 * Prüft Lizenz bei API-Modus (Mandantenfähigkeit).
 * Legacy-Modus (keine VITE_LICENSE_API_URL): Kinder werden direkt gerendert.
 * Optimiert: Cache zuerst nutzen (sofort ready), API nur bei Bedarf mit Retry.
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

    const licenseNumber = getStoredLicenseNumber()
    if (!licenseNumber?.trim()) {
      setStatus('needs_activation')
      return
    }

    // Cache zuerst: Wenn gültig und frisch (< 5 Min), sofort ready – kein API-Block
    const cachedMeta = getCachedLicenseWithMeta(licenseNumber)
    if (cachedMeta && isAllowed(cachedMeta.data) && Date.now() - cachedMeta.ts < CACHE_FRESH_MS) {
      setStatus('ready')
      return
    }

    // Cache gültig aber älter: Sofort ready, API im Hintergrund zur Aktualisierung
    if (cachedMeta && isAllowed(cachedMeta.data)) {
      setStatus('ready')
      fetchLicenseFromApi(licenseNumber, 8_000).then((data) => {
        if (data) setCachedLicenseResponse(data, licenseNumber)
      }).catch(() => {})
      return
    }

    // Kein gültiger Cache: API-Call mit Retry (1× nach 2s)
    const doFetch = (retryCount = 0) =>
      fetchLicenseFromApi(licenseNumber, 8_000)
        .then((data) => {
          if (isAllowed(data)) {
            if (data) setCachedLicenseResponse(data, licenseNumber)
            setStatus('ready')
            return
          }
          const fallback = getCachedLicenseResponse(licenseNumber)
          if (isAllowed(fallback)) setStatus('ready')
          else setStatus('needs_activation')
        })
        .catch(() => {
          const fallback = getCachedLicenseResponse(licenseNumber)
          if (isAllowed(fallback)) setStatus('ready')
          else if (retryCount < 1) setTimeout(() => doFetch(1), 2_000)
          else setStatus('needs_activation')
        })

    doFetch()
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
