import type { SupabaseClient } from '@supabase/supabase-js'
import { generateNewObjectInternalId } from '../objectUtils'
import type { AltberichtParserResultV1 } from './parserContractV1'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import { buildImportMatchKeyFromParserObject } from './altberichtImportMatchKey'

/**
 * DB-Insert-Payload für altbericht_import_staging_object (ohne id/timestamps).
 */
export type AltberichtStagingInsertPayloadV1 = {
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
}

/** Reine Abbildung Parser-Contract → Staging-Insert (kein I/O). */
export const parserResultV1ToStagingInsertPayloads = (
  jobId: string,
  fileId: string,
  result: AltberichtParserResultV1
): AltberichtStagingInsertPayloadV1[] =>
  result.objects.map((o) => ({
    job_id: jobId,
    file_id: fileId,
    sequence: o.sequence,
    status: o.status,
    customer_text: o.customerText ?? null,
    site_text: o.siteText ?? null,
    bv_id: o.bvId ?? null,
    object_name: o.objectName,
    object_type_text: o.objectTypeText,
    floor_text: o.floorText ?? null,
    room_text: o.roomText ?? null,
    location_rule: o.locationRule,
    findings_json: o.findings,
    catalog_candidates_json: o.catalogCandidates,
    media_hints_json: o.mediaHints,
    parser_confidence_json: o.parserConfidence ?? null,
    source_refs_json: o.sourceRefs ?? null,
    analysis_trace_json: o.analysisTrace ?? null,
    proposed_internal_id: generateNewObjectInternalId(),
    import_match_key: buildImportMatchKeyFromParserObject(o),
  }))

/**
 * Persistiert Parser-Ergebnis nur in Import-Staging (keine Stammdaten).
 * Aktualisiert die Dateizeile auf status `staged` (nach erfolgreichem Staging).
 */
export type PersistParserResultV1Options = {
  /** Optional: in altbericht_import_file.extracted_text speichern (bereits gekürzt). */
  extractedTextForDb?: string | null
}

export const persistParserResultV1StagingOnly = async (
  client: SupabaseClient,
  jobId: string,
  fileId: string,
  result: AltberichtParserResultV1,
  options: PersistParserResultV1Options = {}
): Promise<{ error: Error | null }> => {
  await insertAltberichtImportEvent(client, {
    jobId,
    fileId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.PARSER_STAGING_STARTED,
    message: 'Persistiere Parser-Ergebnis in Staging',
    payloadJson: { parserVersion: result.parserVersion, objectCount: result.objects.length },
  })

  await client.from('altbericht_import_staging_object').delete().eq('file_id', fileId)

  const rows = parserResultV1ToStagingInsertPayloads(jobId, fileId, result)
  if (rows.length > 0) {
    const { error: insErr } = await client.from('altbericht_import_staging_object').insert(rows)
    if (insErr) {
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'error',
        code: ALTBERICHT_IMPORT_EVENT.PARSER_STAGING_FAILED,
        message: insErr.message,
        payloadJson: { phase: 'staging_insert' },
      })
      return { error: new Error(insErr.message) }
    }
  }

  const filePatch: Record<string, unknown> = {
    status: 'staged',
    parsed_at: new Date().toISOString(),
    parser_version: result.parserVersion,
    parse_error_code: null,
    parse_error_message: null,
  }
  if (options.extractedTextForDb !== undefined) {
    filePatch.extracted_text = options.extractedTextForDb
  }

  const { error: fileErr } = await client.from('altbericht_import_file').update(filePatch).eq('id', fileId)

  if (fileErr) {
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'error',
      code: ALTBERICHT_IMPORT_EVENT.PARSER_STAGING_FAILED,
      message: fileErr.message,
      payloadJson: { phase: 'file_status_update' },
    })
    return { error: new Error(fileErr.message) }
  }

  for (const w of result.warnings) {
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: w.code,
      message: w.message,
      payloadJson: w.details ? { details: w.details } : null,
    })
  }

  await insertAltberichtImportEvent(client, {
    jobId,
    fileId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.PARSER_STAGING_SUCCEEDED,
    message: 'Staging aus Parser-Ergebnis geschrieben',
    payloadJson: { objectCount: rows.length },
  })

  return { error: null }
}
