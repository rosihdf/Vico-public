import { supabase } from '../supabase'
import { TIME_ENTRY_COLUMNS, TIME_BREAK_COLUMNS } from './dataColumns'
import {
  getWeekBounds,
  getMonthBounds,
  calcWorkMinutes,
} from '../../shared/timeUtils'
import {
  getCachedTimeEntries,
  setCachedTimeEntries,
  getTimeOutbox,
  addToTimeOutbox,
  updateTimeOutboxItem,
  addToOutbox,
} from './offlineStorage'
import { notifyDataChange } from './dataService'
import type { TimeEntry, TimeBreak, TimeEntryEditLogRow } from '../types'

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine

const toDateStr = (d: Date): string => d.toISOString().slice(0, 10)

export { getWeekBounds, getMonthBounds, calcWorkMinutes }

/** Letzter beendeter Eintrag (für §5 ArbZG Ruhezeit-Prüfung). */
export const getLastEndedEntry = async (userId: string): Promise<TimeEntry | null> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('time_entries')
      .select(TIME_ENTRY_COLUMNS)
      .eq('user_id', userId)
      .not('end', 'is', null)
      .order('end', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return null
    return (data ?? null) as TimeEntry | null
  }
  const cached = (getCachedTimeEntries() as TimeEntry[]).filter(
    (e) => e.user_id === userId && e.end != null
  )
  const outbox = getTimeOutbox().filter((o) => o.user_id === userId && o.end != null)
  const fromOutbox: TimeEntry[] = outbox.map((o) => ({
    id: o.tempId,
    user_id: o.user_id,
    date: o.date,
    start: o.start,
    end: o.end!,
    notes: null,
    order_id: o.order_id ?? null,
    created_at: o.timestamp,
    updated_at: o.timestamp,
  }))
  const merged = [...fromOutbox, ...cached]
  merged.sort((a, b) => (b.end || '').localeCompare(a.end || ''))
  return merged[0] ?? null
}

export const fetchTimeEntriesForUser = async (
  userId: string,
  fromDate: string,
  toDate: string
): Promise<TimeEntry[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('time_entries')
      .select(TIME_ENTRY_COLUMNS)
      .eq('user_id', userId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('start', { ascending: false })
    if (error) return []
    const entries = (data ?? []) as unknown as TimeEntry[]
    const cached = getCachedTimeEntries() as TimeEntry[]
    const otherCached = cached.filter(
      (e) => e.user_id !== userId || e.date < fromDate || e.date > toDate
    )
    setCachedTimeEntries([...entries, ...otherCached])
    return entries
  }
  const cached = (getCachedTimeEntries() as TimeEntry[]).filter(
    (e) => e.user_id === userId && e.date >= fromDate && e.date <= toDate
  )
  const outbox = getTimeOutbox().filter(
    (o) => o.user_id === userId && o.date >= fromDate && o.date <= toDate
  )
  const fromOutbox: TimeEntry[] = outbox.map((o) => ({
    id: o.tempId,
    user_id: o.user_id,
    date: o.date,
    start: o.start,
    end: o.end,
    notes: null,
    order_id: o.order_id ?? null,
    created_at: o.timestamp,
    updated_at: o.timestamp,
    location_start_lat: o.location_start_lat ?? null,
    location_start_lon: o.location_start_lon ?? null,
    location_end_lat: o.location_end_lat ?? null,
    location_end_lon: o.location_end_lon ?? null,
  }))
  const merged = [...fromOutbox, ...cached]
  merged.sort((a, b) => (b.start || '').localeCompare(a.start || ''))
  return merged
}

export const fetchTimeBreaksForEntry = async (entryId: string): Promise<TimeBreak[]> => {
  if (entryId.startsWith('temp-')) {
    const outbox = getTimeOutbox().find((o) => o.tempId === entryId)
    if (!outbox) return []
    return outbox.breaks.map((b, i) => ({
      id: `temp-break-${entryId}-${i}`,
      time_entry_id: entryId,
      start: b.start,
      end: b.end,
      created_at: b.start,
    }))
  }
  if (isOnline()) {
    const { data, error } = await supabase
      .from('time_breaks')
      .select(TIME_BREAK_COLUMNS)
      .eq('time_entry_id', entryId)
      .order('start', { ascending: true })
    if (error) return []
    return (data ?? []) as unknown as TimeBreak[]
  }
  return []
}

export type TimeEntryLocation = { lat: number; lon: number }

export const startTimeEntry = async (
  userId: string,
  location?: TimeEntryLocation | null
): Promise<{ data: TimeEntry | null; error: { message: string } | null }> => {
  const now = new Date()
  const dateStr = toDateStr(now)
  const startStr = now.toISOString()

  if (!isOnline()) {
    const tempId = `temp-${crypto.randomUUID()}`
    addToTimeOutbox({
      tempId,
      user_id: userId,
      date: dateStr,
      start: startStr,
      end: null,
      breaks: [],
      order_id: null,
      location_start_lat: location?.lat ?? null,
      location_start_lon: location?.lon ?? null,
    })
    notifyDataChange()
    return {
      data: {
        id: tempId,
        user_id: userId,
        date: dateStr,
        start: startStr,
        end: null,
        notes: null,
        order_id: null,
        created_at: startStr,
        updated_at: startStr,
        location_start_lat: location?.lat ?? null,
        location_start_lon: location?.lon ?? null,
      },
      error: null,
    }
  }

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    date: dateStr,
    start: startStr,
    order_id: null,
  }
  if (location != null) {
    insertPayload.location_start_lat = location.lat
    insertPayload.location_start_lon = location.lon
  }
  const { data, error } = await supabase
    .from('time_entries')
    .insert(insertPayload)
    .select(TIME_ENTRY_COLUMNS)
    .single()
  if (error) return { data: null, error: { message: error.message } }
  const entry = data as unknown as TimeEntry
  const cached = getCachedTimeEntries() as TimeEntry[]
  setCachedTimeEntries([entry, ...cached])
  notifyDataChange()
  return { data: entry, error: null }
}

export const endTimeEntry = async (
  entryId: string,
  userId: string,
  location?: TimeEntryLocation | null
): Promise<{ error: { message: string } | null }> => {
  const endStr = new Date().toISOString()

  if (entryId.startsWith('temp-')) {
    updateTimeOutboxItem(entryId, (o) => ({
      ...o,
      end: endStr,
      location_end_lat: location?.lat ?? o.location_end_lat,
      location_end_lon: location?.lon ?? o.location_end_lon,
    }))
    notifyDataChange()
    return { error: null }
  }

  if (!isOnline()) {
    const payload: Record<string, unknown> = { id: entryId, end: endStr, updated_at: endStr }
    if (location != null) {
      payload.location_end_lat = location.lat
      payload.location_end_lon = location.lon
    }
    addToOutbox({ table: 'time_entries', action: 'update', payload })
    const cached = (getCachedTimeEntries() as TimeEntry[]).map((e) =>
      e.id === entryId
        ? {
            ...e,
            end: endStr,
            updated_at: endStr,
            location_end_lat: location?.lat ?? e.location_end_lat,
            location_end_lon: location?.lon ?? e.location_end_lon,
          }
        : e
    )
    setCachedTimeEntries(cached)
    notifyDataChange()
    return { error: null }
  }

  const updatePayload: Record<string, unknown> = { end: endStr, updated_at: endStr }
  if (location != null) {
    updatePayload.location_end_lat = location.lat
    updatePayload.location_end_lon = location.lon
  }
  const { error } = await supabase
    .from('time_entries')
    .update(updatePayload)
    .eq('id', entryId)
    .eq('user_id', userId)
  if (error) return { error: { message: error.message } }
  const cached = (getCachedTimeEntries() as TimeEntry[]).map((e) =>
    e.id === entryId
      ? { ...e, end: endStr, updated_at: endStr, location_end_lat: location?.lat, location_end_lon: location?.lon }
      : e
  )
  setCachedTimeEntries(cached)
  notifyDataChange()
  return { error: null }
}

export const startBreak = async (
  entryId: string,
  _userId: string
): Promise<{ data: TimeBreak | null; error: { message: string } | null }> => {
  const startStr = new Date().toISOString()

  if (entryId.startsWith('temp-')) {
    updateTimeOutboxItem(entryId, (o) => ({
      ...o,
      breaks: [...o.breaks, { start: startStr, end: null }],
    }))
    notifyDataChange()
    return {
      data: {
        id: `temp-break-${entryId}-${Date.now()}`,
        time_entry_id: entryId,
        start: startStr,
        end: null,
        created_at: startStr,
      },
      error: null,
    }
  }

  if (!isOnline()) {
    return { data: null, error: { message: 'Offline: Pause nur bei Verbindung speicherbar' } }
  }

  const { data, error } = await supabase
    .from('time_breaks')
    .insert({ time_entry_id: entryId, start: startStr })
    .select()
    .single()
  if (error) return { data: null, error: { message: error.message } }
  return { data: data as TimeBreak, error: null }
}

export const endBreak = async (
  breakId: string,
  entryId: string,
  _userId: string
): Promise<{ error: { message: string } | null }> => {
  const endStr = new Date().toISOString()

  if (breakId.startsWith('temp-break-')) {
    const outbox = getTimeOutbox().find((o) => o.tempId === entryId)
    if (!outbox) return { error: { message: 'Eintrag nicht gefunden' } }
    const breakIdx = outbox.breaks.findIndex((b) => !b.end)
    if (breakIdx < 0) return { error: { message: 'Keine aktive Pause' } }
    updateTimeOutboxItem(entryId, (o) => {
      const next = [...o.breaks]
      next[breakIdx] = { ...next[breakIdx], end: endStr }
      return { ...o, breaks: next }
    })
    notifyDataChange()
    return { error: null }
  }

  if (!isOnline()) {
    return { error: { message: 'Offline: Pausenende nur bei Verbindung speicherbar' } }
  }

  const { error } = await supabase
    .from('time_breaks')
    .update({ end: endStr })
    .eq('id', breakId)
    .eq('time_entry_id', entryId)
  return error ? { error: { message: error.message } } : { error: null }
}

export const getActiveEntry = (entries: TimeEntry[]): TimeEntry | null =>
  entries.find((e) => !e.end) ?? null

export const getActiveBreak = (_entry: TimeEntry, breaks: TimeBreak[]): TimeBreak | null =>
  breaks.find((b) => !b.end) ?? null

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
  const cached = getCachedTimeEntries() as TimeEntry[]
  const updated = cached.map((e) =>
    e.id === entryId ? { ...e, start: newStart, end: newEnd, order_id: null, updated_at: new Date().toISOString() } : e
  )
  setCachedTimeEntries(updated)
  notifyDataChange()
  return { error: null }
}

export type TimeEntryEditLogFilters = {
  dateFrom?: string
  dateTo?: string
  entryUserId?: string | null
}

export const fetchTimeEntryEditLog = async (
  limit = 100,
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
