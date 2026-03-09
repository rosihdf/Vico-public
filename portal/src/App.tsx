import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Berichte from './pages/Berichte'
import Datenschutz from './pages/Datenschutz'
import Impressum from './pages/Impressum'
import Layout from './components/Layout'

const App = () => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const initAuth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Lade Kundenportal…</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
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
        </Route>
        <Route path="*" element={<Navigate to={user ? '/berichte' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
