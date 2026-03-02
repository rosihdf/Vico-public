export type SyncStatus = 'offline' | 'ready' | 'synced'

export type Customer = {
  id: string
  name: string
  street: string | null
  postal_code: string | null
  city: string | null
  email: string | null
  phone: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  maintenance_report_email: boolean
  maintenance_report_email_address: string | null
  created_at: string
  updated_at: string
}

export type CustomerFormData = {
  name: string
  street: string
  postal_code: string
  city: string
  email: string
  phone: string
  contact_name: string
  contact_email: string
  contact_phone: string
  maintenance_report_email: boolean
  maintenance_report_email_address: string
}

export type BV = {
  id: string
  customer_id: string
  name: string
  street: string | null
  postal_code: string | null
  city: string | null
  email: string | null
  phone: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  maintenance_report_email: boolean
  maintenance_report_email_address: string | null
  created_at: string
  updated_at: string
}

export type BVFormData = {
  name: string
  street: string
  postal_code: string
  city: string
  email: string
  phone: string
  contact_name: string
  contact_email: string
  contact_phone: string
  maintenance_report_email: boolean
  maintenance_report_email_address: string
  copy_from_customer: boolean
}

export type MaintenanceReminder = {
  object_id: string
  customer_id: string
  customer_name: string
  bv_id: string
  bv_name: string
  internal_id: string | null
  maintenance_interval_months: number
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  status: 'overdue' | 'due_soon' | 'ok'
  days_until_due: number | null
}

export type Object = {
  id: string
  bv_id: string
  internal_id: string | null
  door_position: string | null
  internal_door_number: string | null
  floor: string | null
  room: string | null
  type_tuer: boolean
  type_sektionaltor: boolean
  type_schiebetor: boolean
  type_freitext: string | null
  wing_count: number | null
  manufacturer: string | null
  build_year: string | null
  lock_manufacturer: string | null
  lock_type: string | null
  has_hold_open: boolean
  hold_open_manufacturer: string | null
  hold_open_type: string | null
  hold_open_approval_no: string | null
  hold_open_approval_date: string | null
  smoke_detector_count: number
  smoke_detector_build_years: string[] | null
  panic_function: string | null
  accessories: string | null
  maintenance_by_manufacturer: boolean
  hold_open_maintenance: boolean
  defects: string | null
  remarks: string | null
  maintenance_interval_months?: number | null
  created_at: string
  updated_at: string
}

export type ObjectFormData = {
  internal_id: string
  door_position: string
  internal_door_number: string
  floor: string
  room: string
  type_tuer: boolean
  type_sektionaltor: boolean
  type_schiebetor: boolean
  type_freitext: string
  wing_count: string
  manufacturer: string
  build_year: string
  lock_manufacturer: string
  lock_type: string
  has_hold_open: boolean
  hold_open_manufacturer: string
  hold_open_type: string
  hold_open_approval_no: string
  hold_open_approval_date: string
  smoke_detector_count: string
  smoke_detector_build_years: string[]
  panic_function: string
  accessories: string
  maintenance_by_manufacturer: boolean
  hold_open_maintenance: boolean
  defects: string
  remarks: string
  maintenance_interval_months: string
}

export type MaintenanceReason = 'regelwartung' | 'reparatur' | 'nachpruefung' | 'sonstiges'
export type MaintenanceUrgency = 'niedrig' | 'mittel' | 'hoch'
export type SmokeDetectorStatus = 'ok' | 'defekt' | 'ersetzt'

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

export type OrderType = 'wartung' | 'reparatur' | 'montage' | 'sonstiges'
export type OrderStatus = 'offen' | 'in_bearbeitung' | 'erledigt' | 'storniert'

export type Order = {
  id: string
  customer_id: string
  bv_id: string
  object_id: string | null
  order_date: string
  order_type: OrderType
  status: OrderStatus
  description: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrderFormData = {
  customer_id: string
  bv_id: string
  object_id: string
  order_date: string
  order_type: OrderType
  status: OrderStatus
  description: string
  assigned_to: string
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

export type ObjectPhoto = {
  id: string
  object_id: string
  storage_path: string
  caption: string | null
  created_at: string
}
