import { supabase } from './supabase'

export type LicenseStatus = {
  tier: string
  valid_until: string | null
  max_customers: number | null
  max_users: number | null
  current_customers: number
  current_users: number
  features: Record<string, boolean>
  valid: boolean
  expired: boolean
}

export type LicenseUpdate = {
  tier: string
  valid_until: string | null
  max_customers: number | null
  max_users: number | null
  features: Record<string, boolean>
}

export const fetchLicenseStatus = async (): Promise<LicenseStatus | null> => {
  const { data, error } = await supabase.rpc('get_license_status')
  if (error || !data) return null
  return data as LicenseStatus
}

export const fetchLicenseRow = async (): Promise<{ id: string; tier: string; valid_until: string | null; max_customers: number | null; max_users: number | null; features: Record<string, boolean> } | null> => {
  const { data, error } = await supabase
    .from('license')
    .select('id, tier, valid_until, max_customers, max_users, features')
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data as { id: string; tier: string; valid_until: string | null; max_customers: number | null; max_users: number | null; features: Record<string, boolean> }
}

export const updateLicense = async (id: string, payload: LicenseUpdate): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from('license')
    .update({
      tier: payload.tier,
      valid_until: payload.valid_until || null,
      max_customers: payload.max_customers ?? null,
      max_users: payload.max_users ?? null,
      features: payload.features ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
