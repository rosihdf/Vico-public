import { supabase } from './supabase'

export type WorkSettings = {
  id: string
  bundesland: string
  work_days: number[]
  hours_per_day: number
  updated_at: string
}

export type WorkFreeDay = {
  id: string
  date: string
  type: string
  label: string | null
  created_at: string
}

const BUNDESLAENDER = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
] as const

export { BUNDESLAENDER }

/** 0=So, 1=Mo, …, 6=Sa */
const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const

export const getWeekdayLabel = (d: number) => WEEKDAY_LABELS[d] ?? String(d)

export const fetchWorkSettings = async (): Promise<WorkSettings | null> => {
  const { data, error } = await supabase
    .from('work_settings')
    .select('id, bundesland, work_days, hours_per_day, updated_at')
    .limit(1)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    bundesland: data.bundesland ?? 'BE',
    work_days: Array.isArray(data.work_days) ? data.work_days : [1, 2, 3, 4, 5],
    hours_per_day: Number(data.hours_per_day) || 8,
    updated_at: data.updated_at ?? '',
  }
}

export const updateWorkSettings = async (
  id: string,
  bundesland: string,
  workDays: number[],
  hoursPerDay: number
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase
    .from('work_settings')
    .update({
      bundesland: bundesland || 'BE',
      work_days: workDays.length ? workDays : [1, 2, 3, 4, 5],
      hours_per_day: Math.max(0, Math.min(24, hoursPerDay)),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export const fetchWorkFreeDays = async (): Promise<WorkFreeDay[]> => {
  const { data, error } = await supabase
    .from('work_free_days')
    .select('id, date, type, label, created_at')
    .order('date', { ascending: true })
  if (error) return []
  return (data ?? []) as WorkFreeDay[]
}

export const insertWorkFreeDay = async (
  date: string,
  type: string,
  label: string | null
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.from('work_free_days').insert({
    date,
    type: type || 'frei',
    label: label?.trim() || null,
  })
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export const deleteWorkFreeDay = async (id: string): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase.from('work_free_days').delete().eq('id', id)
  if (error) return { error: { message: error.message } }
  return { error: null }
}

export const refreshHolidays = async (
  bundesland?: string,
  years?: number[]
): Promise<{ error: { message: string } | null; count?: number }> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    return { error: { message: 'Session-Fehler. Bitte erneut einloggen.' } }
  }
  const token = session?.access_token
  if (!token) {
    return { error: { message: 'Nicht angemeldet. Bitte erneut einloggen.' } }
  }

  const { data: refreshed } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token })
  const accessToken = refreshed?.session?.access_token ?? token

  const url = `${(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')}/functions/v1/refresh-holidays`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      bundesland: bundesland ?? 'BE',
      years: years ?? [2024, 2025, 2026, 2027],
    }),
  })

  let body: { error?: string; count?: number } = {}
  try {
    body = (await res.json()) as { error?: string; count?: number }
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg = typeof body?.error === 'string' ? body.error : `Fehler ${res.status}: ${res.statusText}`
    return { error: { message: msg } }
  }

  const err = body?.error
  if (err) return { error: { message: err } }
  return { error: null, count: body?.count ?? 0 }
}
