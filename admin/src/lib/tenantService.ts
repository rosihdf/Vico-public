import { supabase } from './supabase'

export type Tenant = {
  id: string
  name: string
  app_domain: string | null
  portal_domain: string | null
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  favicon_url: string | null
  app_name: string | null
  impressum_company_name: string | null
  impressum_address: string | null
  impressum_contact: string | null
  impressum_represented_by: string | null
  impressum_register: string | null
  impressum_vat_id: string | null
  datenschutz_responsible: string | null
  datenschutz_contact_email: string | null
  datenschutz_dsb_email: string | null
  supabase_project_ref: string | null
  supabase_url: string | null
  created_at: string
  updated_at: string
}

export type TenantInsert = Omit<Tenant, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Tenant, 'id'>>
export type TenantUpdate = Partial<Omit<Tenant, 'id' | 'created_at'>>

export const fetchTenants = async (): Promise<Tenant[]> => {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Tenant[]
}

export const fetchTenant = async (id: string): Promise<Tenant | null> => {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Tenant | null
}

export const createTenant = async (payload: Partial<Tenant>): Promise<{ id: string } | { error: string }> => {
  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: payload.name ?? '',
      app_domain: payload.app_domain ?? null,
      portal_domain: payload.portal_domain ?? null,
      logo_url: payload.logo_url ?? null,
      primary_color: payload.primary_color ?? '#5b7895',
      secondary_color: payload.secondary_color ?? null,
      favicon_url: payload.favicon_url ?? null,
      app_name: payload.app_name ?? 'Vico',
      impressum_company_name: payload.impressum_company_name ?? null,
      impressum_address: payload.impressum_address ?? null,
      impressum_contact: payload.impressum_contact ?? null,
      impressum_represented_by: payload.impressum_represented_by ?? null,
      impressum_register: payload.impressum_register ?? null,
      impressum_vat_id: payload.impressum_vat_id ?? null,
      datenschutz_responsible: payload.datenschutz_responsible ?? null,
      datenschutz_contact_email: payload.datenschutz_contact_email ?? null,
      datenschutz_dsb_email: payload.datenschutz_dsb_email ?? null,
      supabase_project_ref: payload.supabase_project_ref ?? null,
      supabase_url: payload.supabase_url ?? null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export const updateTenant = async (id: string, payload: TenantUpdate): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from('tenants')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export const deleteTenant = async (id: string): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase.from('tenants').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
