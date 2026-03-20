import { supabase } from '../supabase'
import { getCachedProfiles, setCachedProfiles, addToOutbox } from './offlineStorage'
import {
  parseRole,
  getProfileDisplayName,
  type ProfileRole,
} from '../../shared/profileUtils'

export type { ProfileRole }
export { parseRole, getProfileDisplayName }

import { isOnline } from '../../shared/networkUtils'

export type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: ProfileRole
  created_at?: string
  updated_at?: string
  soll_minutes_per_month?: number | null
  soll_minutes_per_week?: number | null
  vacation_days_per_year?: number | null
  team_id?: string | null
  team_name?: string | null
  gps_consent_at?: string | null
  gps_consent_revoked_at?: string | null
  standortabfrage_consent_at?: string | null
  standortabfrage_consent_revoked_at?: string | null
}

export type Team = {
  id: string
  name: string
}

export const fetchMyProfile = async (userId: string): Promise<Profile | null> => {
  if (!isOnline()) {
    const cached = getCachedProfiles() as Profile[]
    const found = cached.find((p) => p.id === userId)
    return found ?? null
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, created_at, updated_at, soll_minutes_per_month, soll_minutes_per_week, vacation_days_per_year, team_id, gps_consent_at, gps_consent_revoked_at, standortabfrage_consent_at, standortabfrage_consent_revoked_at')
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
    result = rpcData.map((row: { id: string; email: string | null; first_name: string | null; last_name: string | null; role: string; soll_minutes_per_month?: number | null; soll_minutes_per_week?: number | null; team_id?: string | null; team_name?: string | null }) => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      role: parseRole(row.role ?? ''),
      soll_minutes_per_month: row.soll_minutes_per_month ?? null,
      soll_minutes_per_week: row.soll_minutes_per_week ?? null,
      team_id: row.team_id ?? null,
      team_name: row.team_name ?? null,
    }))
  } else {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, created_at, updated_at, soll_minutes_per_month, soll_minutes_per_week, team_id')
      .order('email', { nullsFirst: false })
    if (error) return getCachedProfiles() as Profile[]
    result = (data ?? []).map((row: { team_id?: string | null }) => ({ ...row, team_name: null })) as Profile[]
  }
  setCachedProfiles(result)
  return result
}

export const updateProfileRoleByEmail = async (
  email: string,
  role: ProfileRole
): Promise<{ error: { message: string } | null }> => {
  const profile = await fetchProfileByEmail(email)
  if (!profile) return { error: { message: 'Benutzer nicht gefunden.' } }
  return updateProfileRole(profile.id, role)
}

export const updateProfileRole = async (
  profileId: string,
  role: ProfileRole
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

export const fetchTeams = async (): Promise<Team[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase.from('teams').select('id, name').order('name')
  if (error) return []
  return (data ?? []) as Team[]
}

export const updateProfileTeam = async (
  profileId: string,
  teamId: string | null
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    addToOutbox({
      table: 'profiles',
      action: 'update',
      payload: { id: profileId, team_id: teamId, updated_at: new Date().toISOString() },
    })
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, team_id: teamId } : p))
    setCachedProfiles(updated)
    return { error: null }
  }
  const { error } = await supabase
    .from('profiles')
    .update({ team_id: teamId, updated_at: new Date().toISOString() })
    .eq('id', profileId)
  if (!error) {
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, team_id: teamId } : p))
    setCachedProfiles(updated)
  }
  return { error: error ? { message: error.message } : null }
}

export const createTeam = async (name: string): Promise<{ error: { message: string } | null; id?: string }> => {
  const trimmed = name?.trim()
  if (!trimmed) return { error: { message: 'Teamname darf nicht leer sein.' } }
  if (!isOnline()) return { error: { message: 'Offline – Team kann nicht angelegt werden.' } }
  const { data, error } = await supabase
    .from('teams')
    .insert({ name: trimmed, updated_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) return { error: { message: error.message } }
  return { error: null, id: data?.id }
}

export const deleteTeam = async (teamId: string): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Offline – Team kann nicht gelöscht werden.' } }
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  return { error: error ? { message: error.message } : null }
}

export const setGpsConsent = async (profileId: string): Promise<{ error: { message: string } | null }> => {
  const now = new Date().toISOString()
  if (!isOnline()) {
    addToOutbox({
      table: 'profiles',
      action: 'update',
      payload: { id: profileId, gps_consent_at: now, gps_consent_revoked_at: null, updated_at: now },
    })
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, gps_consent_at: now, gps_consent_revoked_at: null } : p))
    setCachedProfiles(updated)
    return { error: null }
  }
  const { error } = await supabase
    .from('profiles')
    .update({ gps_consent_at: now, gps_consent_revoked_at: null, updated_at: now })
    .eq('id', profileId)
  if (!error) {
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, gps_consent_at: now, gps_consent_revoked_at: null } : p))
    setCachedProfiles(updated)
  }
  return { error: error ? { message: error.message } : null }
}

export const revokeGpsConsent = async (profileId: string): Promise<{ error: { message: string } | null }> => {
  const now = new Date().toISOString()
  if (!isOnline()) {
    addToOutbox({
      table: 'profiles',
      action: 'update',
      payload: { id: profileId, gps_consent_revoked_at: now, updated_at: now },
    })
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, gps_consent_revoked_at: now } : p))
    setCachedProfiles(updated)
    return { error: null }
  }
  const { error } = await supabase
    .from('profiles')
    .update({ gps_consent_revoked_at: now, updated_at: now })
    .eq('id', profileId)
  if (!error) {
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, gps_consent_revoked_at: now } : p))
    setCachedProfiles(updated)
  }
  return { error: error ? { message: error.message } : null }
}

export const setStandortabfrageConsent = async (profileId: string): Promise<{ error: { message: string } | null }> => {
  const now = new Date().toISOString()
  if (!isOnline()) {
    addToOutbox({
      table: 'profiles',
      action: 'update',
      payload: { id: profileId, standortabfrage_consent_at: now, standortabfrage_consent_revoked_at: null, updated_at: now },
    })
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, standortabfrage_consent_at: now, standortabfrage_consent_revoked_at: null } : p))
    setCachedProfiles(updated)
    return { error: null }
  }
  const { error } = await supabase
    .from('profiles')
    .update({ standortabfrage_consent_at: now, standortabfrage_consent_revoked_at: null, updated_at: now })
    .eq('id', profileId)
  if (!error) {
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, standortabfrage_consent_at: now, standortabfrage_consent_revoked_at: null } : p))
    setCachedProfiles(updated)
  }
  return { error: error ? { message: error.message } : null }
}

export const revokeStandortabfrageConsent = async (profileId: string): Promise<{ error: { message: string } | null }> => {
  const now = new Date().toISOString()
  if (!isOnline()) {
    addToOutbox({
      table: 'profiles',
      action: 'update',
      payload: { id: profileId, standortabfrage_consent_revoked_at: now, updated_at: now },
    })
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, standortabfrage_consent_revoked_at: now } : p))
    setCachedProfiles(updated)
    return { error: null }
  }
  const { error } = await supabase
    .from('profiles')
    .update({ standortabfrage_consent_revoked_at: now, updated_at: now })
    .eq('id', profileId)
  if (!error) {
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, standortabfrage_consent_revoked_at: now } : p))
    setCachedProfiles(updated)
  }
  return { error: error ? { message: error.message } : null }
}

export const updateProfileSollMinutes = async (
  profileId: string,
  sollMinutesPerMonth: number | null
): Promise<{ error: { message: string } | null }> => {
  const val = sollMinutesPerMonth != null && sollMinutesPerMonth >= 0 ? Math.round(sollMinutesPerMonth) : null
  if (!isOnline()) {
    addToOutbox({
      table: 'profiles',
      action: 'update',
      payload: { id: profileId, soll_minutes_per_month: val, updated_at: new Date().toISOString() },
    })
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, soll_minutes_per_month: val } : p))
    setCachedProfiles(updated)
    return { error: null }
  }
  const { error } = await supabase
    .from('profiles')
    .update({ soll_minutes_per_month: val, updated_at: new Date().toISOString() })
    .eq('id', profileId)
  if (!error) {
    const cached = getCachedProfiles() as Profile[]
    const updated = cached.map((p) => (p.id === profileId ? { ...p, soll_minutes_per_month: val } : p))
    setCachedProfiles(updated)
  }
  return { error: error ? { message: error.message } : null }
}
