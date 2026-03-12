import { supabase } from '../supabase'
import { getCachedProfiles, setCachedProfiles, addToOutbox } from './offlineStorage'

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine

export type ProfileRole = 'admin' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde'

export type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: ProfileRole
  created_at?: string
  updated_at?: string
}

const VALID_ROLES: ProfileRole[] = ['admin', 'mitarbeiter', 'operator', 'leser', 'demo', 'kunde']

export const parseRole = (role: string): ProfileRole =>
  (VALID_ROLES.includes(role as ProfileRole) ? role : 'mitarbeiter') as ProfileRole

export const getProfileDisplayName = (p: Profile): string => {
  if (p.first_name || p.last_name) {
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  }
  return p.email ?? '(kein Name)'
}

export const fetchMyProfile = async (userId: string): Promise<Profile | null> => {
  if (!isOnline()) {
    const cached = getCachedProfiles() as Profile[]
    const found = cached.find((p) => p.id === userId)
    return found ?? null
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, created_at, updated_at')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  const profile = data as Profile
  const all = getCachedProfiles() as Profile[]
  const others = all.filter((p) => p.id !== userId)
  setCachedProfiles([...others, profile])
  return profile
}

export const fetchProfileByEmail = async (email: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, created_at, updated_at')
    .ilike('email', email.trim())
    .maybeSingle()
  if (error || !data) return null
  return data as Profile
}

export const fetchProfiles = async (): Promise<Profile[]> => {
  if (!isOnline()) {
    return getCachedProfiles() as Profile[]
  }
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_profiles_for_admin')
  let result: Profile[]
  if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
    result = rpcData.map((row: { id: string; email: string | null; first_name: string | null; last_name: string | null; role: string }) => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      role: parseRole(row.role ?? ''),
    }))
  } else {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, created_at, updated_at')
      .order('email', { nullsFirst: false })
    if (error) return getCachedProfiles() as Profile[]
    result = (data ?? []) as Profile[]
  }
  setCachedProfiles(result)
  return result
}

export const updateProfileRoleByEmail = async (
  email: string,
  role: 'admin' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde'
): Promise<{ error: { message: string } | null }> => {
  const profile = await fetchProfileByEmail(email)
  if (!profile) return { error: { message: 'Benutzer nicht gefunden.' } }
  return updateProfileRole(profile.id, role)
}

export const updateProfileRole = async (
  profileId: string,
  role: 'admin' | 'mitarbeiter' | 'operator' | 'leser' | 'demo' | 'kunde'
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', profileId)
  return { error: error ? { message: error.message } : null }
}

export const updateProfileName = async (
  profileId: string,
  first_name: string | null,
  last_name: string | null
): Promise<{ error: { message: string } | null }> => {
  const payload = {
    id: profileId,
    first_name: first_name?.trim() || null,
    last_name: last_name?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  if (!isOnline()) {
    addToOutbox({ table: 'profiles', action: 'update', payload })
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) =>
      p.id === profileId ? { ...p, first_name: payload.first_name, last_name: payload.last_name } : p
    )
    setCachedProfiles(updated)
    return { error: null }
  }
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: payload.first_name,
      last_name: payload.last_name,
      updated_at: payload.updated_at,
    })
    .eq('id', profileId)
  if (!error) {
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) =>
      p.id === profileId ? { ...p, first_name: payload.first_name, last_name: payload.last_name } : p
    )
    setCachedProfiles(updated)
  }
  return { error: error ? { message: error.message } : null }
}
