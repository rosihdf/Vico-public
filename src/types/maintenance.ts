export type MaintenanceReason = 'regelwartung' | 'reparatur' | 'nachpruefung' | 'sonstiges'
export type MaintenanceUrgency = 'niedrig' | 'mittel' | 'hoch'
export type SmokeDetectorStatus = 'ok' | 'defekt' | 'ersetzt'

export type MaintenanceReminder = {
  object_id: string
  customer_id: string
  customer_name: string
  bv_id: string
  bv_name: string
  internal_id: string | null
  object_name?: string | null
  object_room?: string | null
  object_floor?: string | null
  object_manufacturer?: string | null
  maintenance_interval_months: number
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  status: 'overdue' | 'due_soon' | 'ok'
  days_until_due: number | null
}

export type MaintenanceReport = {
  id: string
  object_id: string
  maintenance_date: string
  maintenance_time: string | null
  technician_id: string | null
  reason: MaintenanceReason | null
  reason_other: string | null
  manufacturer_maintenance_done: boolean
  hold_open_checked: boolean | null
  deficiencies_found: boolean
  deficiency_description: string | null
  urgency: MaintenanceUrgency | null
  fixed_immediately: boolean
  customer_signature_path: string | null
  technician_signature_path: string | null
  technician_name_printed: string | null
  customer_name_printed: string | null
  pdf_path: string | null
  synced: boolean
  created_at: string
  updated_at: string
}

export type MaintenanceReportPhoto = {
  id: string
  report_id: string
  storage_path: string | null
  caption: string | null
  created_at: string
}

export type MaintenanceReportSmokeDetector = {
  id: string
  report_id: string
  smoke_detector_label: string
  status: SmokeDetectorStatus
  created_at: string
}

export type MaintenanceReportFormData = {
  maintenance_date: string
  maintenance_time: string
  reason: MaintenanceReason | ''
  reason_other: string
  manufacturer_maintenance_done: boolean
  hold_open_checked: boolean
  deficiencies_found: boolean
  deficiency_description: string
  urgency: MaintenanceUrgency | ''
  fixed_immediately: boolean
  smoke_detector_statuses: { label: string; status: SmokeDetectorStatus }[]
  technician_name_printed: string
  customer_name_printed: string
}
