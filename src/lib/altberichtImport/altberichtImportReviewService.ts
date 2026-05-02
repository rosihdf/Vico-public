import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'
import type {
  AltberichtImportReviewStatus,
  AltberichtStagingReviewPatch,
  AltberichtStagingRowInput,
} from './altberichtImportReviewTypes'
import {
  validateAltberichtStagingRow,
  validationErrorsToJson,
} from './altberichtStagingValidation'

const rowToInput = (row: AltberichtImportStagingObjectRow): AltberichtStagingRowInput => ({
  bv_id: row.bv_id,
  object_name: row.object_name,
  object_type_text: row.object_type_text,
  floor_text: row.floor_text,
  room_text: row.room_text,
  review_bv_id: row.review_bv_id ?? null,
  review_object_name: row.review_object_name ?? null,
  review_object_type_text: row.review_object_type_text ?? null,
  review_floor_text: row.review_floor_text ?? null,
  review_room_text: row.review_room_text ?? null,
  review_object_id: row.review_object_id ?? null,
  review_status: row.review_status ?? 'draft',
})

const mergePatch = (
  row: AltberichtImportStagingObjectRow,
  patch: AltberichtStagingReviewPatch
): AltberichtImportStagingObjectRow => ({
  ...row,
  review_customer_id:
    patch.review_customer_id !== undefined ? patch.review_customer_id : row.review_customer_id,
  review_bv_id: patch.review_bv_id !== undefined ? patch.review_bv_id : row.review_bv_id,
  review_object_id:
    patch.review_object_id !== undefined ? patch.review_object_id : row.review_object_id,
  review_object_name:
    patch.review_object_name !== undefined ? patch.review_object_name : row.review_object_name,
  review_object_type_text:
    patch.review_object_type_text !== undefined ? patch.review_object_type_text : row.review_object_type_text,
  review_floor_text: patch.review_floor_text !== undefined ? patch.review_floor_text : row.review_floor_text,
  review_room_text: patch.review_room_text !== undefined ? patch.review_room_text : row.review_room_text,
  review_location_rule:
    patch.review_location_rule !== undefined ? patch.review_location_rule : row.review_location_rule,
  review_blocked_reason:
    patch.review_blocked_reason !== undefined ? patch.review_blocked_reason : row.review_blocked_reason,
  review_status:
    patch.review_status !== undefined
      ? patch.review_status
      : ((row.review_status ?? 'draft') as AltberichtImportReviewStatus),
  findings_json:
    patch.findings_json !== undefined ? patch.findings_json : row.findings_json,
})

const findingsJsonChanged = (before: unknown, next: unknown): boolean =>
  JSON.stringify(before ?? []) !== JSON.stringify(next ?? [])

const patchDefinesOnlyFindings = (patch: AltberichtStagingReviewPatch): boolean => {
  const keys = (Object.keys(patch) as (keyof AltberichtStagingReviewPatch)[]).filter(
    (k) => patch[k] !== undefined
  )
  return keys.length === 1 && keys[0] === 'findings_json'
}

const resolveNextReviewStatusAfterPatch = (
  before: AltberichtImportStagingObjectRow,
  patch: AltberichtStagingReviewPatch,
  validationErrors: ReturnType<typeof validateAltberichtStagingRow>
): AltberichtImportReviewStatus => {
  if (patch.review_status === 'blocked') return 'blocked'
  if (patch.review_status === 'skipped') return 'skipped'

  const explicit = patch.review_status
  if (explicit === 'draft' || explicit === 'needs_input' || explicit === 'ready') {
    if (explicit === 'ready' && validationErrors.length > 0) return 'needs_input'
    return explicit
  }

  if ((before.review_status ?? 'draft') === 'blocked' && explicit === undefined) return 'blocked'
  if ((before.review_status ?? 'draft') === 'skipped' && explicit === undefined) return 'skipped'

  return validationErrors.length > 0 ? 'needs_input' : 'ready'
}

/** Liest Zeile, berechnet Validierung; blockiert/übersprungen bleiben, sonst needs_input/ready. */
export const recomputeAltberichtStagingReviewRow = async (
  stagingObjectId: string,
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
  if (typed.committed_at || typed.review_status === 'committed') {
    return { error: null }
  }
  const validationErrors = validateAltberichtStagingRow(rowToInput(typed))
  const payloadJson = validationErrorsToJson(validationErrors)

  const prevStatus = typed.review_status ?? 'draft'
  let nextStatus: AltberichtImportReviewStatus
  if (prevStatus === 'skipped') nextStatus = 'skipped'
  else if (prevStatus === 'blocked') nextStatus = 'blocked'
  else {
    nextStatus = validationErrors.length > 0 ? 'needs_input' : 'ready'
  }

  const { error: upErr } = await client
    .from('altbericht_import_staging_object')
    .update({
      validation_errors_json: payloadJson,
      review_status: nextStatus,
    })
    .eq('id', stagingObjectId)

  if (upErr) return { error: new Error(upErr.message) }

  await insertAltberichtImportEvent(client, {
    jobId: typed.job_id,
    fileId: typed.file_id,
    stagingObjectId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.REVIEW_VALIDATION_RECOMPUTED,
    message: 'Review-Validierung neu berechnet',
    payloadJson: {
      reviewStatus: nextStatus,
      previousReviewStatus: prevStatus,
      validationCodes: validationErrors.map((e) => e.code),
    },
  })

  if (nextStatus !== prevStatus) {
    await insertAltberichtImportEvent(client, {
      jobId: typed.job_id,
      fileId: typed.file_id,
      stagingObjectId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.REVIEW_STATUS_CHANGED,
      message: `Review-Status: ${prevStatus} → ${nextStatus}`,
      payloadJson: { from: prevStatus, to: nextStatus },
    })
  }

  return { error: null }
}

/**
 * Wendet Kunde/BV auf alle (oder nur BV-leere) Staging-Zeilen des Jobs an; pro Zeile `patchAltberichtStagingReview` + Events.
 */
export const applyAltberichtJobReviewCustomerBvDefaults = async (
  jobId: string,
  values: { review_customer_id: string | null; review_bv_id: string | null },
  mode: 'all' | 'empty_bv_only',
  client: SupabaseClient = supabase
): Promise<{ error: Error | null; updatedCount: number }> => {
  const { data: rows, error: listErr } = await client
    .from('altbericht_import_staging_object')
    .select('*')
    .eq('job_id', jobId)

  if (listErr) return { error: new Error(listErr.message), updatedCount: 0 }

  let count = 0
  for (const r of rows ?? []) {
    const row = r as unknown as AltberichtImportStagingObjectRow
    if (mode === 'empty_bv_only') {
      const hasBv = Boolean(row.review_bv_id ?? row.bv_id)
      if (hasBv) continue
    }
    const res = await patchAltberichtStagingReview(
      row.id,
      {
        review_customer_id: values.review_customer_id,
        review_bv_id: values.review_bv_id,
      },
      client
    )
    if (res.error) return { error: res.error, updatedCount: count }
    count += 1
  }

  if (count > 0) {
    await insertAltberichtImportEvent(client, {
      jobId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.REVIEW_JOB_BV_DEFAULTS,
      message: 'Job-weite Kunde/BV-Zuordnung auf Staging angewendet',
      payloadJson: { mode, updatedCount: count, ...values },
    })
  }

  return { error: null, updatedCount: count }
}

export const recomputeAltberichtStagingReviewForJob = async (
  jobId: string,
  client: SupabaseClient = supabase
): Promise<{ error: Error | null }> => {
  const { data: rows, error: listErr } = await client
    .from('altbericht_import_staging_object')
    .select('id')
    .eq('job_id', jobId)

  if (listErr) return { error: new Error(listErr.message) }
  for (const r of rows ?? []) {
    const res = await recomputeAltberichtStagingReviewRow(r.id as string, client)
    if (res.error) return res
  }
  return { error: null }
}

export const patchAltberichtStagingReview = async (
  stagingObjectId: string,
  patch: AltberichtStagingReviewPatch,
  client: SupabaseClient = supabase
): Promise<{ error: Error | null; row?: AltberichtImportStagingObjectRow | null }> => {
  const { data: row, error: loadErr } = await client
    .from('altbericht_import_staging_object')
    .select('*')
    .eq('id', stagingObjectId)
    .single()

  if (loadErr || !row) {
    return { error: new Error(loadErr?.message ?? 'Staging-Zeile nicht gefunden'), row: null }
  }

  const typed = row as unknown as AltberichtImportStagingObjectRow
  const isC1Committed = Boolean(typed.committed_at || typed.review_status === 'committed')

  if (isC1Committed) {
    if (!patchDefinesOnlyFindings(patch)) {
      return {
        error: new Error(
          'Staging-Zeile ist bereits in den Stammdaten übernommen (C1). Nur Mängel-Texte (findings_json) dürfen noch angepasst werden.'
        ),
        row: null,
      }
    }
    if (patch.findings_json === undefined) {
      return { error: new Error('Keine Änderung übermittelt.'), row: null }
    }

    const { data: auth } = await client.auth.getUser()
    const reviewedBy = auth.user?.id ?? null
    const resetC2 = findingsJsonChanged(typed.findings_json, patch.findings_json)
    const { data: updated, error: upErr } = await client
      .from('altbericht_import_staging_object')
      .update({
        findings_json: patch.findings_json,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        ...(resetC2
          ? {
              c2_defects_imported_keys: [],
              c2_defects_last_import_at: null,
              c2_defects_last_error: null,
            }
          : {}),
      })
      .eq('id', stagingObjectId)
      .select('*')
      .single()

    if (upErr || !updated) {
      return { error: new Error(upErr?.message ?? 'Update fehlgeschlagen'), row: null }
    }

    const out = updated as unknown as AltberichtImportStagingObjectRow
    await insertAltberichtImportEvent(client, {
      jobId: typed.job_id,
      fileId: typed.file_id,
      stagingObjectId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.REVIEW_PATCH,
      message: 'Mängel (findings_json) angepasst',
      payloadJson: { patch: { findings_json: true }, c2Reset: resetC2 },
    })

    return { error: null, row: out }
  }

  const merged = mergePatch(typed, patch)
  const validationErrors = validateAltberichtStagingRow(rowToInput(merged))
  const payloadJson = validationErrorsToJson(validationErrors)
  const nextStatus = resolveNextReviewStatusAfterPatch(typed, patch, validationErrors)

  const { data: auth } = await client.auth.getUser()
  const reviewedBy = auth.user?.id ?? null

  const touchFindings = patch.findings_json !== undefined
  const resetC2 =
    touchFindings && findingsJsonChanged(typed.findings_json, merged.findings_json)

  const { data: updated, error: upErr } = await client
    .from('altbericht_import_staging_object')
    .update({
      review_customer_id: merged.review_customer_id ?? null,
      review_bv_id: merged.review_bv_id ?? null,
      review_object_id: merged.review_object_id ?? null,
      review_object_name: merged.review_object_name ?? null,
      review_object_type_text: merged.review_object_type_text ?? null,
      review_floor_text: merged.review_floor_text ?? null,
      review_room_text: merged.review_room_text ?? null,
      review_location_rule: merged.review_location_rule ?? null,
      review_blocked_reason: merged.review_blocked_reason ?? null,
      review_status: nextStatus,
      validation_errors_json: payloadJson,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      ...(touchFindings ? { findings_json: merged.findings_json } : {}),
      ...(resetC2
        ? {
            c2_defects_imported_keys: [],
            c2_defects_last_import_at: null,
            c2_defects_last_error: null,
          }
        : {}),
    })
    .eq('id', stagingObjectId)
    .select('*')
    .single()

  if (upErr || !updated) {
    return { error: new Error(upErr?.message ?? 'Update fehlgeschlagen'), row: null }
  }

  const out = updated as unknown as AltberichtImportStagingObjectRow

  await insertAltberichtImportEvent(client, {
    jobId: typed.job_id,
    fileId: typed.file_id,
    stagingObjectId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.REVIEW_PATCH,
    message: 'Review-Felder aktualisiert',
    payloadJson: {
      patch: { ...patch },
      reviewStatus: nextStatus,
      validationCodes: validationErrors.map((e) => e.code),
    },
  })

  if (nextStatus !== (typed.review_status ?? 'draft')) {
    await insertAltberichtImportEvent(client, {
      jobId: typed.job_id,
      fileId: typed.file_id,
      stagingObjectId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.REVIEW_STATUS_CHANGED,
      message: `Review-Status: ${typed.review_status ?? 'draft'} → ${nextStatus}`,
      payloadJson: { from: typed.review_status ?? 'draft', to: nextStatus },
    })
  }

  return { error: null, row: out }
}
