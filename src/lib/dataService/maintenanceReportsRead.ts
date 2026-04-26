import { supabase } from '../../supabase'
import type { MaintenanceReport, MaintenanceReportSmokeDetector } from '../../types'
import { MAINTENANCE_REPORT_COLUMNS, MAINTENANCE_REPORT_SMOKE_DETECTOR_COLUMNS } from '../dataColumns'
import { isOnline } from '../../../shared/networkUtils'
import {
  getCachedMaintenanceReports,
  setCachedMaintenanceReports,
  getMaintenanceOutbox,
} from '../offlineStorage'

export const fetchMaintenanceReports = async (
  objectId: string
): Promise<MaintenanceReport[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('maintenance_reports')
      .select(MAINTENANCE_REPORT_COLUMNS)
      .eq('object_id', objectId)
      .order('maintenance_date', { ascending: false })
    if (!error && data) {
      const reports = data as unknown as MaintenanceReport[]
      setCachedMaintenanceReports(objectId, reports)
      return mergeMaintenanceCacheWithOutbox(objectId, reports)
    }
  }
  const cached = getCachedMaintenanceReports(objectId) as MaintenanceReport[]
  return mergeMaintenanceCacheWithOutbox(objectId, cached)
}

const mergeMaintenanceCacheWithOutbox = (
  objectId: string,
  cached: MaintenanceReport[]
): MaintenanceReport[] => {
  const pending = getMaintenanceOutbox().filter(
    (item) => (item.reportPayload.object_id as string) === objectId
  )
  const pendingReports: MaintenanceReport[] = pending.map((item) => ({
    id: item.tempId,
    object_id: objectId,
    maintenance_date: item.reportPayload.maintenance_date as string,
    maintenance_time: item.reportPayload.maintenance_time as string | null,
    technician_id: item.reportPayload.technician_id as string | null,
    reason: item.reportPayload.reason as MaintenanceReport['reason'],
    reason_other: item.reportPayload.reason_other as string | null,
    manufacturer_maintenance_done: item.reportPayload.manufacturer_maintenance_done as boolean,
    hold_open_checked: item.reportPayload.hold_open_checked as boolean | null,
    deficiencies_found: item.reportPayload.deficiencies_found as boolean,
    deficiency_description: item.reportPayload.deficiency_description as string | null,
    urgency: item.reportPayload.urgency as MaintenanceReport['urgency'],
    fixed_immediately: item.reportPayload.fixed_immediately as boolean,
    customer_signature_path: null,
    technician_signature_path: null,
    technician_name_printed: item.reportPayload.technician_name_printed as string | null,
    customer_name_printed: item.reportPayload.customer_name_printed as string | null,
    pdf_path: null,
    synced: false,
    created_at: item.timestamp,
    updated_at: item.timestamp,
  }))
  const all = [...pendingReports, ...cached]
  all.sort((a, b) => (b.maintenance_date || '').localeCompare(a.maintenance_date || ''))
  return all
}

export const fetchMaintenanceReportSmokeDetectors = async (
  reportId: string
): Promise<MaintenanceReportSmokeDetector[]> => {
  const pending = getMaintenanceOutbox().find((item) => item.tempId === reportId)
  if (pending) {
    return pending.smokeDetectors.map((sd, idx) => ({
      id: `temp-sd-${idx}`,
      report_id: reportId,
      smoke_detector_label: sd.label,
      status: sd.status as MaintenanceReportSmokeDetector['status'],
      created_at: new Date().toISOString(),
    }))
  }
  if (isOnline()) {
    const { data, error } = await supabase
      .from('maintenance_report_smoke_detectors')
      .select(MAINTENANCE_REPORT_SMOKE_DETECTOR_COLUMNS)
      .eq('report_id', reportId)
    if (error) return []
    return (data ?? []) as unknown as MaintenanceReportSmokeDetector[]
  }
  return []
}
