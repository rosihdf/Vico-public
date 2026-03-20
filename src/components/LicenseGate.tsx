import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  isLicenseApiConfigured,
  getStoredLicenseNumber,
  setStoredLicenseNumber,
  getCachedLicenseResponse,
  getCachedLicenseWithMeta,
  fetchLicenseFromApi,
  setCachedLicenseResponse,
} from '../lib/licensePortalApi'
import { getLicenseNumberFromDb } from '../lib/licenseService'
import { useAuth } from '../AuthContext'
import { LoadingSpinner } from './LoadingSpinner'
import AktivierungsScreen from '../pages/AktivierungsScreen'

const LOGIN_PATHS = ['/login', '/reset-password']
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
 * Reihenfolge: Ohne Lizenz zuerst Login anzeigen. Nach Login Lizenz aus DB holen.
 * Admin aktiviert Lizenz einmalig → alle Nutzer loggen sich ohne Lizenznummer-Eingabe ein.
 */
const LicenseGate = ({ children }: LicenseGateProps) => {
  const location = useLocation()
  const { isAuthenticated, userRole } = useAuth()
  const [status, setStatus] = useState<'checking' | 'needs_activation' | 'needs_admin' | 'ready'>('checking')

  useEffect(() => {
    if (PUBLIC_PATHS.some((p) => location.pathname.startsWith(p))) {
      setStatus('ready')
      return
    }

    if (!isLicenseApiConfigured()) {
      setStatus('ready')
      return
    }

    const storedLicense = getStoredLicenseNumber()
    if (storedLicense?.trim()) {
      // Lizenz in localStorage – bestehende Logik
      const cachedMeta = getCachedLicenseWithMeta(storedLicense)
      if (cachedMeta && isAllowed(cachedMeta.data) && Date.now() - cachedMeta.ts < CACHE_FRESH_MS) {
        setStatus('ready')
        return
      }
      if (cachedMeta && isAllowed(cachedMeta.data)) {
        setStatus('ready')
        fetchLicenseFromApi(storedLicense, 8_000).then((data) => {
          if (data) setCachedLicenseResponse(data, storedLicense)
        }).catch((err) => console.warn('LicenseGate: fetchLicenseFromApi', err))
        return
      }
      const doFetch = (retryCount = 0) =>
        fetchLicenseFromApi(storedLicense, 8_000)
          .then((data) => {
            if (isAllowed(data)) {
              if (data) setCachedLicenseResponse(data, storedLicense)
              setStatus('ready')
              return
            }
            const fallback = getCachedLicenseResponse(storedLicense)
            if (isAllowed(fallback)) setStatus('ready')
            else setStatus('needs_activation')
          })
          .catch((err) => {
            console.warn('LicenseGate: fetchLicenseFromApi', err)
            const fallback = getCachedLicenseResponse(storedLicense)
            if (isAllowed(fallback)) setStatus('ready')
            else if (retryCount < 1) setTimeout(() => doFetch(1), 2_000)
            else setStatus('needs_activation')
          })
      doFetch()
      return
    }

    // Keine Lizenz in localStorage
    if (LOGIN_PATHS.includes(location.pathname)) {
      setStatus('ready')
      return
    }

    if (isAuthenticated) {
      // Eingeloggt: Lizenz aus DB holen
      getLicenseNumberFromDb().then((dbLicense) => {
        if (dbLicense?.trim()) {
          setStoredLicenseNumber(dbLicense)
          const cachedMeta = getCachedLicenseWithMeta(dbLicense)
          if (cachedMeta && isAllowed(cachedMeta.data) && Date.now() - cachedMeta.ts < CACHE_FRESH_MS) {
            setStatus('ready')
            return
          }
          fetchLicenseFromApi(dbLicense, 8_000).then((data) => {
            if (isAllowed(data)) {
              if (data) setCachedLicenseResponse(data, dbLicense)
              setStatus('ready')
            } else if (userRole === 'admin') {
              setStatus('needs_activation')
            } else {
              setStatus('needs_admin')
            }
          }).catch((err) => {
            console.warn('LicenseGate: fetchLicenseFromApi (db license)', err)
            if (userRole === 'admin') setStatus('needs_activation')
            else setStatus('needs_admin')
          })
        } else if (userRole === 'admin') {
          setStatus('needs_activation')
        } else {
          setStatus('needs_admin')
        }
      }).catch((err) => {
        console.warn('LicenseGate: getLicenseNumberFromDb', err)
        if (userRole === 'admin') setStatus('needs_activation')
        else setStatus('needs_admin')
      })
      return
    }

    setStatus('ready')
  }, [location.pathname, isAuthenticated, userRole])

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#5b7895] dark:bg-slate-900">
        <LoadingSpinner message="Lizenz wird geprüft…" size="lg" variant="light" />
      </div>
    )
  }

  if (status === 'needs_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#5b7895] dark:bg-slate-900">
        <div className="max-w-sm min-w-0 p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-lg text-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Lizenz erforderlich</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Die Lizenz wurde noch nicht aktiviert. Bitte wenden Sie sich an Ihren Administrator.
          </p>
          <a
            href="/login"
            className="inline-block px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover"
          >
            Zum Login
          </a>
        </div>
      </div>
    )
  }

  if (status === 'needs_activation') {
    return <AktivierungsScreen />
  }

  return <>{children}</>
}

export default LicenseGate
