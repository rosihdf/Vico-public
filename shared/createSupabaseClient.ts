/** Factory für Supabase-Client mit konfigurierbaren Auth-Optionen */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createMandantDegradedAwareFetch } from './mandantDegradedStore'

export type CreateSupabaseClientOptions = {
  url: string
  anonKey: string
  storageKey?: string
  warmUp?: boolean
  customStorage?: {
    getItem: (key: string) => string | null
    setItem: (key: string, value: string) => void
    removeItem: (key: string) => void
  }
  warnMessage?: string
  /**
   * §11.18 WP-NET-01: globaler fetch-Wrap für Mandanten-Degraded (nur Transport-Fehler).
   * Admin/Lizenzportal: false, damit LP-Fehler den Mandanten-Modus nicht setzen.
   */
  trackMandantDegraded?: boolean
}

export const createSupabaseClient = (
  options: CreateSupabaseClientOptions
): SupabaseClient => {
  const { url, anonKey, storageKey, customStorage, warnMessage, trackMandantDegraded } = options
  const supabaseUrl = (url ?? '').trim()
  const supabaseAnonKey = (anonKey ?? '').trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      warnMessage ??
        'Supabase: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env prüfen.'
    )
  }

  const authOptions: {
    persistSession?: boolean
    autoRefreshToken?: boolean
    storage?: typeof customStorage
    storageKey?: string
  } = {
    persistSession: true,
    autoRefreshToken: true,
  }

  if (customStorage) {
    authOptions.storage = customStorage
  } else if (storageKey) {
    authOptions.storageKey = storageKey
  }

  const baseFetch = globalThis.fetch.bind(globalThis)
  const fetchForClient =
    trackMandantDegraded === true && supabaseUrl
      ? createMandantDegradedAwareFetch(supabaseUrl, baseFetch)
      : baseFetch

  return createClient(supabaseUrl || 'https://example.supabase.co', supabaseAnonKey || 'placeholder', {
    auth: authOptions,
    global: { fetch: fetchForClient },
  })
}
