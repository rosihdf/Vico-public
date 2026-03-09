import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import Login from './pages/Login'
import Lizenz from './pages/Lizenz'
import Layout from './components/Layout'

const AUTH_TIMEOUT_MS = 12000
const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
  Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Zeitüberschreitung')), AUTH_TIMEOUT_MS)
    ),
  ])

const App = () => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const checkRole = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase.rpc('get_my_role')
    if (error || data !== 'admin') return false
    return true
  }, [])

  const initAuth = useCallback(async () => {
    try {
      const { data: { session } } = await withTimeout(supabase.auth.getSession())
      const u = session?.user ?? null
      setUser(u)
      if (!u) {
        setIsAdmin(null)
        setIsLoading(false)
        return
      }
      const admin = await withTimeout(checkRole())
      setIsAdmin(admin)
      if (!admin) {
        await supabase.auth.signOut()
        setUser(null)
        setAuthError('Zugriff verweigert. Nur Administratoren dürfen die Lizenz-Verwaltung nutzen.')
      }
    } catch (err) {
      setUser(null)
      setIsAdmin(null)
      setAuthError(err instanceof Error ? err.message : 'Verbindungsfehler')
    } finally {
      setIsLoading(false)
    }
  }, [checkRole])

  useEffect(() => {
    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (!u) {
          setIsAdmin(null)
          setIsLoading(false)
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
        } catch {
          setUser(null)
          setIsAdmin(null)
          setAuthError('Verbindungsfehler. Bitte erneut versuchen.')
        } finally {
          setIsLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [initAuth, checkRole])

  const handleLoginSuccess = useCallback(() => {
    setAuthError(null)
    initAuth()
  }, [initAuth])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(null)
    setAuthError(null)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Lade Lizenz-Admin…</p>
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
            <div>
              <Login onSuccess={handleLoginSuccess} onError={setAuthError} />
              {authError && (
                <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm text-center" role="alert">
                  {authError}
                </div>
              )}
            </div>
          )
        } />
        <Route path="/" element={
          user && isAdmin ? (
            <Layout user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }>
          <Route index element={<Lizenz />} />
        </Route>
        <Route path="*" element={<Navigate to={user && isAdmin ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
