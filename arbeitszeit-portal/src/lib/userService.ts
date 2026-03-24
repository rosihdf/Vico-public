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
  /** Individuell; null = Mandanten-Default aus Arbeitseinstellungen */
  hours_per_day: number | null
  employment_start_date: string | null
  employment_end_date: string | null
  vacation_days_per_year: number | null
  /** Optional: Frist-Override Resturlaub VJ (Monat/Tag im Kalenderjahr der Anzeige) */
  urlaub_vj_deadline_month: number | null
  urlaub_vj_deadline_day: number | null
}

export const fetchProfiles = async (): Promise<Profile[]> => {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_profiles_for_zeiterfassung')
  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData.map(
      (row: {
        id: string
        email: string | null
        first_name: string | null
        last_name: string | null
        role: string
        hours_per_day?: number | null
        employment_start_date?: string | null
        employment_end_date?: string | null
        vacation_days_per_year?: number | null
        urlaub_vj_deadline_month?: number | null
        urlaub_vj_deadline_day?: number | null
      }) => ({
        id: row.id,
        email: row.email,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        role: parseRole(row.role ?? ''),
        hours_per_day: row.hours_per_day != null ? Number(row.hours_per_day) : null,
        employment_start_date: row.employment_start_date ?? null,
        employment_end_date: row.employment_end_date ?? null,
        vacation_days_per_year: row.vacation_days_per_year ?? null,
        urlaub_vj_deadline_month: row.urlaub_vj_deadline_month ?? null,
        urlaub_vj_deadline_day: row.urlaub_vj_deadline_day ?? null,
      })
    )
  }
  return []
}

export const getMyRole = async (): Promise<string | null> => {
  const { data, error } = await supabase.rpc('get_my_role')
  if (error || data == null) return null
  return data as string
}

/** Std/Tag, Eintritt, Austritt – Monatssoll wird aus Kalenderarbeitstagen × Stunden berechnet. */
export const updateAzkStammdaten = async (
  profileId: string,
  hoursPerDay: number | null,
  employmentStart: string | null,
  employmentEnd: string | null
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.rpc('update_profile_azk_stammdaten', {
    p_profile_id: profileId,
    p_hours_per_day: hoursPerDay,
    p_employment_start: employmentStart,
    p_employment_end: employmentEnd,
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

/** Admin: optional Monat/Tag für Frist „Resturlaub VJ“; null/null zum Zurücksetzen */
export const updateUrlaubVjDeadlineOverride = async (
  profileId: string,
  month: number | null,
  day: number | null
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.rpc('update_profile_urlaub_vj_deadline_override', {
    p_profile_id: profileId,
    p_month: month,
    p_day: day,
  })
  if (error) return { error: { message: error.message } }
  return { error: null }
}
