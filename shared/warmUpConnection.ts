/** Leichter Request zum Aufwecken des Supabase-Projekts (Free-Tier pausiert nach Inaktivität). */

export const warmUpConnection = (supabaseUrl: string, supabaseAnonKey: string): void => {
  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) return
  fetch(`${supabaseUrl.trim()}/rest/v1/`, {
    method: 'HEAD',
    headers: { apikey: supabaseAnonKey.trim() },
  }).catch(() => {})
}
