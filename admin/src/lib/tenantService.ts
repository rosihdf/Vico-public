import { supabase } from './supabase'
import type { AppVersionsMap } from '../../../shared/appVersions'

export type Tenant = {
  id: string
  name: string
  app_domain: string | null
  portal_domain: string | null
  kundenportal_url: string | null
  arbeitszeitenportal_domain: string | null
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
  mail_provider?: string | null
  mail_from_name?: string | null
  mail_from_email?: string | null
  mail_reply_to?: string | null
  mail_monthly_limit?: number | null
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_implicit_tls?: boolean | null
  smtp_username?: string | null
  supabase_project_ref: string | null
  supabase_url: string | null
  /** Optionale Cloudflare-Pages-Preview-URLs (Dokumentation / Verbindungsprüfung) */
  cf_preview_main_url?: string | null
  cf_preview_portal_url?: string | null
  cf_preview_arbeitszeit_url?: string | null
  allowed_domains: string[] | null
  /** Optional: Version/Release Notes je App (Lizenz-API-Feld `appVersions`). */
  app_versions?: AppVersionsMap | null
  maintenance_mode_enabled?: boolean
  maintenance_mode_message?: string | null
  maintenance_mode_duration_min?: number | null
  maintenance_mode_started_at?: string | null
  maintenance_mode_ends_at?: string | null
  maintenance_mode_auto_end?: boolean
  maintenance_mode_apply_main_app?: boolean
  maintenance_mode_apply_arbeitszeit_portal?: boolean
  maintenance_mode_apply_customer_portal?: boolean
  maintenance_announcement_enabled?: boolean
  maintenance_announcement_message?: string | null
  maintenance_announcement_from?: string | null
  maintenance_announcement_until?: string | null
  created_at: string
  updated_at: string
  /** §11.20 #11: Kennzeichnung Testmandant (Pilot / Incoming) */
  is_test_mandant?: boolean
}

export type TenantInsert = Omit<Tenant, 'id' | 'created_at' | 'updated_at' | 'app_versions'> &
  Partial<Pick<Tenant, 'id' | 'app_versions'>>
export type TenantUpdate = Partial<Omit<Tenant, 'id' | 'created_at'>>

export const fetchTenants = async (signal?: AbortSignal): Promise<Tenant[]> => {
  let query = supabase
    .from('tenants')
    .select(
      'id, name, app_domain, portal_domain, arbeitszeitenportal_domain, app_name, primary_color, is_test_mandant'
    )
    .order('name')
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
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
      kundenportal_url: payload.kundenportal_url ?? null,
      arbeitszeitenportal_domain: payload.arbeitszeitenportal_domain ?? null,
      logo_url: payload.logo_url ?? null,
      primary_color: payload.primary_color ?? '#5b7895',
      secondary_color: payload.secondary_color ?? null,
      favicon_url: payload.favicon_url ?? null,
      app_name: payload.app_name ?? 'ArioVan',
      impressum_company_name: payload.impressum_company_name ?? null,
      impressum_address: payload.impressum_address ?? null,
      impressum_contact: payload.impressum_contact ?? null,
      impressum_represented_by: payload.impressum_represented_by ?? null,
      impressum_register: payload.impressum_register ?? null,
      impressum_vat_id: payload.impressum_vat_id ?? null,
      datenschutz_responsible: payload.datenschutz_responsible ?? null,
      datenschutz_contact_email: payload.datenschutz_contact_email ?? null,
      datenschutz_dsb_email: payload.datenschutz_dsb_email ?? null,
      mail_provider: payload.mail_provider ?? 'resend',
      mail_from_name: payload.mail_from_name ?? null,
      mail_from_email: payload.mail_from_email ?? null,
      mail_reply_to: payload.mail_reply_to ?? null,
      mail_monthly_limit: payload.mail_monthly_limit ?? 3000,
      smtp_host: payload.smtp_host ?? null,
      smtp_port: payload.smtp_port ?? 587,
      smtp_implicit_tls: payload.smtp_implicit_tls ?? false,
      smtp_username: payload.smtp_username ?? null,
      supabase_project_ref: payload.supabase_project_ref ?? null,
      supabase_url: payload.supabase_url ?? null,
      cf_preview_main_url: payload.cf_preview_main_url ?? null,
      cf_preview_portal_url: payload.cf_preview_portal_url ?? null,
      cf_preview_arbeitszeit_url: payload.cf_preview_arbeitszeit_url ?? null,
      allowed_domains: Array.isArray(payload.allowed_domains) ? payload.allowed_domains : [],
      app_versions: payload.app_versions ?? {},
      is_test_mandant: payload.is_test_mandant ?? false,
      maintenance_mode_enabled: payload.maintenance_mode_enabled ?? false,
      maintenance_mode_message: payload.maintenance_mode_message ?? null,
      maintenance_mode_duration_min: payload.maintenance_mode_duration_min ?? null,
      maintenance_mode_started_at: payload.maintenance_mode_started_at ?? null,
      maintenance_mode_ends_at: payload.maintenance_mode_ends_at ?? null,
      maintenance_mode_auto_end: payload.maintenance_mode_auto_end ?? false,
      maintenance_mode_apply_main_app: payload.maintenance_mode_apply_main_app !== false,
      maintenance_mode_apply_arbeitszeit_portal: payload.maintenance_mode_apply_arbeitszeit_portal !== false,
      maintenance_mode_apply_customer_portal: payload.maintenance_mode_apply_customer_portal !== false,
      maintenance_announcement_enabled: payload.maintenance_announcement_enabled ?? false,
      maintenance_announcement_message: payload.maintenance_announcement_message ?? null,
      maintenance_announcement_from: payload.maintenance_announcement_from ?? null,
      maintenance_announcement_until: payload.maintenance_announcement_until ?? null,
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
