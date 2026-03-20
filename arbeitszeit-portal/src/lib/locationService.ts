import { supabase } from './supabase'

const getFunctionsUrl = (): string => {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
  return url ? `${url}/functions/v1` : ''
}

export type EmployeeLocation = {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  lat: number | null
  lon: number | null
  accuracy: number | null
  updated_at: string | null
  has_pending_request: boolean
}

/** Holt alle Mitarbeiter mit Einwilligung (inkl. Standort falls gesendet, Anforderungsstatus). */
export const getEmployeeLocations = async (): Promise<EmployeeLocation[]> => {
  const { data, error } = await supabase.rpc('get_employee_locations')
  if (error) throw error
  return (data ?? []) as EmployeeLocation[]
}

/** Fordert den aktuellen Standort eines Mitarbeiters an. Sendet bei Erfolg zusätzlich Web-Push. */
export const requestEmployeeLocation = async (userId: string): Promise<{ error: string | null }> => {
  const { error } = await supabase.rpc('request_employee_location', { p_user_id: userId })
  if (error) return { error: error.message }

  const baseUrl = getFunctionsUrl()
  if (baseUrl) {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (token) {
      try {
        await fetch(`${baseUrl}/send-standort-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: userId }),
        })
      } catch {
        // Push optional – Fehler ignorieren
      }
    }
  }
  return { error: null }
}
