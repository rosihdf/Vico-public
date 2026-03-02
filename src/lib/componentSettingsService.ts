import { supabase } from '../supabase'

export type ComponentSetting = {
  id: string
  component_key: string
  label: string
  enabled: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export const DEFAULT_SETTINGS_META: { component_key: string; label: string; enabled: boolean; sort_order: number }[] = [
  { component_key: 'dashboard', label: 'Dashboard', enabled: true, sort_order: 0 },
  { component_key: 'kunden', label: 'Kunden', enabled: true, sort_order: 1 },
  { component_key: 'suche', label: 'Suche', enabled: true, sort_order: 2 },
  { component_key: 'auftrag', label: 'Auftrag', enabled: true, sort_order: 3 },
  { component_key: 'scan', label: 'Scan', enabled: true, sort_order: 4 },
  { component_key: 'wartungsprotokolle', label: 'Wartungsprotokolle', enabled: true, sort_order: 5 },
  { component_key: 'benutzerverwaltung', label: 'Benutzerverwaltung', enabled: true, sort_order: 6 },
  { component_key: 'einstellungen', label: 'Einstellungen', enabled: true, sort_order: 7 },
  { component_key: 'profil', label: 'Profil', enabled: true, sort_order: 8 },
]

const DEFAULT_SETTINGS: Record<string, boolean> = Object.fromEntries(
  DEFAULT_SETTINGS_META.map((m) => [m.component_key, m.enabled])
)

export type UpdateResult = { ok: boolean; error?: string }

export const fetchComponentSettings = async (): Promise<Record<string, boolean>> => {
  const { data, error } = await supabase
    .from('component_settings')
    .select('component_key, enabled')
    .order('sort_order', { ascending: true })

  if (error || !data) {
    return DEFAULT_SETTINGS
  }

  const result: Record<string, boolean> = { ...DEFAULT_SETTINGS }
  data.forEach((row: { component_key: string; enabled: boolean }) => {
    result[row.component_key] = row.enabled
  })
  return result
}

export const fetchComponentSettingsFull = async (): Promise<ComponentSetting[]> => {
  const { data, error } = await supabase
    .from('component_settings')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error || !data) return []
  return data as ComponentSetting[]
}

export const updateComponentSetting = async (
  componentKey: string,
  enabled: boolean
): Promise<UpdateResult> => {
  const meta = DEFAULT_SETTINGS_META.find((m) => m.component_key === componentKey)
  const now = new Date().toISOString()

  const { data: updated, error: updateError } = await supabase
    .from('component_settings')
    .update({ enabled, updated_at: now })
    .eq('component_key', componentKey)
    .select('id')

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  if (updated && updated.length > 0) {
    return { ok: true }
  }

  const { error: insertError } = await supabase.from('component_settings').insert({
    component_key: componentKey,
    label: meta?.label ?? componentKey,
    enabled,
    sort_order: meta?.sort_order ?? 0,
    updated_at: now,
  })

  if (insertError) {
    return { ok: false, error: insertError.message }
  }
  return { ok: true }
}
