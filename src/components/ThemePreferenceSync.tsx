import { useEffect } from 'react'
import { useAuth } from '../AuthContext'
import { useTheme } from '../ThemeContext'
import { fetchMyProfile } from '../lib/userService'
import { parseThemeFromDb } from '../../shared/themePreferenceDb'

/**
 * Nach Login: Darstellung aus Profil (theme_preference) laden – überschreibt localStorage,
 * wenn die DB einen gültigen Wert liefert (Sync mit Portalen).
 */
const ThemePreferenceSync = () => {
  const { isAuthenticated, user } = useAuth()
  const { setTheme } = useTheme()

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return
    let cancelled = false
    void fetchMyProfile(user.id).then((p) => {
      if (cancelled || !p?.theme_preference) return
      const t = parseThemeFromDb(p.theme_preference)
      if (t) setTheme(t)
    })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user?.id, setTheme])

  return null
}

export default ThemePreferenceSync
