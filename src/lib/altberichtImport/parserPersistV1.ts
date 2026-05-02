import type { SupabaseClient } from '@supabase/supabase-js'
import { generateNewObjectInternalId } from '../objectUtils'
import type { AltberichtParserResultV1 } from './parserContractV1'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import { buildImportMatchKeyFromParserObject } from './altberichtImportMatchKey'

/**
 * DB-Insert-Payload für altbericht_import_staging_object (ohne timestamps).
 *
 * `id` ist optional: Beim Reparse wird die UUID einer stabilen Vorgänger-Zeile
 * (Match per `import_match_key` oder `(file_id, sequence)`) wiederverwendet,
 * damit `altbericht_import_embedded_image.linked_staging_object_id` /
 * `suggested_staging_object_id` weiter auf die richtige Position zeigen.
 * Ohne Match generiert die DB eine neue UUID (Default).
 */
export type AltberichtStagingInsertPayloadV1 = {
  id?: string
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
  proposed_internal_id: string
  import_match_key: string
  review_status?: string
  review_object_id?: string | null
  committed_at?: string | null
  committed_object_id?: string | null
  commit_last_error?: string | null
  validation_errors_json?: unknown[]
}

type PreviousStagingMatch = {
  id: string
  file_id: string
  sequence: number
  import_match_key: string | null
  proposed_internal_id: string | null
  review_status: string | null
  review_object_id: string | null
  committed_at: string | null
  committed_object_id: string | null
}

type PreviousStagingMatches = {
  byMatchKey: Map<string, PreviousStagingMatch>
  byFileSequence: Map<string, PreviousStagingMatch>
}

type ReusedStagingMatch = {
  sequence: number
  matchKey: string
  objectId: string | null
  reason: 'match_key' | 'sequence_fallback'
  oldProposedInternalId: string | null
  generatedProposedInternalId: string
  appliedProposedInternalId: string
  oldReviewStatus: string | null
  appliedReviewStatus: string
  reusedStagingId: string | null
}

const VALID_REVIEW_STATUSES = new Set(['draft', 'needs_input', 'ready', 'blocked', 'skipped', 'committed'])

const defaultReviewStatusForParserStatus = (parserStatus: string): string =>
  parserStatus === 'blocked' ? 'blocked' : 'needs_input'

const normalizeReviewStatus = (status: string | null | undefined, parserStatus: string): string => {
  const trimmed = status?.trim()
  if (trimmed && VALID_REVIEW_STATUSES.has(trimmed)) return trimmed
  return defaultReviewStatusForParserStatus(parserStatus)
}

const fileSequenceKey = (fileId: string, sequence: number): string => `${fileId}:${sequence}`

const ensureUniqueProposedInternalIds = (
  rows: AltberichtStagingInsertPayloadV1[],
  protectedProposedIdsBySequence: Map<number, string> = new Map()
): { rows: AltberichtStagingInsertPayloadV1[]; corrected: { sequence: number; from: string; to: string }[] } => {
  const used = new Set<string>()
  const corrected: { sequence: number; from: string; to: string }[] = []

  const normalizedRows = rows.map((row) => ({
    ...row,
    proposed_internal_id: row.proposed_internal_id.trim() || generateNewObjectInternalId(),
  }))

  const protectedSequences = new Set<number>()
  for (const row of normalizedRows) {
    const protectedId = protectedProposedIdsBySequence.get(row.sequence)
    if (!protectedId || row.proposed_internal_id !== protectedId) continue
    if (used.has(protectedId)) continue
    used.add(protectedId)
    protectedSequences.add(row.sequence)
  }

  const out = normalizedRows.map((row) => {
    if (protectedSequences.has(row.sequence)) return row

    let nextId = row.proposed_internal_id
    const originalId = nextId
    while (used.has(nextId)) {
      nextId = generateNewObjectInternalId()
    }
    used.add(nextId)
    if (nextId !== originalId) {
      corrected.push({ sequence: row.sequence, from: originalId, to: nextId })
      return { ...row, proposed_internal_id: nextId }
    }
    return row
  })
  return { rows: out, corrected }
}

const loadPreviousStagingMatchesForJob = async (
  client: SupabaseClient,
  jobId: string
): Promise<{ matches: PreviousStagingMatches; error: Error | null }> => {
  const { data, error } = await client
    .from('altbericht_import_staging_object')
    .select('id, file_id, sequence, import_match_key, proposed_internal_id, review_status, review_object_id, committed_at, committed_object_id, updated_at')
    .eq('job_id', jobId)
    .order('updated_at', { ascending: false })

  const emptyMatches: PreviousStagingMatches = { byMatchKey: new Map(), byFileSequence: new Map() }
  if (error) return { matches: emptyMatches, error: new Error(error.message) }

  const byMatchKey = new Map<string, PreviousStagingMatch>()
  const byFileSequence = new Map<string, PreviousStagingMatch>()
  for (const row of (data ?? []) as PreviousStagingMatch[]) {
    const key = row.import_match_key?.trim()
    const previousMatch: PreviousStagingMatch = {
      id: row.id,
      file_id: row.file_id,
      sequence: row.sequence,
      import_match_key: row.import_match_key,
      proposed_internal_id: row.proposed_internal_id,
      review_status: row.review_status,
      review_object_id: row.review_object_id,
      committed_at: row.committed_at,
      committed_object_id: row.committed_object_id,
    }
    if (key && !byMatchKey.has(key)) byMatchKey.set(key, previousMatch)

    const sequenceKey = fileSequenceKey(row.file_id, row.sequence)
    if (!byFileSequence.has(sequenceKey)) byFileSequence.set(sequenceKey, previousMatch)
  }
  return { matches: { byMatchKey, byFileSequence }, error: null }
}

const reuseStableStagingMatches = (
  rows: AltberichtStagingInsertPayloadV1[],
  previous: PreviousStagingMatches
): { rows: AltberichtStagingInsertPayloadV1[]; reused: ReusedStagingMatch[]; protectedProposedIdsBySequence: Map<number, string> } => {
  const reused: ReusedStagingMatch[] = []
  const protectedProposedIdsBySequence = new Map<number, string>()
  const out = rows.map((row) => {
    const matchKeyMatch = previous.byMatchKey.get(row.import_match_key)
    const prev = matchKeyMatch ?? previous.byFileSequence.get(fileSequenceKey(row.file_id, row.sequence))
    if (!prev) return row

    const reason = matchKeyMatch ? 'match_key' : 'sequence_fallback'
    const objectId = prev.committed_object_id?.trim() || prev.review_object_id?.trim() || null
    const oldProposedInternalId = prev.proposed_internal_id?.trim() || null
    const generatedProposedInternalId = row.proposed_internal_id
    const appliedProposedInternalId = oldProposedInternalId || generatedProposedInternalId
    const appliedReviewStatus =
      prev.committed_at && objectId
        ? 'committed'
        : normalizeReviewStatus(prev.review_status ?? row.review_status, row.status)

    if (oldProposedInternalId) {
      protectedProposedIdsBySequence.set(row.sequence, oldProposedInternalId)
    }
    const reusedStagingId = prev.id?.trim() || null
    reused.push({
      sequence: row.sequence,
      matchKey: row.import_match_key,
      objectId,
      reason,
      oldProposedInternalId,
      generatedProposedInternalId,
      appliedProposedInternalId,
      oldReviewStatus: prev.review_status,
      appliedReviewStatus,
      reusedStagingId,
    })

    return {
      ...row,
      ...(reusedStagingId ? { id: reusedStagingId } : {}),
      proposed_internal_id: appliedProposedInternalId,
      review_status: appliedReviewStatus,
      review_object_id: objectId ?? row.review_object_id ?? null,
      committed_at: prev.committed_at && objectId ? prev.committed_at : row.committed_at ?? null,
      committed_object_id: prev.committed_at && objectId ? objectId : row.committed_object_id ?? null,
      commit_last_error: null,
      validation_errors_json: row.validation_errors_json ?? [],
    }
  })
  return { rows: out, reused, protectedProposedIdsBySequence }
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
    review_status: defaultReviewStatusForParserStatus(o.status),
    validation_errors_json: [],
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
): Promise<{ error: Error | null; matchReusedCount?: number }> => {
  await insertAltberichtImportEvent(client, {
    jobId,
    fileId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.PARSER_STAGING_STARTED,
    message: 'Persistiere Parser-Ergebnis in Staging',
    payloadJson: { parserVersion: result.parserVersion, objectCount: result.objects.length },
  })

  const proposedRows = parserResultV1ToStagingInsertPayloads(jobId, fileId, result)
  const previousMatches = await loadPreviousStagingMatchesForJob(client, jobId)
  if (previousMatches.error) {
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: ALTBERICHT_IMPORT_EVENT.PARSER_STAGING_FAILED,
      message: `Vorherige Staging-Zuordnungen konnten nicht geladen werden: ${previousMatches.error.message}`,
      payloadJson: { phase: 'previous_match_load' },
    })
  }
  const reusedResult = reuseStableStagingMatches(proposedRows, previousMatches.matches)
  if (reusedResult.reused.length > 0) {
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.PARSER_STAGING_MATCH_REUSED,
      message: 'Stabile Staging-Zuordnungen aus vorherigem Parse wiederverwendet',
      payloadJson: {
        reusedCount: reusedResult.reused.length,
        sequences: reusedResult.reused.map((item) => item.sequence),
        linkedObjectCount: reusedResult.reused.filter((item) => Boolean(item.objectId)).length,
        reusedStagingIdCount: reusedResult.reused.filter((item) => Boolean(item.reusedStagingId)).length,
        details: reusedResult.reused.map((item) => ({
          sequence: item.sequence,
          reason: item.reason,
          oldProposedInternalId: item.oldProposedInternalId,
          generatedProposedInternalId: item.generatedProposedInternalId,
          appliedProposedInternalId: item.appliedProposedInternalId,
          oldReviewStatus: item.oldReviewStatus,
          appliedReviewStatus: item.appliedReviewStatus,
          objectId: item.objectId,
          reusedStagingId: item.reusedStagingId,
        })),
      },
    })
  }

  await client.from('altbericht_import_staging_object').delete().eq('file_id', fileId)

  const { rows, corrected } = ensureUniqueProposedInternalIds(
    reusedResult.rows,
    reusedResult.protectedProposedIdsBySequence
  )
  if (corrected.length > 0) {
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: ALTBERICHT_IMPORT_EVENT.PARSER_STAGING_PROPOSED_IDS_DEDUPED,
      message: 'Doppelte vorgeschlagene Objektkennungen im Staging korrigiert',
      payloadJson: {
        correctedCount: corrected.length,
        sequences: corrected.map((item) => item.sequence),
      },
    })
  }
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

  return { error: null, matchReusedCount: reusedResult.reused.length }
}
