import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import { ALTBERICHT_IMPORT_PDF_BUCKET } from './storagePaths'

export type AltberichtImportReadinessResult = {
  ok: boolean
  missing: string[]
  warnings: string[]
}

const messageOf = (error: unknown): string => {
  if (!error) return 'Unbekannter Fehler'
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return String(error)
}

const addMissing = (missing: string[], label: string, error: unknown) => {
  missing.push(`${label}: ${messageOf(error)}`)
}

const checkReadableSelect = async (
  client: SupabaseClient,
  table: string,
  selectColumns: string,
  label: string,
  missing: string[]
) => {
  const { error } = await client.from(table).select(selectColumns).limit(1)
  if (error) addMissing(missing, label, error)
}

export const checkAltberichtImportReadiness = async (
  client: SupabaseClient = supabase
): Promise<AltberichtImportReadinessResult> => {
  const missing: string[] = []
  const warnings: string[] = []

  await checkReadableSelect(
    client,
    'altbericht_import_job',
    'id',
    'Tabelle altbericht_import_job nicht lesbar',
    missing
  )

  await checkReadableSelect(
    client,
    'altbericht_import_staging_object',
    [
      'id',
      'proposed_internal_id',
      'import_match_key',
      'review_status',
      'review_customer_id',
      'review_bv_id',
      'review_object_id',
      'review_object_name',
      'review_object_type_text',
      'review_floor_text',
      'review_room_text',
      'validation_errors_json',
      'committed_at',
      'committed_object_id',
      'commit_last_error',
      'c2_defects_imported_keys',
    ].join(', '),
    'Tabelle altbericht_import_staging_object oder benötigte Spalten fehlen',
    missing
  )

  await checkReadableSelect(
    client,
    'objects',
    'id, anforderung',
    'Spalte objects.anforderung fehlt oder objects ist nicht lesbar',
    missing
  )

  const { error: storageError } = await client.storage
    .from(ALTBERICHT_IMPORT_PDF_BUCKET)
    .list('', { limit: 1 })
  if (storageError) {
    addMissing(missing, `Storage-Bucket ${ALTBERICHT_IMPORT_PDF_BUCKET} nicht erreichbar`, storageError)
  }

  const { error: rpcError } = await client.rpc('altbericht_import_c2_commit_defects', {
    p_staging_object_id: null,
    p_items: [],
  })
  if (rpcError) {
    warnings.push(`Optionale C2-RPC altbericht_import_c2_commit_defects nicht plausibel vorhanden: ${rpcError.message}`)
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
  }
}
