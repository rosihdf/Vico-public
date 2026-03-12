import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase, setRememberMe } from './supabase'
import { getSupabaseErrorMessage } from './supabaseErrors'
import type { User, Session } from '@supabase/supabase-js'

type UserRole = 'admin' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde'

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
  refreshUserRole: () => Promise<void>
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; needsMfa?: boolean; message?: string }>
  verifyMfa: (code: string) => Promise<{ success: boolean; message?: string }>
  signUp: (email: string, password: string) => Promise<{ success: boolean; message: string; sessionCreated?: boolean }>
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; message: string }>
  updatePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>
  logout: () => Promise<void>
  loginError: string | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const fetchProfileSupabase = async (userId: string): Promise<Profile | null> => {
  const { data: roleData, error: roleError } = await supabase.rpc('get_my_role')
  if (!roleError && roleData != null && (roleData === 'admin' || roleData === 'mitarbeiter' || roleData === 'operator' || roleData === 'leser' || roleData === 'demo' || roleData === 'kunde')) {
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

  const userEmail = user?.email ?? null
  const isAuthenticated = !!user

  const login = useCallback(async (identifier: string, password: string, rememberMe = true) => {
    setLoginError(null)
    if (!identifier.trim() || !password) {
      const msg = 'Bitte E-Mail und Passwort eingeben.'
      setLoginError(msg)
      return { success: false, message: msg }
    }

    const url = import.meta.env.VITE_SUPABASE_URL
    if (!url || url.includes('example.supabase.co')) {
      const msg = 'Supabase nicht konfiguriert. .env mit VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY prüfen.'
      setLoginError(msg)
      return { success: false, message: msg }
    }

    setRememberMe(rememberMe)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier.trim(),
        password,
      })

      if (error) {
        const msg = getSupabaseErrorMessage(error)
        setLoginError(msg)
        return { success: false, message: msg }
      }

      if (data.user) {
        setUser(data.user)
        const profile = await fetchProfileSupabase(data.user.id)
        setUserRole(profile?.role ?? 'mitarbeiter')

        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== aalData.nextLevel) {
          return { success: true, needsMfa: true }
        }
      }
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.'
      setLoginError(msg)
      return { success: false, message: msg }
    }
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
      return { success: false, message: getSupabaseErrorMessage(error) }
    }
    if (data.user && data.session) {
      const profile = await fetchProfileSupabase(data.user.id)
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
    const redirectTo = new URL('/reset-password', window.location.origin).href
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })
    if (error) {
      return { success: false, message: getSupabaseErrorMessage(error) }
    }
    return {
      success: true,
      message:
        'Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen des Passworts gesendet. Bitte Posteingang (und Spam) prüfen.',
    }
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'Passwort muss mindestens 6 Zeichen haben.' }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      return { success: false, message: getSupabaseErrorMessage(error) }
    }
    return { success: true, message: 'Passwort wurde geändert.' }
  }, [])

  const verifyMfa = useCallback(async (code: string): Promise<{ success: boolean; message?: string }> => {
    setLoginError(null)
    try {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError || !factorsData?.totp?.length) {
        return { success: false, message: 'Kein 2FA-Faktor gefunden. Bitte Support kontaktieren.' }
      }
      const factorId = factorsData.totp[0].id

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError || !challengeData?.id) {
        return { success: false, message: getSupabaseErrorMessage(challengeError ?? new Error('Challenge fehlgeschlagen')) }
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: code.trim().replace(/\s/g, ''),
      })
      if (verifyError) {
        return { success: false, message: getSupabaseErrorMessage(verifyError) }
      }

      const profile = await fetchProfileSupabase((await supabase.auth.getUser()).data.user!.id)
      setUserRole(profile?.role ?? 'mitarbeiter')
      return { success: true }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : '2FA-Verifizierung fehlgeschlagen.' }
    }
  }, [])

  const logout = useCallback(async () => {
    setLoginError(null)
    await supabase.auth.signOut()
    setUser(null)
    setUserRole(null)
  }, [])

  const refreshUserRole = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    const profile = await fetchProfileSupabase(u.id)
    setUserRole(profile?.role ?? 'mitarbeiter')
  }, [user])

  useEffect(() => {
    const initSupabaseAuth = async (session: Session | null) => {
      try {
        if (!session?.user) {
          setUser(null)
          setUserRole(null)
          setIsLoading(false)
          return
        }
        setUser(session.user)
        try {
          const profile = await fetchProfileSupabase(session.user.id)
          setUserRole(profile?.role ?? 'mitarbeiter')
        } catch {
          setUserRole('mitarbeiter')
        }
      } catch {
        setUser(null)
        setUserRole(null)
      } finally {
        setIsLoading(false)
      }
    }

    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) {
      setIsLoading(false)
      return
    }

    const safetyTimeoutId = setTimeout(() => {
      setIsLoading(false)
    }, 4000)

    const loadSession = async (retryCount = 0) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session && retryCount < 1) {
        await new Promise((r) => setTimeout(r, 200))
        return loadSession(1)
      }
      await initSupabaseAuth(session)
    }
    loadSession()
      .catch(() => {
        setUser(null)
        setUserRole(null)
      })
      .finally(() => {
        setIsLoading(false)
        clearTimeout(safetyTimeoutId)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await initSupabaseAuth(session)
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
        refreshUserRole,
        login,
        verifyMfa,
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
