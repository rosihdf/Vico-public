import { supabase } from './supabase'

export const subscribeToOrderChanges = (onChange: () => void): (() => void) => {
  const channel = supabase
    .channel('orders-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => onChange()
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
