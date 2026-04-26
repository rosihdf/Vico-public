import type { SupabaseClient } from '@supabase/supabase-js'
import type { BV } from '../../types/bv'
import type { Object as Obj } from '../../types/object'
import { supabase } from '../../supabase'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'
import { buildAltberichtMatchPayload } from './altberichtStagingMatchCandidates'

/**
 * Liest Staging-Zeile, berechnet Match-Payload aus Stammdaten (nur RAM), persistiert JSON + Event.
 */
export const persistAltberichtMatchCandidatesForStaging = async (
  stagingObjectId: string,
  allBvs: BV[],
  allObjects: Obj[],
  client: SupabaseClient = supabase
): Promise<{ error: Error | null }> => {
  const { data: row, error: loadErr } = await client
    .from('altbericht_import_staging_object')
    .select('*')
    .eq('id', stagingObjectId)
    .single()

  if (loadErr || !row) {
    return { error: new Error(loadErr?.message ?? 'Staging-Zeile nicht gefunden') }
  }

  const typed = row as unknown as AltberichtImportStagingObjectRow
  const payload = buildAltberichtMatchPayload(typed, allBvs, allObjects)

  const { error: upErr } = await client
    .from('altbericht_import_staging_object')
    .update({ match_candidates_json: payload })
    .eq('id', stagingObjectId)

  if (upErr) return { error: new Error(upErr.message) }

  await insertAltberichtImportEvent(client, {
    jobId: typed.job_id,
    fileId: typed.file_id,
    stagingObjectId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.MATCH_COMPUTED,
    message: 'Matching-Vorschläge berechnet',
    payloadJson: {
      bvCount: payload.bv_candidates.length,
      objectCount: payload.object_candidates.length,
    },
  })

  return { error: null }
}
