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
  vacation_days_per_year: number | null
}

export const fetchProfiles = async (): Promise<Profile[]> => {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_profiles_for_zeiterfassung')
  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData.map((row: { id: string; email: string | null; first_name: string | null; last_name: string | null; role: string; soll_minutes_per_month?: number | null; soll_minutes_per_week?: number | null; vacation_days_per_year?: number | null }) => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      role: parseRole(row.role ?? ''),
      soll_minutes_per_month: row.soll_minutes_per_month ?? null,
      soll_minutes_per_week: row.soll_minutes_per_week ?? null,
      vacation_days_per_year: row.vacation_days_per_year ?? null,
    }))
  }
  return []
}

export const getMyRole = async (): Promise<string | null> => {
  const { data, error } = await supabase.rpc('get_my_role')
  if (error || data == null) return null
  return data as string
}

/** Aktualisiert Soll Min/Monat und Min/Woche per RPC (umgeht RLS, zuverlässiger). */
export const updateSollMinutes = async (
  profileId: string,
  sollMinutesPerMonth: number | null,
  sollMinutesPerWeek: number | null
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.rpc('update_profile_soll_minutes', {
    p_profile_id: profileId,
    p_soll_minutes_per_month: sollMinutesPerMonth,
    p_soll_minutes_per_week: sollMinutesPerWeek,
  })
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export const updateVacationDays = async (
  profileId: string,
  vacationDays: number | null
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.rpc('update_profile_vacation_days', {
    p_profile_id: profileId,
    p_vacation_days: vacationDays,
  })
  if (error) return { error: { message: error.message } }
  return { error: null }
}
