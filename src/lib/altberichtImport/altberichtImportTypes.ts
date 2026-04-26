/**
 * Typen für Paket-A-Import (DB-Zeilen, schlank für Services).
 */

export type AltberichtImportJobRow = {
  id: string
  created_by: string | null
  created_at: string
  updated_at: string
  status: string
  analysis_mode: boolean
  title: string | null
  notes: string | null
  started_at: string | null
  finished_at: string | null
  current_file_id: string | null
  parser_version: string | null
}

export type AltberichtImportFileRow = {
  id: string
  job_id: string
  sequence: number
  status: string
  original_filename: string
  content_type: string
  byte_size: number | null
  sha256: string | null
  storage_bucket: string
  storage_path: string
  parsed_at: string | null
  parser_version: string | null
  parse_error_code: string | null
  parse_error_message: string | null
  extracted_text: string | null
  extracted_text_storage_path: string | null
}

export type AltberichtImportEventLevel = 'info' | 'warn' | 'error'

export type AltberichtImportLogEventInput = {
  jobId: string
  fileId?: string | null
  stagingObjectId?: string | null
  level: AltberichtImportEventLevel
  code: string
  message: string
  payloadJson?: Record<string, unknown> | null
}

/** Zeile aus `altbericht_import_event` (Lese-API). */
export type AltberichtImportEventRow = {
  id: string
  job_id: string
  file_id: string | null
  staging_object_id: string | null
  created_at: string
  level: AltberichtImportEventLevel
  code: string
  message: string
  payload_json: unknown
}

export type AltberichtImportUploadInputFile = {
  file: File
  /** Fallback: file.name */
  originalFilename?: string
}

/** Manueller Status im Experte (Fotoübernahme vorbereiten; noch kein produktives Schreiben). */
export type AltberichtImportEmbeddedImageUserIntent = 'unreviewed' | 'ignore' | 'object_photo' | 'defect_photo'

export type AltberichtImportEmbeddedImageImportStatus = 'not_imported' | 'imported' | 'failed'

export type AltberichtImportEmbeddedImageRow = {
  id: string
  job_id: string
  file_id: string
  page_number: number
  image_index: number
  scan_version: string
  op_kind: string | null
  suggested_staging_object_id: string | null
  user_intent: AltberichtImportEmbeddedImageUserIntent
  linked_staging_object_id: string | null
  preview_storage_path: string | null
  /** Paket F; fehlt vor Migration */
  import_status?: AltberichtImportEmbeddedImageImportStatus | null
  imported_at?: string | null
  import_error?: string | null
  import_object_photo_id?: string | null
  import_defect_photo_id?: string | null
  target_object_id?: string | null
  c2_finding_key?: string | null
  created_at: string
  updated_at: string
}
