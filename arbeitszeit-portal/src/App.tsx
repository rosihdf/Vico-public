import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase, warmUpConnection } from './lib/supabase'
import { withTimeoutReject, checkRole } from '../../shared/authUtils'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import Layout from './components/Layout'
import Login from './pages/Login'
import { useDesign } from './DesignContext'
import UpdateBanner from '../../shared/UpdateBanner'
import ThemePreferenceSync from './components/ThemePreferenceSync'

const Uebersicht = lazy(() => import('./pages/Uebersicht'))
const AlleZeiten = lazy(() => import('./pages/AlleZeiten'))
const UrlaubPage = lazy(() => import('./pages/Urlaub'))
const Log = lazy(() => import('./pages/Log'))
const Stammdaten = lazy(() => import('./pages/Stammdaten'))
const Standort = lazy(() => import('./pages/Standort'))
const AppInfo = lazy(() => import('./pages/AppInfo'))

const PORTAL_ALLOWED_ROLES = ['admin', 'teamleiter'] as const
const AUTH_TIMEOUT_MS = 30_000
const RETRY_DELAY_MS = 2_000
const MAX_RETRIES = 2

const checkCanAccessPortal = () =>
  checkRole(supabase, PORTAL_ALLOWED_ROLES)

const withTimeout = <T,>(p: Promise<T>) =>
  withTimeoutReject(p, AUTH_TIMEOUT_MS, 'Zeitüberschreitung')

const isNetworkError = (msg: string) =>
  msg === 'Zeitüberschreitung' ||
  msg.includes('fetch') ||
  msg.includes('network') ||
  msg.includes('Failed')

const UrlaubRoute = () => {
  const { features } = useDesign()
  if (features.urlaub !== true) return <Navigate to="/" replace />
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <div className="w-6 h-6 border-2 border-vico-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <UrlaubPage />
    </Suspense>
  )
}

const App = () => {
  const { appVersionInfo } = useDesign()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [canAccess, setCanAccess] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [loadingHint, setLoadingHint] = useState<string | null>(null)
  const authInFlight = useRef(false)

  const initAuth = useCallback(async (isRetry = false, retryCount = 0) => {
    if (authInFlight.current && !isRetry) return
    authInFlight.current = true
    let isRetrying = false
    if (!isRetry) {
      setAuthError(null)
      setLoadingHint(null)
    }
    try {
      const { data: { session } } = await withTimeout(supabase.auth.getSession())
      const u = session?.user ?? null
      setUser(u)
      if (!u) {
        setCanAccess(false)
        return
      }
      try {
        const allowed = await withTimeout(checkCanAccessPortal())
        setCanAccess(allowed)
        if (!allowed) {
          await supabase.auth.signOut()
          setUser(null)
          setAuthError('Zugriff verweigert. Nur Admin und Teamleiter dürfen das Arbeitszeitenportal nutzen.')
        }
      } catch (roleErr) {
        const msg = roleErr instanceof Error ? roleErr.message : 'Verbindungsfehler'
        if (retryCount < MAX_RETRIES && isNetworkError(msg)) {
          isRetrying = true
          setLoadingHint(`Verbindung langsam. Versuch ${retryCount + 2}/${MAX_RETRIES + 1}…`)
          setTimeout(() => initAuth(true, retryCount + 1), RETRY_DELAY_MS)
          return
        }
        setAuthError(
          msg === 'Zeitüberschreitung'
            ? 'Verbindung zu langsam. Bitte erneut versuchen.'
            : isNetworkError(msg)
              ? 'Supabase nicht erreichbar. Bitte Seite neu laden.'
              : msg
        )
      }
    } catch (err) {
      setUser(null)
      setCanAccess(false)
      const msg = err instanceof Error ? err.message : 'Verbindungsfehler'
      if (retryCount < MAX_RETRIES && isNetworkError(msg)) {
        isRetrying = true
        setLoadingHint(`Verbindung langsam. Versuch ${retryCount + 2}/${MAX_RETRIES + 1}…`)
        setTimeout(() => initAuth(true, retryCount + 1), RETRY_DELAY_MS)
        return
      }
      setAuthError(
        msg === 'Zeitüberschreitung'
          ? 'Verbindung zu langsam. Bitte erneut versuchen.'
          : isNetworkError(msg)
            ? 'Supabase nicht erreichbar. Bitte Seite neu laden.'
            : 'Verbindungsfehler. Bitte Seite neu laden.'
      )
    } finally {
      authInFlight.current = false
      if (!isRetrying) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let hintTimer: ReturnType<typeof setTimeout> | null = null
    if (isLoading) {
      hintTimer = setTimeout(() => {
        setLoadingHint((prev) =>
          prev ? prev : 'Verbindung dauert… Bei inaktivem Supabase-Projekt kann das Aufwecken etwas dauern.'
        )
      }, 5_000)
    }
    return () => {
      if (hintTimer) clearTimeout(hintTimer)
    }
  }, [isLoading])

  useEffect(() => {
    warmUpConnection()
    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setCanAccess(false)
          setIsLoading(false)
          return
        }
        if (session?.user) setUser(session.user)
      }
    )

    return () => subscription.unsubscribe()
  }, [initAuth])

  const handleLoginSuccess = useCallback(() => {
    setAuthError(null)
    setIsLoading(true)
    initAuth()
  }, [initAuth])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setCanAccess(false)
    setAuthError(null)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Lade Arbeitszeitenportal…</p>
          {loadingHint && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 max-w-xs" role="status">
              {loadingHint}
            </p>
          )}
        </div>
      </div>
    )
  }

  const fallback = (
    <div className="flex items-center justify-center p-8 bg-slate-100 dark:bg-slate-900 min-h-[40vh]">
      <div className="w-6 h-6 border-2 border-vico-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <BrowserRouter>
      <ThemePreferenceSync userId={user?.id ?? null} enabled={Boolean(user && canAccess)} />
      <UpdateBanner
        licenseAdvertisedVersion={appVersionInfo?.version ?? null}
        licenseAdvertisedReleaseNotes={appVersionInfo?.releaseNotes ?? null}
      />
      <Suspense fallback={fallback}>
        <Routes>
          <Route path="/login" element={
            user && canAccess ? (
              <Navigate to="/" replace />
            ) : (
              <Login onSuccess={handleLoginSuccess} onError={setAuthError} />
            )
          } />
          <Route path="/" element={
            user && canAccess ? (
              <Layout user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }>
            <Route index element={<Uebersicht />} />
            <Route path="uebersicht" element={<Uebersicht />} />
            <Route path="alle-zeiten" element={<AlleZeiten />} />
            <Route path="urlaubantrage" element={<UrlaubRoute />} />
            <Route path="urlaub" element={<Navigate to="/urlaubantrage" replace />} />
            <Route path="log" element={<Log />} />
            <Route path="stammdaten" element={<Stammdaten />} />
            <Route path="standort" element={<Standort />} />
            <Route path="info" element={<AppInfo />} />
          </Route>
          <Route path="*" element={<Navigate to={user && canAccess ? '/' : '/login'} replace />} />
        </Routes>
      </Suspense>
      {authError && (
        <div
          className="fixed bottom-4 left-4 right-4 max-w-md mx-auto p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-100 text-sm text-center"
          role="alert"
        >
          <p className="mb-2">{authError}</p>
          {(authError.includes('Verbindung') || authError.includes('Zeitüberschreitung') || authError.includes('nicht erreichbar')) && (
            <button
              type="button"
              onClick={() => { setAuthError(null); setIsLoading(true); initAuth() }}
              className="px-4 py-2 rounded-lg bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-50 font-medium text-sm transition-colors"
            >
              Erneut versuchen
            </button>
          )}
        </div>
      )}
    </BrowserRouter>
  )
}

export default App
