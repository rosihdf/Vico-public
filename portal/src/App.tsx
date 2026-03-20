import { useState, useEffect, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase, warmUpConnection } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Berichte from './pages/Berichte'
import MeineDaten from './pages/MeineDaten'
import Datenschutz from './pages/Datenschutz'
import Impressum from './pages/Impressum'
import Layout from './components/Layout'
import UpdateBanner from '../../shared/UpdateBanner'

const AUTH_TIMEOUT_MS = 30_000

const App = () => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingHint, setLoadingHint] = useState(false)
  const authInFlight = useRef(false)

  const initAuth = useCallback(async (retryCount = 0) => {
    if (authInFlight.current) return
    authInFlight.current = true
    try {
      const sessionPromise = supabase.auth.getSession()
      const result = await Promise.race([
        sessionPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Zeitüberschreitung')), AUTH_TIMEOUT_MS)
        ),
      ])
      setUser(result.data?.session?.user ?? null)
    } catch {
      if (retryCount < 2) {
        authInFlight.current = false
        await new Promise((r) => setTimeout(r, 1_000))
        return initAuth(retryCount + 1)
      }
      setUser(null)
    } finally {
      authInFlight.current = false
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoading) return
    const timer = setTimeout(() => setLoadingHint(true), 5_000)
    return () => clearTimeout(timer)
  }, [isLoading])

  useEffect(() => {
    warmUpConnection()
    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsLoading(false)
          return
        }
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [initAuth])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Lade Kundenportal…</p>
          {loadingHint && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 max-w-xs">
              Verbindung dauert… Bei inaktivem Server kann das Aufwecken etwas dauern.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <UpdateBanner />
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/datenschutz" element={<Datenschutz />} />
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/login" element={
          user ? <Navigate to="/berichte" replace /> : <Login />
        } />
        <Route path="/" element={
          user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
        }>
          <Route index element={<Navigate to="/berichte" replace />} />
          <Route path="berichte" element={<Berichte user={user} />} />
          <Route path="meine-daten" element={<MeineDaten user={user} />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? '/berichte' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
