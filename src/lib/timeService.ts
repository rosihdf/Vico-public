import { supabase } from '../supabase'
import {
  getCachedTimeEntries,
  setCachedTimeEntries,
  getTimeOutbox,
  addToTimeOutbox,
  updateTimeOutboxItem,
  addToOutbox,
} from './offlineStorage'
import { notifyDataChange } from './dataService'
import type { TimeEntry, TimeBreak } from '../types'

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine

const toDateStr = (d: Date): string => d.toISOString().slice(0, 10)

export const fetchTimeEntriesForUser = async (
  userId: string,
  fromDate: string,
  toDate: string
): Promise<TimeEntry[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('start', { ascending: false })
    if (error) return []
    const entries = (data ?? []) as TimeEntry[]
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
    order_id: null,
    created_at: o.timestamp,
    updated_at: o.timestamp,
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
      .select('*')
      .eq('time_entry_id', entryId)
      .order('start', { ascending: true })
    if (error) return []
    return (data ?? []) as TimeBreak[]
  }
  return []
}

export const startTimeEntry = async (userId: string): Promise<{ data: TimeEntry | null; error: { message: string } | null }> => {
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
      },
      error: null,
    }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({ user_id: userId, date: dateStr, start: startStr })
    .select()
    .single()
  if (error) return { data: null, error: { message: error.message } }
  const entry = data as TimeEntry
  const cached = getCachedTimeEntries() as TimeEntry[]
  setCachedTimeEntries([entry, ...cached])
  notifyDataChange()
  return { data: entry, error: null }
}

export const endTimeEntry = async (
  entryId: string,
  userId: string
): Promise<{ error: { message: string } | null }> => {
  const endStr = new Date().toISOString()

  if (entryId.startsWith('temp-')) {
    updateTimeOutboxItem(entryId, (o) => ({ ...o, end: endStr }))
    notifyDataChange()
    return { error: null }
  }

  if (!isOnline()) {
    addToOutbox({
      table: 'time_entries',
      action: 'update',
      payload: { id: entryId, end: endStr, updated_at: endStr },
    })
    const cached = (getCachedTimeEntries() as TimeEntry[]).map((e) =>
      e.id === entryId ? { ...e, end: endStr, updated_at: endStr } : e
    )
    setCachedTimeEntries(cached)
    notifyDataChange()
    return { error: null }
  }

  const { error } = await supabase
    .from('time_entries')
    .update({ end: endStr, updated_at: endStr })
    .eq('id', entryId)
    .eq('user_id', userId)
  if (error) return { error: { message: error.message } }
  const cached = (getCachedTimeEntries() as TimeEntry[]).map((e) =>
    e.id === entryId ? { ...e, end: endStr, updated_at: endStr } : e
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

export const calcWorkMinutes = (entry: TimeEntry, breaks: TimeBreak[]): number => {
  const start = new Date(entry.start).getTime()
  const end = entry.end ? new Date(entry.end).getTime() : Date.now()
  let total = (end - start) / 60000
  for (const b of breaks) {
    const bStart = new Date(b.start).getTime()
    const bEnd = b.end ? new Date(b.end).getTime() : Date.now()
    total -= (bEnd - bStart) / 60000
  }
  return Math.max(0, Math.floor(total))
}
