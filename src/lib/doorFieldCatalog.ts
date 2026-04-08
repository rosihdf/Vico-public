import { supabase } from '../supabase'
import { isOnline } from '../../shared/networkUtils'

export type DoorFieldCatalog = {
  door_manufacturers: string[]
  lock_manufacturers: string[]
  lock_types: string[]
}

const EMPTY: DoorFieldCatalog = {
  door_manufacturers: [],
  lock_manufacturers: [],
  lock_types: [],
}

const parseStringArray = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => (typeof x === 'string' ? x.trim() : String(x ?? '').trim()))
    .filter(Boolean)
}

export const fetchDoorFieldCatalog = async (): Promise<DoorFieldCatalog> => {
  if (!isOnline()) return EMPTY
  const { data, error } = await supabase.from('door_field_catalog').select('*').eq('id', 1).maybeSingle()
  if (error || !data) return EMPTY
  const row = data as Record<string, unknown>
  return {
    door_manufacturers: parseStringArray(row.door_manufacturers),
    lock_manufacturers: parseStringArray(row.lock_manufacturers),
    lock_types: parseStringArray(row.lock_types),
  }
}

export const updateDoorFieldCatalog = async (
  patch: Partial<DoorFieldCatalog>
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    return { error: { message: 'Listen sind nur online speicherbar.' } }
  }
  const now = new Date().toISOString()
  const { data: existing, error: fetchErr } = await supabase.from('door_field_catalog').select('id').eq('id', 1).maybeSingle()
  if (fetchErr) return { error: { message: fetchErr.message } }
  const payload: Record<string, unknown> = { updated_at: now }
  if (patch.door_manufacturers !== undefined) payload.door_manufacturers = patch.door_manufacturers
  if (patch.lock_manufacturers !== undefined) payload.lock_manufacturers = patch.lock_manufacturers
  if (patch.lock_types !== undefined) payload.lock_types = patch.lock_types
  if (!existing) {
    const { error } = await supabase.from('door_field_catalog').insert({
      id: 1,
      door_manufacturers: patch.door_manufacturers ?? [],
      lock_manufacturers: patch.lock_manufacturers ?? [],
      lock_types: patch.lock_types ?? [],
      updated_at: now,
    })
    return { error: error ? { message: error.message } : null }
  }
  const { error } = await supabase.from('door_field_catalog').update(payload).eq('id', 1)
  return { error: error ? { message: error.message } : null }
}
