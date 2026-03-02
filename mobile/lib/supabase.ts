import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const REMEMBER_ME_KEY = 'vico-remember-me'

const getStorage = () => AsyncStorage

export const setRememberMe = async (remember: boolean) => {
  await AsyncStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false')
}

export const getRememberMe = async (): Promise<boolean> => {
  const v = await AsyncStorage.getItem(REMEMBER_ME_KEY)
  return v !== 'false'
}

const customStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
}

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim()
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase: EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY in .env oder app.json extra prüfen.'
  )
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.placeholder',
  { auth: { storage: customStorage, persistSession: true } }
)
