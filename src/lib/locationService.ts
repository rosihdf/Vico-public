import { supabase } from '../supabase'
import { isOnline } from '../../shared/networkUtils'

/**
 * Speichert den aktuellen Standort des eingeloggten Mitarbeiters.
 * Admin/Teamleiter können diesen Standort im Arbeitszeitportal abfragen.
 */
export const updateMyCurrentLocation = async (
  lat: number,
  lon: number,
  accuracy: number
): Promise<{ error: string | null }> => {
  if (!isOnline()) {
    return { error: 'Offline – Standort kann nicht gesendet werden.' }
  }
  const { error } = await supabase.rpc('update_my_current_location', {
    p_lat: lat,
    p_lon: lon,
    p_accuracy: accuracy,
  })
  return { error: error?.message ?? null }
}

/** Prüft, ob eine Standortanfrage von Admin/Teamleiter aussteht. */
export const getMyPendingLocationRequest = async (): Promise<string | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase.rpc('get_my_pending_location_request')
  if (error || !data) return null
  return data as string
}

/** Liest, ob Teamleiter Standort abfragen dürfen (nur Admin setzt in Einstellungen). */
export const getStandortabfrageTeamleiterAllowed = async (): Promise<boolean> => {
  if (!isOnline()) return false
  const { data, error } = await supabase.rpc('get_standortabfrage_teamleiter_allowed')
  if (error) return false
  return Boolean(data)
}

/** Setzt, ob Teamleiter Standort abfragen dürfen (nur Admin). */
export const setStandortabfrageTeamleiterAllowed = async (
  allowed: boolean
): Promise<{ error: string | null }> => {
  if (!isOnline()) return { error: 'Offline – Einstellung kann nicht gespeichert werden.' }
  const { error } = await supabase.rpc('set_standortabfrage_teamleiter_allowed', {
    p_allowed: allowed,
  })
  return { error: error?.message ?? null }
}
