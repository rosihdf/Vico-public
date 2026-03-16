import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { warmUpConnection as doWarmUp } from '../shared/warmUpConnection'

const REMEMBER_ME_KEY = 'vico-remember-me'

const getAuthStorage = () => {
  if (typeof window === 'undefined') return localStorage
  const remember = localStorage.getItem(REMEMBER_ME_KEY)
  return remember === 'false' ? sessionStorage : localStorage
}

export const setRememberMe = (remember: boolean) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false')
  }
}

export const getRememberMe = (): boolean => {
  if (typeof window === 'undefined') return true
  const v = localStorage.getItem(REMEMBER_ME_KEY)
  return v !== 'false'
}

const customStorage = {
  getItem: (key: string) => getAuthStorage().getItem(key),
  setItem: (key: string, value: string) => getAuthStorage().setItem(key, value),
  removeItem: (key: string) => getAuthStorage().removeItem(key),
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env prüfen. Dev-Server neu starten (npm run dev).'
  )
}

export const warmUpConnection = (): void => doWarmUp(supabaseUrl, supabaseAnonKey)

// Ladezeiten: Supabase-Projekt-Region (Dashboard → Settings → General) nah an Nutzern wählen (z. B. Frankfurt für EU).
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.placeholder',
  {
    auth: {
      storage: customStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)
