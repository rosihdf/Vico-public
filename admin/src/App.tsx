import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase, warmUpConnection } from './lib/supabase'
import { withTimeoutReject, checkRole as checkRoleUtil } from '../../shared/authUtils'
import type { User } from '@supabase/supabase-js'
import Layout from './components/Layout'
import Mandanten from './pages/Mandanten'

const Login = lazy(() => import('./pages/Login'))
const MandantForm = lazy(() => import('./pages/MandantForm'))
const Grenzueberschreitungen = lazy(() => import('./pages/Grenzueberschreitungen'))
const Lizenzmodelle = lazy(() => import('./pages/Lizenzmodelle'))
const LizenzmodellForm = lazy(() => import('./pages/LizenzmodellForm'))

const PageFallback = () => (
  <div className="flex flex-col items-center justify-center py-12 gap-4">
    <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin" />
    <p className="text-sm text-slate-500">Lade…</p>
  </div>
)

const AUTH_TIMEOUT_MS = 30_000
const RETRY_DELAY_MS = 2_000
const MAX_RETRIES = 2

const withTimeout = <T,>(p: Promise<T>) =>
  withTimeoutReject(p, AUTH_TIMEOUT_MS, 'Zeitüberschreitung')

const checkRole = () => checkRoleUtil(supabase, ['admin'])

const isNetworkError = (msg: string) =>
  msg === 'Zeitüberschreitung' ||
  msg.includes('fetch') ||
  msg.includes('network') ||
  msg.includes('Failed')

const App = () => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [loadingHint, setLoadingHint] = useState<string | null>(null)
  const authInFlight = useRef(false)

  const initAuth = useCallback(async (isRetry = false, retryCount = 0) => {
    if (authInFlight.current && !isRetry) return
    authInFlight.current = true
    let isRetrying = false
    if (!isRetry) setLoadingHint(null)
    try {
      const { data: { session } } = await withTimeout(supabase.auth.getSession())
      const u = session?.user ?? null
      setUser(u)
      if (!u) {
        setIsAdmin(false)
        return
      }
      try {
        const admin = await withTimeout(checkRole())
        setIsAdmin(admin)
        if (!admin) {
          await supabase.auth.signOut()
          setUser(null)
          setAuthError('Zugriff verweigert. Nur Administratoren dürfen die Lizenz-Verwaltung nutzen.')
        }
      } catch (roleErr) {
        const msg = roleErr instanceof Error ? roleErr.message : 'Verbindungsfehler'
        if (retryCount < MAX_RETRIES && isNetworkError(msg)) {
          isRetrying = true
          setLoadingHint(`Verbindung langsam. Versuch ${retryCount + 2}/${MAX_RETRIES + 1} in wenigen Sekunden…`)
          setTimeout(() => initAuth(true, retryCount + 1), RETRY_DELAY_MS)
          return
        }
        setAuthError(
          msg === 'Zeitüberschreitung'
            ? 'Verbindung zu langsam. Bitte „Erneut versuchen".'
            : isNetworkError(msg)
              ? 'Supabase nicht erreichbar (evtl. pausiert). Bitte „Erneut versuchen".'
              : msg
        )
      }
    } catch (err) {
      setUser(null)
      setIsAdmin(false)
      const msg = err instanceof Error ? err.message : 'Verbindungsfehler'
      if (retryCount < MAX_RETRIES && isNetworkError(msg)) {
        isRetrying = true
        setLoadingHint(`Verbindung langsam. Versuch ${retryCount + 2}/${MAX_RETRIES + 1} in wenigen Sekunden…`)
        setTimeout(() => initAuth(true, retryCount + 1), RETRY_DELAY_MS)
        return
      }
      setAuthError(
        msg === 'Zeitüberschreitung'
          ? 'Verbindung zu langsam. Bitte erneut versuchen.'
          : isNetworkError(msg)
            ? 'Supabase nicht erreichbar. Prüfen Sie Ihre Internetverbindung.'
            : msg === 'Verbindungsfehler' || !msg
              ? 'Verbindungsfehler. Bitte erneut versuchen.'
              : msg
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
          prev ? prev : 'Bei inaktivem Supabase-Projekt kann das Aufwecken 1–2 Min. dauern.'
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
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsAdmin(false)
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
    setIsAdmin(false)
    setAuthError(null)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Lade Lizenz-Admin…</p>
          {loadingHint && (
            <p className="text-xs text-slate-400 mt-2 max-w-xs" role="status">
              {loadingHint}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          user && isAdmin ? (
            <Navigate to="/" replace />
          ) : (
            <Suspense fallback={<PageFallback />}>
              <div>
                {authError && user ? (
                  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
                    <div className="max-w-md w-full p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
                      <h1 className="text-lg font-bold text-amber-800 mb-2">Verbindung zur Datenbank fehlgeschlagen</h1>
                      <p className="text-sm text-amber-700 mb-4">{authError}</p>
                      <p className="text-xs text-amber-600 mb-4">
                        Das Supabase-Projekt (Free-Tier) kann nach Inaktivität pausieren. Das Aufwecken dauert oft 1–2 Minuten. Keep-Alive (GitHub Actions) reduziert Pausen.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setAuthError(null); setIsLoading(true); initAuth() }}
                        className="px-4 py-2 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium text-sm transition-colors"
                      >
                        Erneut versuchen
                      </button>
                    </div>
                  </div>
                ) : (
                  <Login onSuccess={handleLoginSuccess} onError={setAuthError} />
                )}
                {authError && !user && (
                  <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm text-center" role="alert">
                    <p className="mb-2">{authError}</p>
                    <p className="mb-2 text-xs text-red-600">
                      Prüfen Sie: Internetverbindung, Supabase-Projekt (Lizenzportal) nicht pausiert?
                    </p>
                    {(authError.includes('Verbindung') || authError.includes('Zeitüberschreitung') || authError.includes('nicht erreichbar')) && (
                      <button
                        type="button"
                        onClick={() => { setAuthError(null); setIsLoading(true); initAuth() }}
                        className="px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 font-medium text-sm transition-colors"
                      >
                        Erneut versuchen
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Suspense>
          )
        } />
        <Route path="/" element={
          user && isAdmin ? (
            <Layout user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }>
          <Route index element={<Mandanten />} />
          <Route path="mandanten" element={<Mandanten />} />
          <Route path="mandanten/neu" element={
            <Suspense fallback={<PageFallback />}>
              <MandantForm />
            </Suspense>
          } />
          <Route path="mandanten/:id" element={
            <Suspense fallback={<PageFallback />}>
              <MandantForm />
            </Suspense>
          } />
          <Route path="grenzueberschreitungen" element={
            <Suspense fallback={<PageFallback />}>
              <Grenzueberschreitungen />
            </Suspense>
          } />
          <Route path="lizenzmodelle" element={
            <Suspense fallback={<PageFallback />}>
              <Lizenzmodelle />
            </Suspense>
          } />
          <Route path="lizenzmodelle/neu" element={
            <Suspense fallback={<PageFallback />}>
              <LizenzmodellForm />
            </Suspense>
          } />
          <Route path="lizenzmodelle/:id" element={
            <Suspense fallback={<PageFallback />}>
              <LizenzmodellForm />
            </Suspense>
          } />
        </Route>
        <Route path="*" element={<Navigate to={user && isAdmin ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
