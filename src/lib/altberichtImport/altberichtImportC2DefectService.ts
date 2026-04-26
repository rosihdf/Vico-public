import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import { textShouldBeExcludedFromAltberichtC2Import } from './altberichtImportC2FindingFilter'
import type { AltberichtParserFindingCandidateV1 } from './parserContractV1'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'

export const altberichtC2FindingKey = (index: number): string => `f:${index}`

export type AltberichtC2FindingRow = {
  key: string
  index: number
  originalText: string
  alreadyImported: boolean
}

export type AltberichtC2CommitItem = { key: string; text: string }

export type AltberichtC2CommitResult = {
  ok: boolean
  errorMessage?: string
  errorCode?: string
  importedKeys?: string[]
  objectId?: string
}

type RpcPayload = {
  ok?: boolean
  error?: string
  key?: string
  message?: string
  index?: number
  importedKeys?: unknown
  objectId?: string
}

const parseImportedKeySet = (raw: unknown): Set<string> => {
  const out = new Set<string>()
  if (!Array.isArray(raw)) return out
  for (const x of raw) {
    if (typeof x === 'string' && x.trim()) out.add(x.trim())
  }
  return out
}

export const parseAltberichtC2ImportedKeys = (row: AltberichtImportStagingObjectRow): Set<string> =>
  parseImportedKeySet(row.c2_defects_imported_keys as unknown)

const isFindingRecord = (x: unknown): x is AltberichtParserFindingCandidateV1 =>
  Boolean(x && typeof x === 'object' && typeof (x as { text?: unknown }).text === 'string')

export { textShouldBeExcludedFromAltberichtC2Import } from './altberichtImportC2FindingFilter'

export const listAltberichtC2FindingRows = (
  row: AltberichtImportStagingObjectRow
): AltberichtC2FindingRow[] => {
  const imported = parseAltberichtC2ImportedKeys(row)
  const raw = row.findings_json
  if (!Array.isArray(raw)) return []
  const out: AltberichtC2FindingRow[] = []
  raw.forEach((item, index) => {
    if (!isFindingRecord(item)) return
    const t = item.text.trim()
    if (!t) return
    if (textShouldBeExcludedFromAltberichtC2Import(t)) return
    const key = altberichtC2FindingKey(index)
    out.push({
      key,
      index,
      originalText: item.text,
      alreadyImported: imported.has(key),
    })
  })
  return out
}

export const isAltberichtStagingRowC2Eligible = (row: AltberichtImportStagingObjectRow): boolean => {
  if (!row.committed_at || !row.committed_object_id?.trim()) return false
  if ((row.review_status ?? '') !== 'committed') return false
  return true
}

const describeC2RpcFailure = (p: RpcPayload): string => {
  const code = p.error ?? 'unknown'
  switch (code) {
    case 'missing_staging_id':
      return 'Interner Fehler: Staging-ID fehlt.'
    case 'staging_not_found':
      return 'Staging-Zeile nicht gefunden.'
    case 'c1_not_committed':
      return 'C1 ist für diese Zeile noch nicht abgeschlossen.'
    case 'review_not_committed':
      return 'Nur C1-committete Zeilen (Review „committed“) dürfen Mängel übernehmen.'
    case 'object_not_found':
      return 'Das Zielobjekt existiert nicht mehr.'
    case 'object_archived':
      return 'Das Zielobjekt ist archiviert.'
    case 'no_items':
      return 'Keine Mängel zum Übernehmen ausgewählt.'
    case 'invalid_item':
      return 'Mindestens ein Eintrag hat keinen Text oder keinen gültigen Schlüssel.'
    case 'duplicate_key_in_request':
      return `Doppelter Schlüssel in der Anfrage: ${p.key ?? '—'}`
    case 'already_imported':
      return `Dieser Mangel wurde bereits produktiv übernommen (${p.key ?? '—'}). Bitte Liste aktualisieren.`
    case 'exception':
      return p.message?.trim() || 'Unerwarteter Datenbankfehler.'
    default:
      return p.message?.trim() || `C2 abgelehnt (${code}).`
  }
}

export const commitAltberichtC2DefectsForStagingRow = async (
  row: AltberichtImportStagingObjectRow,
  items: AltberichtC2CommitItem[],
  client: SupabaseClient = supabase
): Promise<AltberichtC2CommitResult> => {
  if (!isAltberichtStagingRowC2Eligible(row)) {
    return {
      ok: false,
      errorCode: 'ineligible',
      errorMessage: 'Diese Zeile ist für C2 (Mängel) nicht freigegeben (C1 fehlt oder Review nicht „committed“).',
    }
  }
  if (items.length === 0) {
    return { ok: false, errorCode: 'no_items', errorMessage: 'Bitte mindestens einen Mangel auswählen.' }
  }

  await insertAltberichtImportEvent(client, {
    jobId: row.job_id,
    fileId: row.file_id,
    stagingObjectId: row.id,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.COMMIT_C2_DEFECTS_STARTED,
    message: 'C2: Mängelübernahme gestartet',
    payloadJson: { itemCount: items.length, keys: items.map((i) => i.key) },
  })

  const { data, error } = await client.rpc('altbericht_import_c2_commit_defects', {
    p_staging_object_id: row.id,
    p_items: items,
  })

  if (error) {
    await insertAltberichtImportEvent(client, {
      jobId: row.job_id,
      fileId: row.file_id,
      stagingObjectId: row.id,
      level: 'error',
      code: ALTBERICHT_IMPORT_EVENT.COMMIT_C2_DEFECTS_FAILED,
      message: error.message,
      payloadJson: { phase: 'rpc' },
    })
    return {
      ok: false,
      errorCode: 'rpc',
      errorMessage:
        error.message ||
        'C2-Aufruf fehlgeschlagen. Bitte erneut versuchen; bei anhaltendem Fehler SQL-Migration (Paket C2) prüfen.',
    }
  }

  const payload = (data ?? {}) as RpcPayload
  if (!payload.ok) {
    const msg = describeC2RpcFailure(payload)
    await insertAltberichtImportEvent(client, {
      jobId: row.job_id,
      fileId: row.file_id,
      stagingObjectId: row.id,
      level: 'warn',
      code: ALTBERICHT_IMPORT_EVENT.COMMIT_C2_DEFECTS_REJECTED,
      message: msg,
      payloadJson: payload as Record<string, unknown>,
    })
    return { ok: false, errorCode: payload.error ?? 'rejected', errorMessage: msg }
  }

  const keys = Array.isArray(payload.importedKeys)
    ? payload.importedKeys.filter((k): k is string => typeof k === 'string')
    : []
  const objectId = typeof payload.objectId === 'string' ? payload.objectId : row.committed_object_id ?? undefined

  await insertAltberichtImportEvent(client, {
    jobId: row.job_id,
    fileId: row.file_id,
    stagingObjectId: row.id,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.COMMIT_C2_DEFECTS_SUCCESS,
    message: 'C2: Mängel produktiv angehängt',
    payloadJson: {
      importedKeys: keys,
      objectId,
      count: keys.length,
    },
  })

  return { ok: true, importedKeys: keys, objectId }
}
