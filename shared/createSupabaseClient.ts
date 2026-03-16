/** Factory für Supabase-Client mit konfigurierbaren Auth-Optionen */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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
}

export const createSupabaseClient = (
  options: CreateSupabaseClientOptions
): SupabaseClient => {
  const { url, anonKey, storageKey, customStorage, warnMessage } = options
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

  return createClient(
    supabaseUrl || 'https://example.supabase.co',
    supabaseAnonKey || 'placeholder',
    { auth: authOptions }
  )
}
