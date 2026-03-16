import { createSupabaseClient } from '../../../shared/createSupabaseClient'
import { warmUpConnection as doWarmUp } from '../../../shared/warmUpConnection'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Arbeitszeitenportal: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env prüfen.')
}

export const warmUpConnection = (): void => doWarmUp(supabaseUrl, supabaseAnonKey)

/** Gleiches Supabase-Projekt wie die Vico-Haupt-App (Zeiterfassungs-Daten). */
export const supabase = createSupabaseClient({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  storageKey: 'vico-arbeitszeit-portal-auth',
  warnMessage: 'Arbeitszeitenportal: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env prüfen.',
})
