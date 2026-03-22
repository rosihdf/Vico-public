import { supabase } from './supabase'
import type { TimeEntry, TimeBreak, TimeEntryEditLogRow } from '../types/time'
import {
  getWeekBounds,
  getMonthBounds,
  calcWorkMinutes,
  TIME_ENTRY_COLUMNS,
  TIME_BREAK_COLUMNS,
} from '../../../shared/timeUtils'

export { getWeekBounds, getMonthBounds, calcWorkMinutes }

export const fetchTimeEntriesForUser = async (
  userId: string,
  fromDate: string,
  toDate: string
): Promise<TimeEntry[]> => {
  const { data, error } = await supabase
    .from('time_entries')
    .select(TIME_ENTRY_COLUMNS)
    .eq('user_id', userId)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('start', { ascending: false })
  if (error) return []
  return (data ?? []) as TimeEntry[]
}

export const fetchTimeBreaksForEntry = async (entryId: string): Promise<TimeBreak[]> => {
  const { data, error } = await supabase
    .from('time_breaks')
    .select(TIME_BREAK_COLUMNS)
    .eq('time_entry_id', entryId)
    .order('start', { ascending: true })
  if (error) return []
  return (data ?? []) as TimeBreak[]
}

export type TimeEntryEditReasonCode = 'korrektur' | 'nachreichung' | 'fehler' | 'sonstiges'

export const updateTimeEntryAsAdmin = async (
  entryId: string,
  newStart: string,
  newEnd: string | null,
  reason: string,
  reasonCode: TimeEntryEditReasonCode = 'korrektur'
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.rpc('update_time_entry_admin', {
    p_entry_id: entryId,
    p_new_start: newStart,
    p_new_end: newEnd,
    p_reason: reason.trim() || 'Kein Grund angegeben',
    p_reason_code: reasonCode,
    p_order_id: null,
  })
  if (error) return { error: { message: error.message } }
  return { error: null }
}

/** Neuer Zeiteintrag durch Admin/Teamleiter (Portal: vergessene Stempelung nachtragen). */
export const insertTimeEntryAsAdmin = async (
  userId: string,
  workDate: string,
  startIso: string,
  endIso: string | null,
  reason: string,
  reasonCode: TimeEntryEditReasonCode = 'nachreichung',
  notes: string | null = null
): Promise<{ data: string | null; error: { message: string } | null }> => {
  const { data, error } = await supabase.rpc('insert_time_entry_admin', {
    p_user_id: userId,
    p_date: workDate,
    p_start: startIso,
    p_end: endIso,
    p_reason: reason.trim() || 'Manuell nachtragen',
    p_reason_code: reasonCode,
    p_order_id: null,
    p_notes: notes?.trim() || null,
  })
  if (error) return { data: null, error: { message: error.message } }
  return { data: typeof data === 'string' ? data : null, error: null }
}

export const submitTimeEntryForApproval = async (entryId: string): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase
    .from('time_entries')
    .update({
      approval_status: 'submitted',
      approved_by: null,
      approved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export const approveTimeEntry = async (
  entryId: string,
  status: 'approved' | 'rejected'
): Promise<{ error: { message: string } | null }> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: { message: 'Nicht angemeldet' } }
  const { error } = await supabase
    .from('time_entries')
    .update({
      approval_status: status,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export type TimeEntryEditLogFilters = {
  dateFrom?: string
  dateTo?: string
  entryUserId?: string | null
}

export const fetchTimeEntryEditLog = async (
  limit = 50,
  offset = 0,
  filters?: TimeEntryEditLogFilters
): Promise<TimeEntryEditLogRow[]> => {
  const { data, error } = await supabase.rpc('get_time_entry_edit_log', {
    p_limit: limit,
    p_offset: offset,
    p_date_from: filters?.dateFrom ?? null,
    p_date_to: filters?.dateTo ?? null,
    p_entry_user_id: filters?.entryUserId ?? null,
  })
  if (error) return []
  return (data ?? []) as TimeEntryEditLogRow[]
}
