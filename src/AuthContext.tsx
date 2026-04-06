import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { supabase, setRememberMe, warmUpConnection, isMandantSupabaseEnvConfigured } from './supabase'
import { getSupabaseErrorMessage } from './supabaseErrors'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

type UserRole = 'admin' | 'teamleiter' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde'

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

const VALID_ROLES: readonly string[] = ['admin', 'teamleiter', 'mitarbeiter', 'operator', 'leser', 'demo', 'kunde']

const fetchProfileSupabase = async (userId: string): Promise<Profile | null> => {
  const { data: roleData, error: roleError } = await supabase.rpc('get_my_role')
  if (!roleError && roleData != null && VALID_ROLES.includes(roleData as string)) {
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
  /** Nach Logout zurücksetzen; verhindert „keine Rolle“ wenn erstes Event `TOKEN_REFRESHED` ist */
  const roleHydratedForUserId = useRef<string | null>(null)

  const userEmail = user?.email ?? null
  const isAuthenticated = !!user

  const login = useCallback(async (identifier: string, password: string, rememberMe = true) => {
    setLoginError(null)
    if (!identifier.trim() || !password) {
      const msg = 'Bitte E-Mail und Passwort eingeben.'
      setLoginError(msg)
      return { success: false, message: msg }
    }

    if (!isMandantSupabaseEnvConfigured()) {
      const msg =
        'Supabase nicht konfiguriert. Im Repo-Root die Datei .env mit VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY setzen (Vorlage: .env.example), dann Dev-Server neu starten.'
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
        roleHydratedForUserId.current = data.user.id

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

  /**
   * Konto anlegen (Supabase `signUp`) – nur für **interne Admin-Flows** (z. B. Benutzerverwaltung).
   * Öffentliche Selbstregistrierung am Login ist deaktiviert; Konten vergibt der Mandanten-Admin.
   */
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
      roleHydratedForUserId.current = data.user.id
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

      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      if (!u) return { success: false, message: 'Sitzung ungültig.' }
      const profile = await fetchProfileSupabase(u.id)
      setUserRole(profile?.role ?? 'mitarbeiter')
      roleHydratedForUserId.current = u.id
      return { success: true }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : '2FA-Verifizierung fehlgeschlagen.' }
    }
  }, [])

  const logout = useCallback(async () => {
    setLoginError(null)
    roleHydratedForUserId.current = null
    await supabase.auth.signOut()
    setUser(null)
    setUserRole(null)
  }, [])

  const refreshUserRole = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    const profile = await fetchProfileSupabase(u.id)
    setUserRole(profile?.role ?? 'mitarbeiter')
  }, [])

  useEffect(() => {
    warmUpConnection()

    if (!isMandantSupabaseEnvConfigured()) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const safetyTimeoutId = setTimeout(() => {
      if (!cancelled) setIsLoading(false)
    }, 30_000)

    const hydrateRoleFromSession = async (session: Session | null) => {
      if (!session?.user) return
      try {
        const profile = await fetchProfileSupabase(session.user.id)
        if (!cancelled) {
          setUserRole(profile?.role ?? 'mitarbeiter')
          roleHydratedForUserId.current = session.user.id
        }
      } catch {
        if (!cancelled) {
          setUserRole('mitarbeiter')
          roleHydratedForUserId.current = session.user.id
        }
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (cancelled) return
        if (event === 'SIGNED_OUT') {
          roleHydratedForUserId.current = null
          setUser(null)
          setUserRole(null)
          setIsLoading(false)
          return
        }
        if (session?.user) {
          setUser(session.user)
          const uid = session.user.id
          /** Nach erstem Hydrate: bei reinem Token-Refresh keine erneute Profil-RPC */
          if (event !== 'TOKEN_REFRESHED' || roleHydratedForUserId.current !== uid) {
            void hydrateRoleFromSession(session)
          }
          setIsLoading(false)
        }
      }
    )

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const restoreSessionFromStorage = async () => {
      const maxAttempts = 6
      for (let i = 0; i < maxAttempts; i++) {
        if (cancelled) return
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session?.user) {
            setUser(session.user)
            await hydrateRoleFromSession(session)
            if (!cancelled) setIsLoading(false)
            return
          }
        } catch {
          /* nächster Versuch */
        }
        await sleep(280 + i * 120)
      }
      if (cancelled) return
      /** Letzte Chance: Storage-Hydration kann noch nach dem letzten getSession kommen */
      await sleep(900)
      if (cancelled) return
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          await hydrateRoleFromSession(session)
        } else {
          setUser(null)
          setUserRole(null)
        }
      } catch {
        setUser(null)
        setUserRole(null)
      }
      if (!cancelled) setIsLoading(false)
    }

    void restoreSessionFromStorage().finally(() => {
      clearTimeout(safetyTimeoutId)
    })

    return () => {
      cancelled = true
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
