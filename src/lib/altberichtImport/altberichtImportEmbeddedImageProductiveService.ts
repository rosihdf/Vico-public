/**
 * Übernahme eingebetteter PDF-Bildkandidaten in object_photos bzw. object_defect_photos (nur explizit, Experte).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isOnline } from '../../../shared/networkUtils'
import { supabase } from '../../supabase'
import { fetchObject, uploadObjectDefectPhoto, uploadObjectPhoto, notifyDataChange } from '../dataService'
import { renderAltberichtPdfPageToPngDataUrl } from './altberichtPdfPageThumb'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import { resolveStammdatenDefectEntryIdForC2Key } from './altberichtImportEmbeddedDefectResolve'
import type { AltberichtImportEmbeddedImageRow } from './altberichtImportTypes'
import type { AltberichtImportFileRow } from './altberichtImportTypes'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'

const dataUrlToPngFile = (dataUrl: string, fileName: string): Promise<File> =>
  (async () => {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    return new File([blob], fileName, { type: 'image/png' })
  })()

const loadContext = async (
  client: SupabaseClient,
  embeddedId: string
): Promise<{
  embedded: AltberichtImportEmbeddedImageRow
  fileRow: AltberichtImportFileRow
} | { error: string }> => {
  const { data: em, error: e1 } = await client
    .from('altbericht_import_embedded_image')
    .select('*')
    .eq('id', embeddedId)
    .single()
  if (e1 || !em) {
    return { error: e1?.message ?? 'Eingebettetes Bild nicht gefunden.' }
  }
  const { data: fileRow, error: e2 } = await client
    .from('altbericht_import_file')
    .select('*')
    .eq('id', (em as { file_id: string }).file_id)
    .single()
  if (e2 || !fileRow) {
    return { error: e2?.message ?? 'Import-Datei nicht gefunden.' }
  }
  return { embedded: em as unknown as AltberichtImportEmbeddedImageRow, fileRow: fileRow as AltberichtImportFileRow }
}

const loadStaging = async (client: SupabaseClient, id: string): Promise<AltberichtImportStagingObjectRow | null> => {
  const { data, error } = await client.from('altbericht_import_staging_object').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return data as unknown as AltberichtImportStagingObjectRow
}

const pickStaging = async (
  client: SupabaseClient,
  embedded: AltberichtImportEmbeddedImageRow
): Promise<AltberichtImportStagingObjectRow | null> => {
  if (embedded.linked_staging_object_id) {
    const s = await loadStaging(client, embedded.linked_staging_object_id)
    if (s) return s
  }
  if (embedded.suggested_staging_object_id) {
    return loadStaging(client, embedded.suggested_staging_object_id)
  }
  return null
}

const resolveObjectId = (s: AltberichtImportStagingObjectRow): string | null => {
  const c = s.committed_object_id?.trim() ?? null
  if (c) return c
  return null
}

const buildPngDataUrl = async (file: AltberichtImportFileRow, pageNumber: number): Promise<string | null> => {
  const { data: blob, error: dl } = await supabase.storage.from(file.storage_bucket).download(file.storage_path)
  if (dl || !blob) return null
  const buf = await blob.arrayBuffer()
  return renderAltberichtPdfPageToPngDataUrl(buf, pageNumber)
}

export type ImportEmbeddedImageResult = {
  ok: boolean
  code:
    | 'ok'
    | 'already_imported'
    | 'not_online'
    | 'missing_intent'
    | 'imported'
    | 'no_object'
    | 'bad_intent'
    | 'load_failed'
    | 'defect_unresolved'
    | 'object_photo_failed'
    | 'defect_photo_failed'
  message?: string
  objectPhotoId?: string
  defectPhotoId?: string
}

const markFailed = async (
  client: SupabaseClient,
  id: string,
  message: string
): Promise<void> => {
  await client
    .from('altbericht_import_embedded_image')
    .update({
      import_status: 'failed',
      import_error: message,
    })
    .eq('id', id)
}

/**
 * Eine Kandidatenzeile produktiv übernehmen (nur im Browser, nur online).
 * Idempotent: bei bereits `imported` kein erneutes Upload, nur Rückgabe.
 */
export const importEmbeddedImageProductive = async (
  embeddedId: string,
  client: SupabaseClient = supabase
): Promise<ImportEmbeddedImageResult> => {
  if (typeof window === 'undefined') {
    return { ok: false, code: 'load_failed', message: 'Nur im Browser verfügbar.' }
  }
  if (!isOnline()) {
    return { ok: false, code: 'not_online', message: 'Nur online möglich.' }
  }

  const ctx = await loadContext(client, embeddedId)
  if ('error' in ctx) {
    return { ok: false, code: 'load_failed', message: ctx.error }
  }
  const { embedded, fileRow } = ctx
  if ((embedded.import_status ?? 'not_imported') === 'imported') {
    return { ok: true, code: 'already_imported', message: 'Bereits übernommen.' }
  }
  if (embedded.user_intent === 'unreviewed' || embedded.user_intent === 'ignore') {
    return { ok: false, code: 'missing_intent', message: 'Intent weder Objekt- noch Mängelfoto.' }
  }

  const staging = await pickStaging(client, embedded)
  if (!staging) {
    await markFailed(client, embeddedId, 'Keine Staging-Zeile wählbar (Verknüpfung/Vorschlag).')
    return { ok: false, code: 'load_failed', message: 'Keine Staging-Position. Bitte manuell verknüpfen.' }
  }

  const objectId = resolveObjectId(staging)
  if (!objectId) {
    const msg = 'Zielobjekt: C1 noch nicht abgeschlossen (kein committed_object_id).'
    await markFailed(client, embeddedId, msg)
    return { ok: false, code: 'no_object', message: msg }
  }

  const object = await fetchObject(objectId)
  if (!object) {
    const msg = 'Zielobjekt existiert nicht.'
    await markFailed(client, embeddedId, msg)
    return { ok: false, code: 'no_object', message: msg }
  }
  if (object.archived_at) {
    const msg = 'Zielobjekt ist archiviert.'
    await markFailed(client, embeddedId, msg)
    return { ok: false, code: 'no_object', message: msg }
  }

  const dataUrl = await buildPngDataUrl(fileRow, embedded.page_number)
  if (!dataUrl) {
    const msg = 'PDF-Seite für Übernahme nicht renderbar (Download/Render).'
    await markFailed(client, embeddedId, msg)
    return { ok: false, code: 'load_failed', message: msg }
  }

  const file = await dataUrlToPngFile(
    dataUrl,
    `altbericht-embedded-s${embedded.page_number}-i${embedded.image_index}.png`
  )

  if (embedded.user_intent === 'object_photo') {
    const up = await uploadObjectPhoto(
      objectId,
      file,
      `Altbericht-Import, Seite ${embedded.page_number}`
    )
    if (up.error || !up.data?.id) {
      const msg = up.error?.message ?? 'Galerie-Upload fehlgeschlagen.'
      await markFailed(client, embeddedId, msg)
      return { ok: false, code: 'object_photo_failed', message: msg }
    }
    const photoId = up.data.id
    await client
      .from('altbericht_import_embedded_image')
      .update({
        import_status: 'imported',
        imported_at: new Date().toISOString(),
        import_error: null,
        import_object_photo_id: photoId,
        import_defect_photo_id: null,
        target_object_id: objectId,
      })
      .eq('id', embeddedId)

    await insertAltberichtImportEvent(client, {
      jobId: embedded.job_id,
      fileId: embedded.file_id,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.EMBEDDED_IMAGE_IMPORT_OK,
      message: 'Eingebettetes Bild in Objekt-Galerie übernommen',
      payloadJson: { embeddedId, objectId, objectPhotoId: photoId, kind: 'object_gallery' },
    })
    notifyDataChange()
    return { ok: true, code: 'imported', objectPhotoId: photoId }
  }

  if (embedded.user_intent === 'defect_photo') {
    const c2k = embedded.c2_finding_key
    if (!c2k?.trim()) {
      const msg = 'Bitte C2-Mangel (f:Index) wählen – erst nach C2-Übernahme des Textes sinnvoll.'
      await markFailed(client, embeddedId, msg)
      return { ok: false, code: 'defect_unresolved', message: msg }
    }
    const res = resolveStammdatenDefectEntryIdForC2Key(object, staging, c2k.trim())
    if (!res.ok) {
      await markFailed(client, embeddedId, res.message)
      return { ok: false, code: 'defect_unresolved', message: res.message }
    }
    const up = await uploadObjectDefectPhoto({ objectId, defectEntryId: res.defectEntryId, file })
    if (up.error || !up.data?.id) {
      const msg = up.error?.message ?? 'Mängelfoto-Upload fehlgeschlagen.'
      await markFailed(client, embeddedId, msg)
      return { ok: false, code: 'defect_photo_failed', message: msg }
    }
    const dpid = up.data.id
    await client
      .from('altbericht_import_embedded_image')
      .update({
        import_status: 'imported',
        imported_at: new Date().toISOString(),
        import_error: null,
        import_object_photo_id: null,
        import_defect_photo_id: dpid,
        target_object_id: objectId,
      })
      .eq('id', embeddedId)

    await insertAltberichtImportEvent(client, {
      jobId: embedded.job_id,
      fileId: embedded.file_id,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.EMBEDDED_IMAGE_IMPORT_OK,
      message: 'Eingebettetes Bild als Stammdaten-Mängelfoto übernommen',
      payloadJson: {
        embeddedId,
        objectId,
        defectPhotoId: dpid,
        defectEntryId: res.defectEntryId,
        c2Key: c2k.trim(),
        kind: 'defect_stammdaten',
      },
    })
    notifyDataChange()
    return { ok: true, code: 'imported', defectPhotoId: dpid }
  }

  return { ok: false, code: 'bad_intent', message: 'Unbekannter Intent.' }
}

export const importAllEmbeddedImagesPendingForJob = async (
  jobId: string,
  client: SupabaseClient = supabase
): Promise<{
  ok: number
  skipped: number
  failed: number
  results: { id: string; result: ImportEmbeddedImageResult }[]
}> => {
  const { data, error } = await client
    .from('altbericht_import_embedded_image')
    .select('id, user_intent, import_status')
    .eq('job_id', jobId)

  if (error || !data) {
    return { ok: 0, skipped: 0, failed: 0, results: [] }
  }
  const rows = data as { id: string; user_intent: string; import_status: string }[]
  const candidates = rows.filter((r) => {
    if (r.user_intent !== 'object_photo' && r.user_intent !== 'defect_photo') return false
    const st = (r as { import_status?: string }).import_status ?? 'not_imported'
    return st !== 'imported'
  })
  const results: { id: string; result: ImportEmbeddedImageResult }[] = []
  let ok = 0
  let skipped = 0
  let failed = 0
  for (const c of candidates) {
    const result = await importEmbeddedImageProductive(c.id, client)
    results.push({ id: c.id, result })
    if (result.ok && result.code === 'imported') ok += 1
    else if (result.ok && result.code === 'already_imported') skipped += 1
    else if (result.code === 'missing_intent') skipped += 1
    else failed += 1
  }
  return { ok, skipped, failed, results }
}
