import { supabase } from '../../supabase'
import { PORTAL_USER_COLUMNS } from '../dataColumns'
import { isOnline } from '../../../shared/networkUtils'

export type PortalUser = {
  id: string
  customer_id: string
  email: string
  user_id: string | null
  invited_by: string | null
  invited_at: string
  created_at: string
}

export const fetchPortalUsers = async (customerId: string): Promise<PortalUser[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('customer_portal_users')
    .select(PORTAL_USER_COLUMNS)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as unknown as PortalUser[]
}

export const invitePortalUser = async (
  customerId: string,
  email: string
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('invite-portal-user', {
    body: { customer_id: customerId, email },
  })
  if (error) return { success: false, error: error.message }
  const bodyError = (data as { error?: string })?.error
  if (bodyError) return { success: false, error: bodyError }
  return { success: true }
}

export const deletePortalUser = async (
  id: string
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Offline: Nicht möglich' } }
  const { error } = await supabase.from('customer_portal_users').delete().eq('id', id)
  return { error: error ? { message: error.message } : null }
}

export type PortalUserAssignment = {
  id: string
  user_id: string | null
  customer_id: string
  email: string
}

const PORTAL_ASSIGNMENT_COLUMNS = 'id, user_id, customer_id, email'

export const fetchAllPortalUserAssignments = async (): Promise<PortalUserAssignment[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('customer_portal_users')
    .select(PORTAL_ASSIGNMENT_COLUMNS)
  if (error) return []
  return (data ?? []) as PortalUserAssignment[]
}

export const linkPortalUserToCustomer = async (
  userId: string,
  email: string,
  customerId: string
): Promise<{ error: string | null }> => {
  if (!isOnline()) return { error: 'Offline: Nicht möglich' }
  const { error } = await supabase.from('customer_portal_users').insert({
    user_id: userId,
    email,
    customer_id: customerId,
  })
  return { error: error?.message ?? null }
}

// --- Portal-Objekt/BV-Sichtbarkeit (Whitelist) ---

export type PortalVisibilityRow = { user_id: string; customer_id: string; bv_id: string }

export const fetchPortalVisibility = async (userId: string): Promise<PortalVisibilityRow[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('portal_user_object_visibility')
    .select('user_id, customer_id, bv_id')
    .eq('user_id', userId)
  if (error) return []
  return (data ?? []) as PortalVisibilityRow[]
}

export const setPortalVisibilityForCustomer = async (
  userId: string,
  customerId: string,
  bvIds: string[]
): Promise<{ error: string | null }> => {
  if (!isOnline()) return { error: 'Offline: Nicht möglich' }
  const { error: delErr } = await supabase
    .from('portal_user_object_visibility')
    .delete()
    .eq('user_id', userId)
    .eq('customer_id', customerId)
  if (delErr) return { error: delErr.message }
  if (bvIds.length === 0) return { error: null }
  const rows = bvIds.map((bv_id) => ({ user_id: userId, customer_id: customerId, bv_id }))
  const { error: insErr } = await supabase.from('portal_user_object_visibility').insert(rows)
  return { error: insErr?.message ?? null }
}
