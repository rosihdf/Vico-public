import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Linking } from 'react-native'
import { supabase, setRememberMe } from '../lib/supabase'
import { getSupabaseErrorMessage } from '../lib/supabaseErrors'
import type { User, Session } from '@supabase/supabase-js'

type UserRole = 'admin' | 'mitarbeiter' | 'leser'

type Profile = {
  id: string
  email: string | null
  role: UserRole
}

type AuthContextType = {
  isAuthenticated: boolean
  user: User | null
  userEmail: string | null
  userRole: UserRole | null
  pendingPasswordReset: boolean
  clearPendingPasswordReset: () => void
  refreshUserRole: () => Promise<void>
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<boolean>
  signUp: (email: string, password: string) => Promise<{ success: boolean; message: string; sessionCreated?: boolean }>
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; message: string }>
  updatePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>
  logout: () => Promise<void>
  loginError: string | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const { data: roleData, error: roleError } = await supabase.rpc('get_my_role')
  if (!roleError && roleData != null && (roleData === 'admin' || roleData === 'mitarbeiter' || roleData === 'leser')) {
    return { id: userId, email: null, role: roleData as UserRole }
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return data as Profile
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false)

  const userEmail = user?.email ?? null
  const isAuthenticated = !!user

  const login = useCallback(async (identifier: string, password: string, rememberMe = true) => {
    setLoginError(null)
    if (!identifier.trim() || !password) {
      setLoginError('Bitte E-Mail und Passwort eingeben.')
      return false
    }

    const url = process.env.EXPO_PUBLIC_SUPABASE_URL
    if (!url) {
      setLoginError('Supabase nicht konfiguriert. EXPO_PUBLIC_SUPABASE_URL prüfen.')
      return false
    }

    await setRememberMe(rememberMe)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
      password,
    })

    if (error) {
      setLoginError(getSupabaseErrorMessage(error))
      return false
    }

    if (data.user) {
      const profile = await fetchProfile(data.user.id)
      setUserRole(profile?.role ?? 'mitarbeiter')
    }
    return true
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    setLoginError(null)
    if (!email.trim() || !password) {
      return { success: false, message: 'E-Mail und Passwort eingeben.' }
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })
    if (error) {
      return { success: false, message: error.message }
    }
    if (data.user && data.session) {
      const profile = await fetchProfile(data.user.id)
      setUserRole(profile?.role ?? 'mitarbeiter')
      setUser(data.user)
      return { success: true, message: 'Konto erstellt. Sie sind eingeloggt.', sessionCreated: true }
    }
    return {
      success: true,
      message: 'Konto erstellt. Bitte E-Mail zur Bestätigung prüfen (falls aktiviert).',
      sessionCreated: false,
    }
  }, [])

  const resetPasswordForEmail = useCallback(async (email: string) => {
    setLoginError(null)
    if (!email.trim()) {
      return { success: false, message: 'Bitte E-Mail eingeben.' }
    }
    const redirectTo = 'vico://reset-password'
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })
    if (error) {
      return { success: false, message: error.message }
    }
    return {
      success: true,
      message:
        'Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen gesendet. Posteingang (und Spam) prüfen.',
    }
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'Passwort muss mindestens 6 Zeichen haben.' }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      return { success: false, message: error.message }
    }
    return { success: true, message: 'Passwort wurde geändert.' }
  }, [])

  const logout = useCallback(async () => {
    setLoginError(null)
    await supabase.auth.signOut()
    setUser(null)
    setUserRole(null)
  }, [])

  const clearPendingPasswordReset = useCallback(() => setPendingPasswordReset(false), [])

  const refreshUserRole = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    const profile = await fetchProfile(u.id)
    setUserRole(profile?.role ?? 'mitarbeiter')
  }, [])

  useEffect(() => {
    const handleResetPasswordUrl = async (url: string | null) => {
      if (!url || !url.includes('reset-password') || !url.includes('#')) return
      const hashPart = url.split('#')[1]
      if (!hashPart) return
      const params = new URLSearchParams(hashPart)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type = params.get('type')
      if (type === 'recovery' && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!error) setPendingPasswordReset(true)
      }
    }
    Linking.getInitialURL().then(handleResetPasswordUrl)
    const sub = Linking.addEventListener('url', ({ url }) => handleResetPasswordUrl(url))
    return () => sub.remove()
  }, [])

  useEffect(() => {
    const initAuth = async (session: Session | null) => {
      try {
        if (!session?.user) {
          setUser(null)
          setUserRole(null)
          setIsLoading(false)
          return
        }
        setUser(session.user)
        const profile = await fetchProfile(session.user.id)
        setUserRole(profile?.role ?? 'mitarbeiter')
      } catch {
        setUser(null)
        setUserRole(null)
      } finally {
        setIsLoading(false)
      }
    }

    const url = process.env.EXPO_PUBLIC_SUPABASE_URL
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      setIsLoading(false)
      return
    }

    const safetyTimeoutId = setTimeout(() => {
      setIsLoading(false)
    }, 4000)

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => initAuth(session))
      .catch(() => {
        setUser(null)
        setUserRole(null)
        setIsLoading(false)
      })
      .finally(() => clearTimeout(safetyTimeoutId))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await initAuth(session)
      }
    )

    return () => {
      clearTimeout(safetyTimeoutId)
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        userEmail,
        userRole,
        pendingPasswordReset,
        clearPendingPasswordReset,
        refreshUserRole,
        login,
        signUp,
        resetPasswordForEmail,
        updatePassword,
        logout,
        loginError,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
