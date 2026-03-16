import { createSupabaseClient } from '../../../shared/createSupabaseClient'
import { warmUpConnection as doWarmUp } from '../../../shared/warmUpConnection'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env prüfen.')
}

export const warmUpConnection = (): void => doWarmUp(supabaseUrl, supabaseAnonKey)

export const supabase = createSupabaseClient({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  storageKey: 'vico-license-portal-auth',
})
