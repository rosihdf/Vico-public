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
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  notes: string | null
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
  rejectionReason?: string | null
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.rpc('approve_leave_request', {
    p_request_id: requestId,
    p_approved: approved,
    p_rejection_reason: rejectionReason ?? null,
  })
  if (error) return { error: { message: error.message } }
  return { error: null }
}
