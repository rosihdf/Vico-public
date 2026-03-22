import { supabase } from './supabase'

export type LeaveType = 'urlaub' | 'krank' | 'sonderurlaub' | 'unbezahlt' | 'sonstiges'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export type LeaveRequest = {
  id: string
  user_id: string
  user_email: string | null
  user_name: string | null
  from_date: string
  to_date: string
  leave_type: LeaveType
  status: LeaveStatus
  days_count: number | null
  approved_from_date: string | null
  approved_to_date: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  notes: string | null
  created_at: string
}

export type LeaveBalanceSnapshot = {
  days_total: number
  days_carried_over: number
  approved_urlaub_in_year: number
  pending_urlaub_in_year: number
  zusatz_sum: number
  vj_deadline: string
  vj_hint_acknowledged: boolean
  available_statutory: number
}

export type LeaveExtraEntitlement = {
  id: string
  user_id: string
  days_remaining: number
  expires_on: string
  title: string
  same_rules_as_statutory: boolean
  created_at: string
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  urlaub: 'Urlaub',
  krank: 'Krank',
  sonderurlaub: 'Sonderurlaub',
  unbezahlt: 'Unbezahlt',
  sonstiges: 'Sonstiges',
}

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Offen',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
}

export const fetchLeaveRequests = async (
  userId?: string | null,
  dateFrom?: string | null,
  dateTo?: string | null,
  status?: LeaveStatus | null
): Promise<LeaveRequest[]> => {
  const { data, error } = await supabase.rpc('get_leave_requests', {
    p_user_id: userId ?? null,
    p_date_from: dateFrom ?? null,
    p_date_to: dateTo ?? null,
    p_status: status ?? null,
  })
  if (error) return []
  return (data ?? []) as LeaveRequest[]
}

export const createLeaveRequest = async (
  userId: string,
  fromDate: string,
  toDate: string,
  leaveType: LeaveType = 'urlaub',
  notes?: string | null
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.from('leave_requests').insert({
    user_id: userId,
    from_date: fromDate,
    to_date: toDate,
    leave_type: leaveType,
    status: 'pending',
    notes: notes?.trim() || null,
  })
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export const approveLeaveRequest = async (
  requestId: string,
  approved: boolean,
  rejectionReason?: string | null,
  partial?: { approvedFrom: string; approvedTo: string } | null
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.rpc('approve_leave_request', {
    p_request_id: requestId,
    p_approved: approved,
    p_rejection_reason: rejectionReason ?? null,
    p_approved_from: partial && approved ? partial.approvedFrom : null,
    p_approved_to: partial && approved ? partial.approvedTo : null,
  })
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export const fetchLeaveBalanceSnapshot = async (
  userId: string,
  year: number
): Promise<LeaveBalanceSnapshot | null> => {
  const { data, error } = await supabase.rpc('get_leave_balance_snapshot', {
    p_user_id: userId,
    p_year: year,
  })
  if (error || !data || !Array.isArray(data) || data.length === 0) return null
  const row = data[0] as Record<string, unknown>
  return {
    days_total: Number(row.days_total ?? 0),
    days_carried_over: Number(row.days_carried_over ?? 0),
    approved_urlaub_in_year: Number(row.approved_urlaub_in_year ?? 0),
    pending_urlaub_in_year: Number(row.pending_urlaub_in_year ?? 0),
    zusatz_sum: Number(row.zusatz_sum ?? 0),
    vj_deadline: String(row.vj_deadline ?? ''),
    vj_hint_acknowledged: Boolean(row.vj_hint_acknowledged),
    available_statutory: Number(row.available_statutory ?? 0),
  }
}

export const acknowledgeLeaveVjHint = async (year: number): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.rpc('acknowledge_leave_vj_hint', { p_year: year })
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export const fetchLeaveExtraEntitlements = async (userId: string): Promise<LeaveExtraEntitlement[]> => {
  const { data, error } = await supabase.rpc('get_leave_extra_entitlements', { p_user_id: userId })
  if (error || !data) return []
  return (data as LeaveExtraEntitlement[]).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    days_remaining: Number(r.days_remaining),
    expires_on: r.expires_on,
    title: r.title,
    same_rules_as_statutory: Boolean(r.same_rules_as_statutory),
    created_at: r.created_at,
  }))
}

export const insertLeaveExtraEntitlement = async (
  userId: string,
  daysRemaining: number,
  expiresOn: string,
  title?: string,
  sameRulesAsStatutory?: boolean
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.rpc('insert_leave_extra_entitlement', {
    p_user_id: userId,
    p_days_remaining: daysRemaining,
    p_expires_on: expiresOn,
    p_title: title ?? 'Zusatzurlaub',
    p_same_rules_as_statutory: sameRulesAsStatutory ?? false,
  })
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export const deleteLeaveExtraEntitlement = async (
  id: string
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.rpc('delete_leave_extra_entitlement', { p_id: id })
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export const fetchUrlaubVjDeadlineSettings = async (): Promise<{ month: number; day: number }> => {
  const { data, error } = await supabase.rpc('get_urlaub_vj_deadline_settings')
  if (error || !data || !Array.isArray(data) || data.length === 0) return { month: 3, day: 31 }
  const row = data[0] as { global_month: number; global_day: number }
  return { month: Number(row.global_month ?? 3), day: Number(row.global_day ?? 31) }
}

export const setUrlaubVjDeadlineGlobal = async (
  month: number,
  day: number
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.rpc('set_urlaub_vj_deadline_global', {
    p_month: month,
    p_day: day,
  })
  if (error) return { error: { message: error.message } }
  return { error: null }
}
