import { useEffect } from 'react'
import { useTheme } from '../../../shared/ThemeContext'
import { supabase } from '../lib/supabase'
import { fetchProfileThemePreference } from '../../../shared/themePreferenceDb'

type ThemePreferenceSyncProps = {
  userId: string | null
  /** z. B. nur wenn Rolle Admin/Teamleiter – sonst kein Profil-Zugriff sinnvoll */
  enabled: boolean
}

const ThemePreferenceSync = ({ userId, enabled }: ThemePreferenceSyncProps) => {
  const { setTheme } = useTheme()

  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false
    void fetchProfileThemePreference(supabase, userId).then((t) => {
      if (!cancelled && t) setTheme(t)
    })
    return () => {
      cancelled = true
    }
  }, [userId, enabled, setTheme])

  return null
}

export default ThemePreferenceSync
