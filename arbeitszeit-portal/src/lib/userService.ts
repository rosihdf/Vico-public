import { supabase } from './supabase'
import {
  parseRole,
  getProfileDisplayName,
  type ProfileRole,
} from '../../../shared/profileUtils'

export type { ProfileRole }
export { parseRole, getProfileDisplayName }

export type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: ProfileRole
  soll_minutes_per_month: number | null
  soll_minutes_per_week: number | null
}

export const fetchProfiles = async (): Promise<Profile[]> => {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_profiles_for_zeiterfassung')
  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData.map((row: { id: string; email: string | null; first_name: string | null; last_name: string | null; role: string; soll_minutes_per_month?: number | null; soll_minutes_per_week?: number | null }) => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      role: parseRole(row.role ?? ''),
      soll_minutes_per_month: row.soll_minutes_per_month ?? null,
      soll_minutes_per_week: row.soll_minutes_per_week ?? null,
    }))
  }
  return []
}

export const updateSollMinutesPerMonth = async (
  profileId: string,
  sollMinutes: number | null
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase
    .from('profiles')
    .update({ soll_minutes_per_month: sollMinutes, updated_at: new Date().toISOString() })
    .eq('id', profileId)
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export const updateSollMinutesPerWeek = async (
  profileId: string,
  sollMinutes: number | null
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase
    .from('profiles')
    .update({ soll_minutes_per_week: sollMinutes, updated_at: new Date().toISOString() })
    .eq('id', profileId)
  if (error) return { error: { message: error.message } }
  return { error: null }
}
