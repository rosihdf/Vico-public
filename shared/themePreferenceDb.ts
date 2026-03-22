import type { SupabaseClient } from '@supabase/supabase-js'
import type { Theme } from './ThemeContext'

export const parseThemeFromDb = (value: string | null | undefined): Theme | null => {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return null
}

export const fetchProfileThemePreference = async (
  supabase: SupabaseClient,
  userId: string
): Promise<Theme | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('theme_preference')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as { theme_preference?: string | null }
  return parseThemeFromDb(row.theme_preference ?? null)
}

export const saveProfileThemePreference = async (
  supabase: SupabaseClient,
  userId: string,
  theme: Theme
): Promise<{ error: string | null }> => {
  const { error } = await supabase
    .from('profiles')
    .update({
      theme_preference: theme,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  return { error: error?.message ?? null }
}
