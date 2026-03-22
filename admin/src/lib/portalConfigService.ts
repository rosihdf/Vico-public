import { supabase } from './supabase'
import type { AppVersionsMap } from '../../../shared/appVersions'

/** Key in `platform_config` – globale Standard-App-Versionen (Merge mit Mandant in Lizenz-API). */
export const DEFAULT_APP_VERSIONS_CONFIG_KEY = 'default_app_versions'

export const fetchDefaultAppVersionsJson = async (): Promise<Record<string, unknown>> => {
  const { data, error } = await supabase
    .from('platform_config')
    .select('value')
    .eq('key', DEFAULT_APP_VERSIONS_CONFIG_KEY)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const v = data?.value
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return {}
}

export const upsertDefaultAppVersions = async (map: AppVersionsMap | Record<string, unknown>): Promise<void> => {
  const { error } = await supabase.from('platform_config').upsert({
    key: DEFAULT_APP_VERSIONS_CONFIG_KEY,
    value: map,
  })
  if (error) throw new Error(error.message)
}
