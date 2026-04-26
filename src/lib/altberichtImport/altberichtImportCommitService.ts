import type { SupabaseClient } from '@supabase/supabase-js'
import { isOnline } from '../../../shared/networkUtils'
import { supabase } from '../../supabase'
import type { BV } from '../../types/bv'
import type { Customer } from '../../types/customer'
import { createBv, createCustomer, createObject } from '../dataService'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'
import { fetchAltberichtImportStagingForJob } from './altberichtImportQueryService'
import {
  ALTBERICHT_STAGING_VALIDATION_CODES,
  type AltberichtStagingRowInput,
} from './altberichtImportReviewTypes'
import { buildC1NewObjectInsertForStaging } from './altberichtImportC1ObjectFields'
import {
  getEffectiveBvId,
  getEffectiveFloor,
  getEffectiveObjectName,
  getEffectiveObjectType,
  getEffectiveRoom,
  validateAltberichtStagingRow,
} from './altberichtStagingValidation'

type CustomerInsert = Omit<Customer, 'id' | 'created_at' | 'updated_at'>
type BvInsert = Omit<BV, 'id' | 'created_at' | 'updated_at'>

export type AltberichtC1RowCommitOverrides = {
  /** Wenn `review_customer_id` fehlt: neuen Kunden anlegen (C1). */
  newCustomer?: CustomerInsert
  /** Wenn `review_bv_id` fehlt: neuen BV anlegen; `customer_id` wird nach ggf. Kundenanlage gesetzt. */
  newBv?: Omit<BvInsert, 'customer_id'> & { customer_id?: string }
  /** DAU-Flow: Detailfelder dürfen optional fehlen. */
  allowMissingDetails?: boolean
}

export type AltberichtC1CommitJobOptions = {
  /** Nur diese Staging-IDs committen (Subset des Jobs). */
  stagingIds?: string[]
  /** Pro Zeile: optionale Neuanlage Kunde/BV. */
  rowOverrides?: Record<string, AltberichtC1RowCommitOverrides>
  /** DAU-Flow: fehlende Detailfelder (Typ/Ort/Name) blockieren C1 nicht. */
  allowMissingDetails?: boolean
}

export type AltberichtC1RowCommitResult = {
  stagingObjectId: string
  ok: boolean
  skipped: boolean
  skipReason?: string
  objectId?: string
  customerId?: string
  bvId?: string
  errorMessage?: string
}

const rowToStagingInput = (row: AltberichtImportStagingObjectRow): AltberichtStagingRowInput => ({
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

const validationErrorsArray = (row: AltberichtImportStagingObjectRow): unknown[] => {
  const j = row.validation_errors_json
  return Array.isArray(j) ? j : []
}

/** Im DAU-Flow dürfen diese gespeicherten Review-Codes die C1-Eligibility nicht blockieren. */
const DAU_NON_BLOCKING_PERSISTED_VALIDATION_CODES: ReadonlySet<string> = new Set([
  ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_BV,
  ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_OBJECT_NAME,
  ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_OBJECT_TYPE,
  ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_LOCATION,
])

/** Laufende validateAltberichtStagingRow-Codes, die im DAU-Pfad (allowMissingDetails) keinen Block bedeuten. */
const DAU_LIVE_SKIPPABLE_VALIDATION_CODES: ReadonlySet<string> = new Set([
  ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_BV,
  ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_OBJECT_NAME,
  ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_OBJECT_TYPE,
  ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_LOCATION,
])

/** DAU: Pflicht ist nur Kunde (Review/Neuanlage) oder leiten über gesetztes BV. */
const dauHasMandatoryCustomerForCommit = (
  row: AltberichtImportStagingObjectRow,
  input: AltberichtStagingRowInput,
  options?: AltberichtC1RowCommitOverrides
): boolean => {
  if (row.review_customer_id?.trim()) return true
  if (options?.newCustomer) return true
  if (getEffectiveBvId(input)?.trim()) return true
  return false
}

const hasBlockingPersistedValidationErrors = (row: AltberichtImportStagingObjectRow): boolean => {
  for (const item of validationErrorsArray(row)) {
    if (!item || typeof item !== 'object') return true
    const code = (item as { code?: unknown }).code
    if (typeof code !== 'string' || !code.trim()) return true
    if (DAU_NON_BLOCKING_PERSISTED_VALIDATION_CODES.has(code.trim())) continue
    return true
  }
  return false
}

export const isAltberichtStagingRowCommitEligible = (
  row: AltberichtImportStagingObjectRow,
  options?: AltberichtC1RowCommitOverrides
): boolean => {
  const rs = row.review_status ?? 'draft'
  if (row.committed_at) return false
  if (options?.allowMissingDetails) {
    if (hasBlockingPersistedValidationErrors(row)) return false
  } else if (validationErrorsArray(row).length > 0) {
    return false
  }
  const input = rowToStagingInput(row)
  if (options?.allowMissingDetails && !dauHasMandatoryCustomerForCommit(row, input, options)) {
    return false
  }
  const errs = validateAltberichtStagingRow(input)
  if (errs.length === 0) {
    return options?.allowMissingDetails ? rs === 'ready' || rs === 'needs_input' : rs === 'ready'
  }
  if (options?.allowMissingDetails) {
    const hard = errs.filter((e) => !DAU_LIVE_SKIPPABLE_VALIDATION_CODES.has(String(e.code)))
    if (hard.length > 0) return false
    return rs === 'ready' || rs === 'needs_input'
  }
  const onlyMissingBv =
    errs.length === 1 && errs[0]?.code === ALTBERICHT_STAGING_VALIDATION_CODES.MISSING_BV
  if (!onlyMissingBv) return false
  if (!options?.newBv) return false
  return rs === 'ready' || rs === 'needs_input'
}

export const commitAltberichtC1StagingRow = async (
  row: AltberichtImportStagingObjectRow,
  options: AltberichtC1RowCommitOverrides | undefined,
  client: SupabaseClient = supabase
): Promise<AltberichtC1RowCommitResult> => {
  const stagingObjectId = row.id
  const input = rowToStagingInput(row)

  if (!isOnline()) {
    return {
      stagingObjectId,
      ok: false,
      skipped: true,
      skipReason: 'offline',
      errorMessage: 'Produktiv-Commit (C1) ist nur online möglich.',
    }
  }

  if (row.committed_at) {
    await insertAltberichtImportEvent(client, {
      jobId: row.job_id,
      fileId: row.file_id,
      stagingObjectId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.COMMIT_C1_ROW_SKIPPED_IDEMPOTENT,
      message: 'C1: Zeile bereits committed, übersprungen',
      payloadJson: { committed_object_id: row.committed_object_id ?? null },
    })
    return {
      stagingObjectId,
      ok: true,
      skipped: true,
      skipReason: 'already_committed',
      objectId: row.committed_object_id ?? undefined,
    }
  }

  if (!isAltberichtStagingRowCommitEligible(row, options)) {
    await insertAltberichtImportEvent(client, {
      jobId: row.job_id,
      fileId: row.file_id,
      stagingObjectId,
      level: 'warn',
      code: ALTBERICHT_IMPORT_EVENT.COMMIT_C1_ROW_SKIPPED_INELIGIBLE,
      message: 'C1: Zeile nicht commit-fähig (Review/Validierung)',
      payloadJson: { review_status: row.review_status ?? null },
    })
    return {
      stagingObjectId,
      ok: false,
      skipped: true,
      skipReason: 'ineligible',
    }
  }

  let customerId = row.review_customer_id?.trim() || null
  let bvId = getEffectiveBvId(input)?.trim() || null

  try {
    if (!customerId && options?.newCustomer) {
      const { data: cust, error: cErr } = await createCustomer(options.newCustomer)
      if (cErr || !cust) {
        throw new Error(cErr?.message ?? 'Kunde konnte nicht angelegt werden')
      }
      customerId = cust.id
      await insertAltberichtImportEvent(client, {
        jobId: row.job_id,
        fileId: row.file_id,
        stagingObjectId,
        level: 'info',
        code: ALTBERICHT_IMPORT_EVENT.COMMIT_C1_CUSTOMER_CREATED,
        message: 'C1: Kunde angelegt',
        payloadJson: { customer_id: cust.id },
      })
    }

    if (!bvId && options?.newBv) {
      const cid = options.newBv.customer_id ?? customerId
      if (!cid) {
        throw new Error('Neuer BV: customer_id fehlt (Kunde zuordnen oder newCustomer liefern).')
      }
      const bvPayload: BvInsert = {
        ...options.newBv,
        customer_id: cid,
      }
      const { data: bv, error: bErr } = await createBv(bvPayload)
      if (bErr || !bv) {
        throw new Error(bErr?.message ?? 'BV konnte nicht angelegt werden')
      }
      bvId = bv.id
      await insertAltberichtImportEvent(client, {
        jobId: row.job_id,
        fileId: row.file_id,
        stagingObjectId,
        level: 'info',
        code: ALTBERICHT_IMPORT_EVENT.COMMIT_C1_BV_CREATED,
        message: 'C1: BV angelegt',
        payloadJson: { bv_id: bv.id, customer_id: cid },
      })
    }

    if (!bvId && !options?.allowMissingDetails) {
      throw new Error('BV fehlt (Review oder newBv).')
    }

    if (!customerId) {
      if (!bvId) {
        throw new Error('Kunde fehlt (review_customer_id oder Neuanlage).')
      }
      const { data: bvQuick, error: qErr } = await client
        .from('bvs')
        .select('customer_id')
        .eq('id', bvId)
        .single()
      if (qErr || !bvQuick?.customer_id) {
        throw new Error(qErr?.message ?? 'Kunde nicht ermittelbar (review_customer_id oder BV).')
      }
      customerId = bvQuick.customer_id as string
    }

    if (bvId) {
      const { data: bvRow, error: bvLoadErr } = await client
        .from('bvs')
        .select('id, customer_id, archived_at')
        .eq('id', bvId)
        .single()

      if (bvLoadErr || !bvRow || bvRow.archived_at) {
        throw new Error(bvLoadErr?.message ?? 'BV nicht gefunden oder archiviert')
      }
      if (bvRow.customer_id !== customerId) {
        throw new Error('BV gehört nicht zum gewählten Kunden.')
      }
    }

    const reviewObjectId = row.review_object_id?.trim() || null
    let committedObjectId: string

    if (reviewObjectId) {
      const { data: objRow, error: oErr } = await client
        .from('objects')
        .select('id, customer_id, bv_id, archived_at')
        .eq('id', reviewObjectId)
        .single()

      if (oErr || !objRow || objRow.archived_at) {
        throw new Error(oErr?.message ?? 'Objekt nicht gefunden oder archiviert')
      }
      if (bvId) {
        if (objRow.bv_id !== bvId) {
          throw new Error('Objekt gehört nicht zum gewählten BV.')
        }
      } else if (objRow.bv_id != null && !options?.allowMissingDetails) {
        throw new Error('Objekt ist einem Bauvorhaben zugeordnet – bitte BV wählen oder Expertenmodus.')
      }
      if (objRow.customer_id != null && objRow.customer_id !== customerId) {
        throw new Error('Objekt-Kunde weicht vom gewählten Kunden ab.')
      }
      committedObjectId = objRow.id
    } else {
      const objPayload = buildC1NewObjectInsertForStaging({
        bvId: bvId ?? null,
        customerId,
        name: getEffectiveObjectName(input),
        floor: getEffectiveFloor(input) || null,
        room: getEffectiveRoom(input) || null,
        typeLabel: getEffectiveObjectType(input),
        catalog: row.catalog_candidates_json,
        proposedInternalId: row.proposed_internal_id?.trim() || null,
      })
      const { data: created, error: oCreateErr } = await createObject(objPayload)
      if (oCreateErr || !created) {
        throw new Error(oCreateErr?.message ?? 'Objekt konnte nicht angelegt werden')
      }
      committedObjectId = created.id
    }

    const committedAt = new Date().toISOString()
    const { error: upErr } = await client
      .from('altbericht_import_staging_object')
      .update({
        review_status: 'committed',
        committed_at: committedAt,
        committed_object_id: committedObjectId,
        commit_last_error: null,
      })
      .eq('id', stagingObjectId)

    if (upErr) {
      throw new Error(upErr.message)
    }

    await insertAltberichtImportEvent(client, {
      jobId: row.job_id,
      fileId: row.file_id,
      stagingObjectId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.COMMIT_C1_ROW_SUCCESS,
      message: 'C1: Zeile produktiv übernommen',
      payloadJson: {
        customer_id: customerId,
        bv_id: bvId,
        object_id: committedObjectId,
        linked_existing_object: Boolean(reviewObjectId),
      },
    })

    return {
      stagingObjectId,
      ok: true,
      skipped: false,
      objectId: committedObjectId,
      customerId: customerId ?? undefined,
      bvId: bvId ?? undefined,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await client
      .from('altbericht_import_staging_object')
      .update({ commit_last_error: msg })
      .eq('id', stagingObjectId)

    await insertAltberichtImportEvent(client, {
      jobId: row.job_id,
      fileId: row.file_id,
      stagingObjectId,
      level: 'error',
      code: ALTBERICHT_IMPORT_EVENT.COMMIT_C1_ROW_FAILED,
      message: `C1: Commit fehlgeschlagen — ${msg}`,
      payloadJson: { error: msg },
    })

    return {
      stagingObjectId,
      ok: false,
      skipped: false,
      errorMessage: msg,
    }
  }
}

/**
 * Commit aller (oder ausgewählter) Staging-Zeilen eines Jobs — zeilenweise, Teilimport möglich.
 */
export const commitAltberichtC1Job = async (
  jobId: string,
  options: AltberichtC1CommitJobOptions | undefined,
  client: SupabaseClient = supabase
): Promise<{ results: AltberichtC1RowCommitResult[]; error: Error | null }> => {
  const { staging, error: listErr } = await fetchAltberichtImportStagingForJob(jobId, client)
  if (listErr) return { results: [], error: listErr }

  let rows = staging
  if (options?.stagingIds?.length) {
    const allowed = new Set(options.stagingIds)
    rows = rows.filter((r) => allowed.has(r.id))
  }

  await insertAltberichtImportEvent(client, {
    jobId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.COMMIT_C1_JOB_STARTED,
    message: 'C1: Job-Commit gestartet',
    payloadJson: { rowCount: rows.length, stagingIds: options?.stagingIds ?? null },
  })

  const results: AltberichtC1RowCommitResult[] = []
  for (const row of rows) {
    const overrides = {
      ...(options?.rowOverrides?.[row.id] ?? {}),
      allowMissingDetails:
        options?.rowOverrides?.[row.id]?.allowMissingDetails ?? options?.allowMissingDetails ?? false,
    } satisfies AltberichtC1RowCommitOverrides
    const res = await commitAltberichtC1StagingRow(row, overrides, client)
    results.push(res)
  }

  const succeeded = results.filter((r) => r.ok && !r.skipped).length
  const failed = results.filter((r) => !r.ok && !r.skipped).length
  const skipped = results.filter((r) => r.skipped).length

  await insertAltberichtImportEvent(client, {
    jobId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.COMMIT_C1_JOB_COMPLETED,
    message: 'C1: Job-Commit beendet',
    payloadJson: { succeeded, failed, skipped, total: results.length },
  })

  return { results, error: null }
}
