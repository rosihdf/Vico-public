import { supabase } from '../supabase'

export type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: 'admin' | 'mitarbeiter' | 'leser'
  created_at?: string
  updated_at?: string
}

export const getProfileDisplayName = (p: Profile): string => {
  if (p.first_name || p.last_name) {
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  }
  return p.email ?? '(kein Name)'
}

export const fetchMyProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, created_at, updated_at')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return data as Profile
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
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_profiles_for_admin')
  if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
    return rpcData.map((row: { id: string; email: string | null; first_name: string | null; last_name: string | null; role: string }) => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      role: (row.role === 'admin' ? 'admin' : row.role === 'leser' ? 'leser' : 'mitarbeiter') as Profile['role'],
    }))
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, created_at, updated_at')
    .order('email', { nullsFirst: false })
  if (error) return []
  return (data ?? []) as Profile[]
}

export const updateProfileRoleByEmail = async (
  email: string,
  role: 'admin' | 'mitarbeiter' | 'leser'
): Promise<{ error: { message: string } | null }> => {
  const profile = await fetchProfileByEmail(email)
  if (!profile) return { error: { message: 'Benutzer nicht gefunden.' } }
  return updateProfileRole(profile.id, role)
}

export const updateProfileRole = async (
  profileId: string,
  role: 'admin' | 'mitarbeiter' | 'leser'
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
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: first_name?.trim() || null,
      last_name: last_name?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
  return { error: error ? { message: error.message } : null }
}
