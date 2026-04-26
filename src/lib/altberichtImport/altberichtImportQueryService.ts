import type { SupabaseClient } from '@supabase/supabase-js'
import { OBJECT_COLUMNS } from '../dataColumns'
import { supabase } from '../../supabase'
import type { Object as Obj } from '../../types/object'
import type {
  AltberichtImportEmbeddedImageRow,
  AltberichtImportEventRow,
  AltberichtImportFileRow,
  AltberichtImportJobRow,
} from './altberichtImportTypes'

export type AltberichtImportStagingObjectRow = {
  id: string
  job_id: string
  file_id: string
  sequence: number
  status: string
  customer_text: string | null
  site_text: string | null
  bv_id: string | null
  object_name: string
  object_type_text: string
  floor_text: string | null
  room_text: string | null
  location_rule: string
  findings_json: unknown
  catalog_candidates_json: unknown
  media_hints_json: unknown
  parser_confidence_json: unknown | null
  source_refs_json: unknown | null
  analysis_trace_json: unknown | null
  /** Paket B (nach Migration); fehlend vor Migration */
  review_status?: string
  review_customer_id?: string | null
  review_bv_id?: string | null
  review_object_id?: string | null
  review_object_name?: string | null
  review_object_type_text?: string | null
  review_floor_text?: string | null
  review_room_text?: string | null
  review_location_rule?: string | null
  validation_errors_json?: unknown
  review_blocked_reason?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  match_candidates_json?: unknown | null
  committed_at?: string | null
  committed_object_id?: string | null
  commit_last_error?: string | null
  /** Paket C2: bereits produktiv übernommene Mängel-Schlüssel (f:index) */
  c2_defects_imported_keys?: unknown
  c2_defects_last_import_at?: string | null
  c2_defects_last_error?: string | null
  /** Vom Parser/Persist gesetzte Vorschau-Kennung OBJ-… (Paket D) */
  proposed_internal_id?: string | null
  /** Fachlicher Fingerprint für weiche Dublettenlogik (Paket D) */
  import_match_key?: string | null
  created_at: string
  updated_at: string
}

export const listAltberichtImportJobs = async (
  limit = 40,
  client: SupabaseClient = supabase
): Promise<{ jobs: AltberichtImportJobRow[]; error: Error | null }> => {
  const { data, error } = await client
    .from('altbericht_import_job')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { jobs: [], error: new Error(error.message) }
  return { jobs: (data ?? []) as unknown as AltberichtImportJobRow[], error: null }
}

export const fetchAltberichtImportFilesForJob = async (
  jobId: string,
  client: SupabaseClient = supabase
): Promise<{ files: AltberichtImportFileRow[]; error: Error | null }> => {
  const { data, error } = await client
    .from('altbericht_import_file')
    .select('*')
    .eq('job_id', jobId)
    .order('sequence', { ascending: true })

  if (error) return { files: [], error: new Error(error.message) }
  return { files: (data ?? []) as unknown as AltberichtImportFileRow[], error: null }
}

export const fetchAltberichtImportStagingForJob = async (
  jobId: string,
  client: SupabaseClient = supabase
): Promise<{ staging: AltberichtImportStagingObjectRow[]; error: Error | null }> => {
  const { data, error } = await client
    .from('altbericht_import_staging_object')
    .select('*')
    .eq('job_id', jobId)
    .order('file_id', { ascending: true })
    .order('sequence', { ascending: true })

  if (error) return { staging: [], error: new Error(error.message) }
  return { staging: (data ?? []) as unknown as AltberichtImportStagingObjectRow[], error: null }
}

export const fetchAltberichtEmbeddedImagesForJob = async (
  jobId: string,
  client: SupabaseClient = supabase
): Promise<{ images: AltberichtImportEmbeddedImageRow[]; error: Error | null }> => {
  const { data, error } = await client
    .from('altbericht_import_embedded_image')
    .select('*')
    .eq('job_id', jobId)
    .order('file_id', { ascending: true })
    .order('page_number', { ascending: true })
    .order('image_index', { ascending: true })

  if (error) return { images: [], error: new Error(error.message) }
  return { images: (data ?? []) as unknown as AltberichtImportEmbeddedImageRow[], error: null }
}

/**
 * Lädt Produktivobjekte inkl. archivierter/gelöster aus Sicht `fetchAllObjects` für C1-Abgleichsreport
 * (nach Commit muss die Zeile trotzdem per ID abfragbar sein).
 */
export const fetchObjectsByIdsForCompare = async (
  ids: string[],
  client: SupabaseClient = supabase
): Promise<{ objects: Obj[]; error: Error | null }> => {
  const u = [...new Set(ids.map((x) => x.trim()).filter(Boolean))]
  if (u.length === 0) return { objects: [], error: null }
  const { data, error } = await client.from('objects').select(OBJECT_COLUMNS).in('id', u)
  if (error) return { objects: [], error: new Error(error.message) }
  return { objects: (data ?? []) as unknown as Obj[], error: null }
}

const ALTBERICHT_IMPORT_EVENT_FETCH_LIMIT = 3000

export const fetchAltberichtImportEventsForJob = async (
  jobId: string,
  client: SupabaseClient = supabase
): Promise<{ events: AltberichtImportEventRow[]; error: Error | null }> => {
  const { data, error } = await client
    .from('altbericht_import_event')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })
    .limit(ALTBERICHT_IMPORT_EVENT_FETCH_LIMIT)

  if (error) return { events: [], error: new Error(error.message) }
  return { events: (data ?? []) as unknown as AltberichtImportEventRow[], error: null }
}
