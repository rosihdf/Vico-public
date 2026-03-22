import { useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { useTheme } from '../ThemeContext'
import { supabase } from '../lib/supabase'
import { fetchProfileThemePreference } from '../../../shared/themePreferenceDb'

/**
 * Nach Login: theme_preference aus Profil (gleiche Quelle wie Haupt-App).
 */
const ThemePreferenceSync = ({ user }: { user: User | null }) => {
  const { setTheme } = useTheme()

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    void fetchProfileThemePreference(supabase, user.id).then((t) => {
      if (!cancelled && t) setTheme(t)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id, setTheme])

  return null
}

export default ThemePreferenceSync
