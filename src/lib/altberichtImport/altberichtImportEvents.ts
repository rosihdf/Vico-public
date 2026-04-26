import type { SupabaseClient } from '@supabase/supabase-js'
import type { AltberichtImportLogEventInput } from './altberichtImportTypes'

/**
 * Schreibt ein Event in altbericht_import_event (append-only aus App-Sicht).
 */
export const insertAltberichtImportEvent = async (
  client: SupabaseClient,
  input: AltberichtImportLogEventInput
): Promise<{ error: Error | null }> => {
  const { error } = await client.from('altbericht_import_event').insert({
    job_id: input.jobId,
    file_id: input.fileId ?? null,
    staging_object_id: input.stagingObjectId ?? null,
    level: input.level,
    code: input.code,
    message: input.message,
    payload_json: input.payloadJson ?? null,
  })
  return { error: error ? new Error(error.message) : null }
}
