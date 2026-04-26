import type { SupabaseClient } from '@supabase/supabase-js'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import {
  ALTBERICHT_PDF_IMAGE_SCAN_VERSION,
  type AltberichtEmbeddedImageDraft,
  scanAltberichtPdfForEmbeddedImages,
} from './altberichtPdfImageScan'
import { suggestStagingObjectIdForPage, type StagingRowForImageSuggest } from './altberichtEmbeddedImageSuggest'
import type { AltberichtImportEmbeddedImageUserIntent } from './altberichtImportTypes'

const isMissingTableError = (message: string): boolean =>
  /relation|does not exist|schema cache/i.test(message)

export const fetchStagingRowsForEmbeddedImageSuggest = async (
  client: SupabaseClient,
  fileId: string
): Promise<{ rows: StagingRowForImageSuggest[]; error: Error | null }> => {
  const { data, error } = await client
    .from('altbericht_import_staging_object')
    .select('id, file_id, sequence, source_refs_json, media_hints_json, findings_json')
    .eq('file_id', fileId)

  if (error) return { rows: [], error: new Error(error.message) }
  return { rows: (data ?? []) as StagingRowForImageSuggest[], error: null }
}

const draftsToInserts = (
  jobId: string,
  fileId: string,
  drafts: AltberichtEmbeddedImageDraft[],
  staging: StagingRowForImageSuggest[]
) =>
  drafts.map((d) => ({
    job_id: jobId,
    file_id: fileId,
    page_number: d.pageNumber,
    image_index: d.imageIndex,
    scan_version: ALTBERICHT_PDF_IMAGE_SCAN_VERSION,
    op_kind: d.opKind,
    suggested_staging_object_id: suggestStagingObjectIdForPage(fileId, d.pageNumber, staging),
    user_intent: 'unreviewed' as const,
    linked_staging_object_id: null as string | null,
    preview_storage_path: null as string | null,
  }))

/**
 * Nach Text-/Staging-Parser: eingebettete Bilder zählen und Metadaten ersetzen.
 * Fehler brechen den Import nicht ab; nur Event `warn` / still bei fehlender Migration.
 */
export const runAltberichtEmbeddedImageScanForFile = async (
  client: SupabaseClient,
  jobId: string,
  fileId: string,
  pdfBytes: ArrayBuffer
): Promise<{ count: number; error: Error | null }> => {
  if (typeof window === 'undefined') {
    return { count: 0, error: null }
  }
  let drafts: AltberichtEmbeddedImageDraft[] = []
  try {
    drafts = await scanAltberichtPdfForEmbeddedImages(pdfBytes)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: 'import.parser.embedded_image_scan_failed',
      message: 'PDF-Bildscan fehlgeschlagen (Textparser unverändert).',
      payloadJson: { message },
    })
    return { count: 0, error: new Error(message) }
  }

  const { rows: staging, error: stErr } = await fetchStagingRowsForEmbeddedImageSuggest(client, fileId)
  if (stErr) {
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: 'import.parser.embedded_image_staging_load_failed',
      message: stErr.message,
    })
  }

  const { error: delErr } = await client.from('altbericht_import_embedded_image').delete().eq('file_id', fileId)
  if (delErr) {
    if (isMissingTableError(delErr.message)) {
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'warn',
        code: 'import.parser.embedded_image_table_missing',
        message:
          'Tabelle altbericht_import_embedded_image fehlt; Migration Paket E ausführen. Bildscan übersprungen.',
      })
      return { count: 0, error: null }
    }
    return { count: 0, error: new Error(delErr.message) }
  }

  if (drafts.length === 0) {
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.EMBEDDED_IMAGE_SCAN_DONE,
      message: 'PDF-Bildscan: keine eingebetteten Zeichenoperationen',
      payloadJson: { count: 0 },
    })
    return { count: 0, error: null }
  }

  const inserts = draftsToInserts(jobId, fileId, drafts, staging)
  const { error: insErr } = await client.from('altbericht_import_embedded_image').insert(inserts)
  if (insErr) {
    if (isMissingTableError(insErr.message)) {
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'warn',
        code: 'import.parser.embedded_image_table_missing',
        message:
          'Tabelle altbericht_import_embedded_image fehlt; Migration Paket E ausführen. Bildscan übersprungen.',
      })
      return { count: 0, error: null }
    }
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: 'import.parser.embedded_image_persist_failed',
      message: insErr.message,
    })
    return { count: 0, error: new Error(insErr.message) }
  }

  await insertAltberichtImportEvent(client, {
    jobId,
    fileId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.EMBEDDED_IMAGE_SCAN_DONE,
    message: 'PDF-Bildscan abgeschlossen',
    payloadJson: { count: inserts.length, scanVersion: ALTBERICHT_PDF_IMAGE_SCAN_VERSION },
  })
  return { count: inserts.length, error: null }
}

export type PatchAltberichtEmbeddedImageInput = {
  userIntent: AltberichtImportEmbeddedImageUserIntent
  linkedStagingObjectId: string | null
  c2FindingKey?: string | null
}

export const patchAltberichtEmbeddedImage = async (
  id: string,
  patch: PatchAltberichtEmbeddedImageInput,
  client: SupabaseClient
): Promise<{ error: Error | null }> => {
  const up: Record<string, unknown> = {
    user_intent: patch.userIntent,
    linked_staging_object_id: patch.linkedStagingObjectId,
  }
  if (patch.c2FindingKey !== undefined) {
    up.c2_finding_key = patch.c2FindingKey
  }
  const { error } = await client.from('altbericht_import_embedded_image').update(up).eq('id', id)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}
