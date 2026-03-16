export type Object = {
  id: string
  bv_id: string | null
  customer_id: string | null
  name: string | null
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
  name: string
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

export type ObjectPhoto = {
  id: string
  object_id: string
  storage_path: string
  caption: string | null
  created_at: string
}

export type ObjectDocumentType = 'zeichnung' | 'zertifikat' | 'sonstiges'

export type ObjectDocument = {
  id: string
  object_id: string
  storage_path: string
  document_type: ObjectDocumentType
  title: string | null
  file_name: string | null
  created_at: string
}
