import { supabase } from './supabase'

export type License = {
  id: string
  tenant_id: string
  license_number: string
  license_model_id: string | null
  tier: string
  valid_until: string | null
  is_trial: boolean
  grace_period_days: number
  max_users: number | null
  max_customers: number | null
  max_storage_mb: number | null
  check_interval: 'on_start' | 'daily' | 'weekly'
  features: Record<string, boolean>
  /** Erhöhen signalisiert Mandanten-Apps (Lizenz-API client_config_version) */
  client_config_version?: number
  created_at: string
  updated_at: string
}

export type LicenseWithTenant = License & {
  tenants: { id: string; name: string } | null
  license_models: { id: string; name: string } | null
}

export type LicenseInsert = {
  tenant_id: string
  license_number: string
  license_model_id?: string | null
  tier?: string
  valid_until?: string | null
  is_trial?: boolean
  grace_period_days?: number
  max_users?: number | null
  max_customers?: number | null
  max_storage_mb?: number | null
  check_interval?: 'on_start' | 'daily' | 'weekly'
  features?: Record<string, boolean>
}

export type LicenseUpdate = Partial<Omit<LicenseInsert, 'tenant_id' | 'license_number'>>

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const generateLicenseNumber = (): string => {
  const segments = ['VIC']
  for (let i = 0; i < 2; i++) {
    let seg = ''
    for (let j = 0; j < 4; j++) {
      seg += CHARS[Math.floor(Math.random() * CHARS.length)]
    }
    segments.push(seg)
  }
  return segments.join('-')
}

export type LimitExceededEntry = {
  id: string
  tenant_id: string | null
  license_id: string | null
  limit_type: string
  current_value: number
  max_value: number
  license_number: string | null
  reported_from: string | null
  created_at: string
  tenants: { id: string; name: string } | null
}

export const fetchLimitExceededLog = async (signal?: AbortSignal): Promise<LimitExceededEntry[]> => {
  let query = supabase
    .from('limit_exceeded_log')
    .select(`
      id,
      tenant_id,
      license_id,
      limit_type,
      current_value,
      max_value,
      license_number,
      reported_from,
      created_at,
      tenants (id, name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) return []
  return (data ?? []) as unknown as LimitExceededEntry[]
}

export const fetchLicenses = async (signal?: AbortSignal): Promise<LicenseWithTenant[]> => {
  let query = supabase
    .from('licenses')
    .select(`
      id,
      tenant_id,
      license_number,
      license_model_id,
      tier,
      valid_until,
      is_trial,
      grace_period_days,
      max_users,
      max_customers,
      max_storage_mb,
      check_interval,
      features,
      created_at,
      updated_at,
      tenants (id, name),
      license_models (id, name)
    `)
    .order('created_at', { ascending: false })
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as LicenseWithTenant[]
}

export type LicenseWithModel = License & {
  license_models: { id: string; name: string; features?: Record<string, boolean> } | null
}

export const fetchLicensesByTenant = async (tenantId: string): Promise<LicenseWithModel[]> => {
  const { data, error } = await supabase
    .from('licenses')
    .select(`
      id,
      tenant_id,
      license_number,
      license_model_id,
      tier,
      valid_until,
      is_trial,
      grace_period_days,
      max_users,
      max_customers,
      max_storage_mb,
      check_interval,
      features,
      client_config_version,
      created_at,
      updated_at,
      license_models (id, name, features)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as LicenseWithModel[]
}

export const checkLicenseNumberExists = async (licenseNumber: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('licenses')
    .select('id')
    .eq('license_number', licenseNumber.trim())
    .maybeSingle()
  if (error) return false
  return !!data
}

export const createLicense = async (payload: LicenseInsert): Promise<{ id: string; license_number: string } | { error: string }> => {
  const { data, error } = await supabase
    .from('licenses')
    .insert({
      tenant_id: payload.tenant_id,
      license_number: payload.license_number,
      license_model_id: payload.license_model_id ?? null,
      tier: payload.tier ?? 'professional',
      valid_until: payload.valid_until ?? null,
      is_trial: payload.is_trial ?? false,
      grace_period_days: payload.grace_period_days ?? 0,
      max_users: payload.max_users ?? null,
      max_customers: payload.max_customers ?? null,
      max_storage_mb: payload.max_storage_mb ?? null,
      check_interval: payload.check_interval ?? 'daily',
      features: payload.features ?? {},
    })
    .select('id, license_number')
    .single()
  if (error) return { error: error.message }
  return { id: data.id, license_number: data.license_number }
}

/**
 * Erhöht `client_config_version` – Mandanten-Apps pollen die Lizenz-API und laden die Konfiguration neu.
 */
export const bumpClientConfigVersion = async (
  licenseId: string
): Promise<{ ok: boolean; client_config_version?: number; error?: string }> => {
  const { data: row, error: selErr } = await supabase
    .from('licenses')
    .select('client_config_version')
    .eq('id', licenseId)
    .maybeSingle()
  if (selErr) return { ok: false, error: selErr.message }
  if (!row) return { ok: false, error: 'Lizenz nicht gefunden' }
  const next =
    Math.max(0, Math.floor(Number((row as { client_config_version?: number }).client_config_version) || 0)) + 1
  const { error } = await supabase
    .from('licenses')
    .update({
      client_config_version: next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', licenseId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, client_config_version: next }
}

/** For each license of the tenant: bump `client_config_version` (after release assignment or rollback). */
export const bumpClientConfigVersionsForTenantLicenses = async (
  tenantId: string
): Promise<{ ok: boolean; error?: string }> => {
  const { data, error } = await supabase.from('licenses').select('id').eq('tenant_id', tenantId)
  if (error) return { ok: false, error: error.message }
  for (const row of data ?? []) {
    const id = String((row as { id: string }).id)
    const r = await bumpClientConfigVersion(id)
    if (!r.ok) return { ok: false, error: r.error }
  }
  return { ok: true }
}

export const updateLicense = async (id: string, payload: LicenseUpdate): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from('licenses')
    .update({
      ...(payload.tier !== undefined && { tier: payload.tier }),
      ...(payload.valid_until !== undefined && { valid_until: payload.valid_until }),
      ...(payload.is_trial !== undefined && { is_trial: payload.is_trial }),
      ...(payload.grace_period_days !== undefined && { grace_period_days: payload.grace_period_days }),
      ...(payload.max_users !== undefined && { max_users: payload.max_users }),
      ...(payload.max_customers !== undefined && { max_customers: payload.max_customers }),
      ...(payload.max_storage_mb !== undefined && { max_storage_mb: payload.max_storage_mb }),
      ...(payload.check_interval !== undefined && { check_interval: payload.check_interval }),
      ...(payload.features !== undefined && { features: payload.features }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  /** Mandanten-Apps pollen `client_config_version` an der Lizenz-API – Push erzwingt schnellen Reload der Konfiguration. */
  const bump = await bumpClientConfigVersion(id)
  if (!bump.ok) {
    return {
      ok: false,
      error: `${bump.error ?? 'client_config_version konnte nicht erhöht werden'} (Lizenzdaten sind trotzdem gespeichert.)`,
    }
  }
  return { ok: true }
}

export const deleteLicense = async (id: string): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase.from('licenses').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// =============================================================================
// LICENSE MODELS (Lizenzmodelle – Vorlagen)
// =============================================================================

export type LicenseModel = {
  id: string
  name: string
  tier: string
  max_users: number | null
  max_customers: number | null
  max_storage_mb: number | null
  check_interval: 'on_start' | 'daily' | 'weekly'
  features: Record<string, boolean>
  sort_order: number
  created_at: string
  updated_at: string
}

export type LicenseModelInsert = {
  name: string
  tier?: string
  max_users?: number | null
  max_customers?: number | null
  max_storage_mb?: number | null
  check_interval?: 'on_start' | 'daily' | 'weekly'
  features?: Record<string, boolean>
  sort_order?: number
}

export type LicenseModelUpdate = Partial<Omit<LicenseModelInsert, never>>

export const fetchLicenseModels = async (signal?: AbortSignal): Promise<LicenseModel[]> => {
  let query = supabase
    .from('license_models')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as LicenseModel[]
}

export const fetchLicenseModel = async (id: string): Promise<LicenseModel | null> => {
  const { data, error } = await supabase.from('license_models').select('*').eq('id', id).single()
  if (error || !data) return null
  return data as LicenseModel
}

export const createLicenseModel = async (payload: LicenseModelInsert): Promise<{ id: string } | { error: string }> => {
  const { data: existing } = await supabase
    .from('license_models')
    .select('id')
    .eq('name', payload.name.trim())
    .eq('tier', payload.tier ?? 'professional')
    .maybeSingle()
  if (existing) return { error: `Lizenzmodell „${payload.name}“ mit Tier „${payload.tier}“ existiert bereits.` }

  const { data, error } = await supabase
    .from('license_models')
    .insert({
      name: payload.name,
      tier: payload.tier ?? 'professional',
      max_users: payload.max_users ?? null,
      max_customers: payload.max_customers ?? null,
      max_storage_mb: payload.max_storage_mb ?? null,
      check_interval: payload.check_interval ?? 'daily',
      features: payload.features ?? {},
      sort_order: payload.sort_order ?? 0,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export const updateLicenseModel = async (id: string, payload: LicenseModelUpdate): Promise<{ ok: boolean; error?: string }> => {
  if (payload.name !== undefined || payload.tier !== undefined) {
    const { data: current } = await supabase.from('license_models').select('name, tier').eq('id', id).single()
    const name = payload.name ?? current?.name ?? ''
    const tier = payload.tier ?? current?.tier ?? 'professional'
    const { data: existing } = await supabase
      .from('license_models')
      .select('id')
      .eq('name', name.trim())
      .eq('tier', tier)
      .neq('id', id)
      .maybeSingle()
    if (existing) return { ok: false, error: `Lizenzmodell „${name}“ mit Tier „${tier}“ existiert bereits.` }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (payload.name !== undefined) update.name = payload.name
  if (payload.tier !== undefined) update.tier = payload.tier
  if (payload.max_users !== undefined) update.max_users = payload.max_users
  if (payload.max_customers !== undefined) update.max_customers = payload.max_customers
  if (payload.max_storage_mb !== undefined) update.max_storage_mb = payload.max_storage_mb
  if (payload.check_interval !== undefined) update.check_interval = payload.check_interval
  if (payload.features !== undefined) update.features = payload.features
  if (payload.sort_order !== undefined) update.sort_order = payload.sort_order
  const { error } = await supabase.from('license_models').update(update).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export const deleteLicenseModel = async (id: string): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase.from('license_models').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// =============================================================================
// SPEICHER-KONTINGENT
// =============================================================================

export type StorageSummary = {
  total_available_mb: number
  assigned_mb: number
  remaining_mb: number
}

export type TenantEmailMonthlyUsage = {
  tenant_id: string
  year_month: string
  sent_ok: number
  sent_failed: number
  updated_at: string
}

export const fetchTenantEmailMonthlyUsage = async (
  tenantId: string,
  yearMonth: string
): Promise<TenantEmailMonthlyUsage | null> => {
  const { data, error } = await supabase
    .from('tenant_email_monthly_usage')
    .select('tenant_id, year_month, sent_ok, sent_failed, updated_at')
    .eq('tenant_id', tenantId)
    .eq('year_month', yearMonth)
    .maybeSingle()
  if (error) return null
  return (data as TenantEmailMonthlyUsage | null) ?? null
}

export const fetchStorageSummary = async (): Promise<StorageSummary> => {
  const { data, error } = await supabase.rpc('get_storage_summary')
  if (error) {
    return { total_available_mb: 10000, assigned_mb: 0, remaining_mb: 10000 }
  }
  const raw = data as { total_available_mb?: number; assigned_mb?: number; remaining_mb?: number }
  return {
    total_available_mb: raw.total_available_mb ?? 10000,
    assigned_mb: raw.assigned_mb ?? 0,
    remaining_mb: raw.remaining_mb ?? 10000,
  }
}

export type InfrastructurePingUrlResult = {
  label: string
  ok: boolean
  status: number
  message: string
  skipped?: boolean
}

export type InfrastructurePingHealth = {
  ok: boolean
  status: number
  message: string
  skipped?: boolean
}

export type InfrastructurePingResponse = {
  success: true
  supabase_auth_health: InfrastructurePingHealth | null
  supabase_rest: InfrastructurePingHealth | null
  urls: InfrastructurePingUrlResult[]
}

export const invokeInfrastructurePing = async (body: {
  supabase_url?: string
  supabase_anon_key?: string
  urls?: { label: string; url: string }[]
}): Promise<{ ok: true; data: InfrastructurePingResponse } | { ok: false; error: string }> => {
  const { data, error } = await supabase.functions.invoke<InfrastructurePingResponse | { error: string }>(
    'infrastructure-ping',
    { body }
  )
  if (error) {
    return { ok: false, error: error.message }
  }
  if (data && typeof data === 'object') {
    if ('error' in data && typeof (data as { error: unknown }).error === 'string') {
      return { ok: false, error: (data as { error: string }).error }
    }
    if ('success' in data && (data as InfrastructurePingResponse).success === true) {
      return { ok: true, data: data as InfrastructurePingResponse }
    }
  }
  return { ok: false, error: 'Unerwartete Antwort der Infrastruktur-Prüfung.' }
}

export const updateTotalStorageMb = async (mb: number): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from('platform_config')
    .upsert({ key: 'total_storage_mb', value: mb }, { onConflict: 'key' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
