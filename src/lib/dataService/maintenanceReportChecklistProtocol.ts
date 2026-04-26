import { supabase } from '../../supabase'
import type { MaintenanceReport } from '../../types'
import { MAINTENANCE_REPORT_COLUMNS } from '../dataColumns'
import { mergeChecklistProtocolForUpsert } from '../checklistProtocol'
import { isOnline } from '../../../shared/networkUtils'
import { getCachedMaintenanceReports, setCachedMaintenanceReports } from '../offlineStorage'
import { notifyDataChange } from './dataChange'

export type MaintenanceReportPayload = Omit<
  MaintenanceReport,
  'id' | 'created_at' | 'updated_at'
> & { updated_at?: string }

/** Wartungsprotokoll-Zeile aus Auftrags-Checkliste (Upsert je order_id + object_id). */
export const upsertWartungsChecklistProtocol = async (params: {
  orderId: string
  objectId: string
  maintenanceDate: string
  technicianId: string | null
  /** Tür-Checklisten-Block ({ modus, items, norms, order_id }) – optional wenn nur Feststell gespeichert wird. */
  checklistProtocol?: unknown
  /** Optionaler Feststellanlagen-Block; auslassen = bestehenden Block beibehalten. */
  feststellChecklistProtocol?: unknown
  deficiencyDescription: string | null
  deficienciesFound: boolean
}): Promise<{ data: MaintenanceReport | null; error: { message: string } | null }> => {
  if (!isOnline()) {
    return { data: null, error: { message: 'Checklisten-Protokoll ist nur online speicherbar.' } }
  }
  const now = new Date().toISOString()

  const { data: existing, error: exErr } = await supabase
    .from('maintenance_reports')
    .select('id, checklist_protocol')
    .eq('source_order_id', params.orderId)
    .eq('object_id', params.objectId)
    .maybeSingle()

  if (exErr) return { data: null, error: { message: exErr.message } }

  const protocolPatch: { door_checklist?: unknown; feststell_checklist?: unknown } = {}
  if (params.checklistProtocol !== undefined) protocolPatch.door_checklist = params.checklistProtocol
  if (params.feststellChecklistProtocol !== undefined)
    protocolPatch.feststell_checklist = params.feststellChecklistProtocol
  const mergedProtocol = mergeChecklistProtocolForUpsert(existing?.checklist_protocol, protocolPatch)

  const basePayload: MaintenanceReportPayload = {
    object_id: params.objectId,
    maintenance_date: params.maintenanceDate.slice(0, 10),
    maintenance_time: null,
    technician_id: params.technicianId,
    reason: 'regelwartung',
    reason_other: null,
    manufacturer_maintenance_done: false,
    hold_open_checked: null,
    deficiencies_found: params.deficienciesFound,
    deficiency_description: params.deficiencyDescription,
    urgency: null,
    fixed_immediately: !params.deficienciesFound,
    customer_signature_path: null,
    technician_signature_path: null,
    technician_name_printed: null,
    customer_name_printed: null,
    pdf_path: null,
    synced: true,
    source_order_id: params.orderId,
    checklist_protocol: mergedProtocol,
    updated_at: now,
  }

  if (existing?.id) {
    const { data: updated, error: upErr } = await supabase
      .from('maintenance_reports')
      .update({
        maintenance_date: basePayload.maintenance_date,
        technician_id: basePayload.technician_id,
        deficiencies_found: basePayload.deficiencies_found,
        deficiency_description: basePayload.deficiency_description,
        fixed_immediately: basePayload.fixed_immediately,
        checklist_protocol: mergedProtocol as Record<string, unknown>,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select(MAINTENANCE_REPORT_COLUMNS)
      .single()
    if (upErr) return { data: null, error: { message: upErr.message } }
    const reportTyped = updated as unknown as MaintenanceReport
    const cached = getCachedMaintenanceReports(params.objectId) as MaintenanceReport[]
    setCachedMaintenanceReports(
      params.objectId,
      [reportTyped, ...cached.filter((r) => r.id !== reportTyped.id)]
    )
    notifyDataChange()
    return { data: reportTyped, error: null }
  }

  const { data: inserted, error: insErr } = await supabase
    .from('maintenance_reports')
    .insert(basePayload)
    .select(MAINTENANCE_REPORT_COLUMNS)
    .single()
  if (insErr) return { data: null, error: { message: insErr.message } }
  const reportTyped = inserted as unknown as MaintenanceReport
  const cached = getCachedMaintenanceReports(params.objectId) as MaintenanceReport[]
  setCachedMaintenanceReports(params.objectId, [reportTyped, ...cached])
  notifyDataChange()
  return { data: reportTyped, error: null }
}
