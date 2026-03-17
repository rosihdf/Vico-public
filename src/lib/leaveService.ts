import { supabase } from '../supabase'

export type LeaveType = 'urlaub' | 'krank' | 'sonderurlaub' | 'unbezahlt' | 'sonstiges'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export type LeaveRequest = {
  id: string
  user_id: string
  from_date: string
  to_date: string
  leave_type: LeaveType
  status: LeaveStatus
  days_count: number | null
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

/** Eigene Urlaubsanträge abrufen */
export const fetchMyLeaveRequests = async (
  dateFrom?: string | null,
  dateTo?: string | null,
  status?: LeaveStatus | null
): Promise<LeaveRequest[]> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return []
  const { data, error } = await supabase.rpc('get_leave_requests', {
    p_user_id: user.id,
    p_date_from: dateFrom ?? null,
    p_date_to: dateTo ?? null,
    p_status: status ?? null,
  })
  if (error) return []
  return (data ?? []).map((r: { id: string; user_id: string; from_date: string; to_date: string; leave_type: string; status: string; days_count: number | null; notes: string | null; created_at: string }) => ({
    id: r.id,
    user_id: r.user_id,
    from_date: r.from_date,
    to_date: r.to_date,
    leave_type: r.leave_type as LeaveType,
    status: r.status as LeaveStatus,
    days_count: r.days_count,
    notes: r.notes,
    created_at: r.created_at,
  }))
}

/** Urlaubsantrag stellen */
export const createLeaveRequest = async (
  fromDate: string,
  toDate: string,
  leaveType: LeaveType = 'urlaub',
  notes?: string | null
): Promise<{ error: { message: string } | null }> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: { message: 'Nicht angemeldet' } }
  const { error } = await supabase.from('leave_requests').insert({
    user_id: user.id,
    from_date: fromDate,
    to_date: toDate,
    leave_type: leaveType,
    status: 'pending',
    notes: notes?.trim() || null,
  })
  if (error) return { error: { message: error.message } }
  return { error: null }
}
