import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  isLicenseApiConfigured,
  getStoredLicenseNumber,
  setStoredLicenseNumber,
  getCachedLicenseResponse,
  getCachedLicenseWithMeta,
  fetchLicenseFromApi,
  fetchLicenseFromApiByHost,
  getEnvEmbeddedLicenseNumber,
  formatLicenseNumberInput,
  setCachedLicenseResponse,
} from '../lib/licensePortalApi'
import { getLicenseNumberFromDb, setLicenseNumberInDb } from '../lib/licenseService'
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
 * Reihenfolge: Ohne Lizenz zuerst Login. Nach Login: Lizenznummer aus Mandanten-DB,
 * sonst Host-Lookup (Lizenz-API wie Portale) oder `VITE_LICENSE_NUMBER`.
 * Admin kann fehlende DB-Zeile per Host-Lookup nachziehen; manuelle Aktivierung nur Fallback.
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
      void (async () => {
        try {
          const fromDb = (await getLicenseNumberFromDb())?.trim() || null
          let effective = fromDb
          if (!effective) {
            effective = getEnvEmbeddedLicenseNumber()
          }
          if (!effective) {
            const hostResp = await fetchLicenseFromApiByHost(8_000)
            const raw = hostResp?.license_number?.trim()
            if (raw) {
              effective = formatLicenseNumberInput(raw)
            }
          }
          if (!effective) {
            if (userRole === 'admin') setStatus('needs_activation')
            else setStatus('needs_admin')
            return
          }

          setStoredLicenseNumber(effective)

          if (!fromDb && userRole === 'admin') {
            const { error } = await setLicenseNumberInDb(effective)
            if (error) {
              console.warn('[LicenseGate] Lizenznummer konnte nicht in Mandanten-DB gespeichert werden:', error)
            }
          }

          const cachedMeta = getCachedLicenseWithMeta(effective)
          if (cachedMeta && isAllowed(cachedMeta.data) && Date.now() - cachedMeta.ts < CACHE_FRESH_MS) {
            setStatus('ready')
            return
          }
          const data = await fetchLicenseFromApi(effective, 8_000)
          if (isAllowed(data)) {
            if (data) setCachedLicenseResponse(data, effective)
            setStatus('ready')
          } else if (userRole === 'admin') {
            setStatus('needs_activation')
          } else {
            setStatus('needs_admin')
          }
        } catch (err) {
          console.warn('LicenseGate: Lizenz nach Login', err)
          if (userRole === 'admin') setStatus('needs_activation')
          else setStatus('needs_admin')
        }
      })()
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
