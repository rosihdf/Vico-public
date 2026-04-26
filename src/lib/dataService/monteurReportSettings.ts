import { supabase } from '../../supabase'
import { isOnline } from '../../../shared/networkUtils'

export type MonteurReportCustomerDeliveryMode =
  | 'none'
  | 'email_auto'
  | 'email_manual'
  | 'portal_notify'

export const fetchMonteurReportSettings = async (): Promise<{
  customer_delivery_mode: MonteurReportCustomerDeliveryMode
} | null> => {
  if (!isOnline()) return { customer_delivery_mode: 'none' }
  const { data, error } = await supabase
    .from('monteur_report_settings')
    .select('customer_delivery_mode')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return null
  const m = (data as { customer_delivery_mode: string }).customer_delivery_mode
  const allowed: MonteurReportCustomerDeliveryMode[] = ['none', 'email_auto', 'email_manual', 'portal_notify']
  return {
    customer_delivery_mode: allowed.includes(m as MonteurReportCustomerDeliveryMode)
      ? (m as MonteurReportCustomerDeliveryMode)
      : 'none',
  }
}

export const updateMonteurReportSettings = async (
  mode: MonteurReportCustomerDeliveryMode
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur online speicherbar.' } }
  const { error } = await supabase.from('monteur_report_settings').upsert(
    { id: 1, customer_delivery_mode: mode, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )
  return { error: error ? { message: error.message } : null }
}

export type WartungChecklisteModus = 'compact' | 'detail'
export type PruefprotokollAddressMode = 'both' | 'bv_only'

export type MonteurReportSettingsFull = {
  customer_delivery_mode: MonteurReportCustomerDeliveryMode
  wartung_checkliste_modus: WartungChecklisteModus
  pruefprotokoll_address_mode: PruefprotokollAddressMode
  mangel_neuer_auftrag_default: boolean
  portal_share_monteur_report_pdf: boolean
  portal_share_pruefprotokoll_pdf: boolean
  portal_timeline_show_planned: boolean
  portal_timeline_show_termin: boolean
  portal_timeline_show_in_progress: boolean
}

export const fetchMonteurReportSettingsFull = async (): Promise<MonteurReportSettingsFull | null> => {
  if (!isOnline()) {
    return {
      customer_delivery_mode: 'none',
      wartung_checkliste_modus: 'detail',
      pruefprotokoll_address_mode: 'both',
      mangel_neuer_auftrag_default: true,
      portal_share_monteur_report_pdf: true,
      portal_share_pruefprotokoll_pdf: true,
      portal_timeline_show_planned: false,
      portal_timeline_show_termin: true,
      portal_timeline_show_in_progress: true,
    }
  }
  const { data, error } = await supabase
    .from('monteur_report_settings')
    .select(
      'customer_delivery_mode, wartung_checkliste_modus, pruefprotokoll_address_mode, mangel_neuer_auftrag_default, portal_share_monteur_report_pdf, portal_share_pruefprotokoll_pdf, portal_timeline_show_planned, portal_timeline_show_termin, portal_timeline_show_in_progress'
    )
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return null
  const row = data as Record<string, unknown>
  const m = String(row.customer_delivery_mode ?? 'none')
  const allowed: MonteurReportCustomerDeliveryMode[] = ['none', 'email_auto', 'email_manual', 'portal_notify']
  const mod = row.wartung_checkliste_modus === 'compact' ? 'compact' : 'detail'
  const addrMode = row.pruefprotokoll_address_mode === 'bv_only' ? 'bv_only' : 'both'
  return {
    customer_delivery_mode: allowed.includes(m as MonteurReportCustomerDeliveryMode)
      ? (m as MonteurReportCustomerDeliveryMode)
      : 'none',
    wartung_checkliste_modus: mod,
    pruefprotokoll_address_mode: addrMode,
    mangel_neuer_auftrag_default: Boolean(row.mangel_neuer_auftrag_default ?? true),
    portal_share_monteur_report_pdf: Boolean(row.portal_share_monteur_report_pdf ?? true),
    portal_share_pruefprotokoll_pdf: Boolean(row.portal_share_pruefprotokoll_pdf ?? true),
    portal_timeline_show_planned: Boolean(row.portal_timeline_show_planned),
    portal_timeline_show_termin: row.portal_timeline_show_termin !== false,
    portal_timeline_show_in_progress: row.portal_timeline_show_in_progress !== false,
  }
}

export const updateMonteurReportWartungChecklisteSettings = async (patch: {
  wartung_checkliste_modus?: WartungChecklisteModus
  pruefprotokoll_address_mode?: PruefprotokollAddressMode
  mangel_neuer_auftrag_default?: boolean
}): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur online speicherbar.' } }
  const { error } = await supabase
    .from('monteur_report_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
  return { error: error ? { message: error.message } : null }
}

export const updateMonteurReportPortalPdfShareSettings = async (patch: {
  portal_share_monteur_report_pdf: boolean
  portal_share_pruefprotokoll_pdf: boolean
  portal_timeline_show_planned: boolean
  portal_timeline_show_termin: boolean
  portal_timeline_show_in_progress: boolean
}): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur online speicherbar.' } }
  const { error } = await supabase
    .from('monteur_report_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
  return { error: error ? { message: error.message } : null }
}

export type MonteurReportOrgDigestSettings = {
  maintenance_digest_local_time: string
  maintenance_digest_timezone: string
  app_public_url: string | null
}

export const fetchMonteurReportOrgDigestSettings = async (): Promise<MonteurReportOrgDigestSettings | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase
    .from('monteur_report_settings')
    .select('maintenance_digest_local_time, maintenance_digest_timezone, app_public_url')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return null
  const row = data as Record<string, unknown>
  return {
    maintenance_digest_local_time: String(row.maintenance_digest_local_time ?? '07:00'),
    maintenance_digest_timezone: String(row.maintenance_digest_timezone ?? 'Europe/Berlin'),
    app_public_url: row.app_public_url != null ? String(row.app_public_url) : null,
  }
}

export const updateMonteurReportOrgDigestSettings = async (
  patch: Partial<MonteurReportOrgDigestSettings>
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur online speicherbar.' } }
  const { error } = await supabase
    .from('monteur_report_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
  return { error: error ? { message: error.message } : null }
}
