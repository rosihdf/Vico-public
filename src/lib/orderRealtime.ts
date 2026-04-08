import { recordMandantRealtimeSubscribeStatus } from '../../shared/mandantRealtimeDegraded'
import { supabase } from '../supabase'

export const subscribeToOrderChanges = (onChange: () => void): (() => void) => {
  const channel = supabase
    .channel('orders-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => onChange()
    )
    .subscribe((status, err) => {
      recordMandantRealtimeSubscribeStatus(status, err ?? undefined)
    })

  return () => {
    supabase.removeChannel(channel)
  }
}
