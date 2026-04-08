import { recordMandantRealtimeSubscribeStatus } from '../../shared/mandantRealtimeDegraded'
import { supabase } from '../supabase'

export const subscribeToProfileChanges = (onChange: () => void): (() => void) => {
  const channel = supabase
    .channel('profiles-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      () => onChange()
    )
    .subscribe((status, err) => {
      recordMandantRealtimeSubscribeStatus(status, err ?? undefined)
    })

  return () => {
    supabase.removeChannel(channel)
  }
}
