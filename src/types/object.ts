/** Foto zu einem Eintrag in `defects_structured` (Q7, max. 3 pro Mangel in der UI) */
export type ObjectDefectPhoto = {
  id: string
  object_id: string
  defect_entry_id: string
  storage_path: string
  created_at: string
}

export type ObjectDefectPhotoDisplay = ObjectDefectPhoto & { localDataUrl?: string }

/** Mängel an der Tür/Tor-Stammdaten (RF2: nicht löschen, Status offen/erledigt) */
export type ObjectDefectEntry = {
  id: string
  text: string
  status: 'open' | 'resolved'
  created_at: string
  resolved_at: string | null
}

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
  /** Mehrzeiliges Zubehör (Liste); `accessories` bleibt als zusammengefügter Text für Export/Legacy */
  accessories_items?: string[] | null
  accessories: string | null
  maintenance_by_manufacturer: boolean
  hold_open_maintenance: boolean
  /** Legacy: zusammenhängender Text der **offenen** Mängel (wird aus Einträgen mitgespeichert) */
  defects: string | null
  /** Strukturierte Mängel inkl. erledigter (JSON array) */
  defects_structured?: ObjectDefectEntry[] | null
  remarks: string | null
  maintenance_interval_months?: number | null
  /** Letzte Wartung (Tür); ergänzt max(maintenance_reports); manuell wenn door_maintenance_date_manual */
  last_door_maintenance_date?: string | null
  door_maintenance_date_manual?: boolean
  hold_open_last_maintenance_date?: string | null
  hold_open_maintenance_interval_months?: number | null
  hold_open_last_maintenance_manual?: boolean
  /** Pfad im Bucket object-photos (öffentliche URL), nur Anzeige Profilbild */
  profile_photo_path?: string | null
  archived_at?: string | null
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
  /** Eine Zeile pro Eintrag; leere Zeilen werden beim Speichern verworfen */
  accessories_lines: string[]
  maintenance_by_manufacturer: boolean
  hold_open_maintenance: boolean
  defect_entries: ObjectDefectEntry[]
  remarks: string
  maintenance_interval_months: string
  last_door_maintenance_date?: string
  door_maintenance_date_manual?: boolean
  hold_open_last_maintenance_date?: string
  hold_open_maintenance_interval_months?: string
  hold_open_last_maintenance_manual?: boolean
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
