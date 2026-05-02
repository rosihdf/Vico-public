/**
 * Hybrid-Workflow Foto-Übernahme: Eine ganze PDF-Seite als Objektfoto in die Galerie übernehmen.
 *
 * Diese Lösung umgeht den fragilen Embedded-Image-Pfad bewusst: pdf.js rendert die Seite zuverlässig
 * deterministisch, die UI klickt explizit „Seitenfoto übernehmen“. C1/C2-Logik bleibt unberührt.
 *
 * Idempotenz: Best-effort über `caption`-Lookup auf `object_photos`. Caption wird beim Anlegen
 * eindeutig zusammengesetzt aus Dateiname + Seitennummer; die UI ändert sie zwischen Klicks nicht.
 * Wenn Caption manuell geändert wurde, ist ein erneutes Übernehmen kein Datenfehler – nur ein
 * Duplikat in der Galerie, das vom Nutzer entfernt werden kann.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isOnline } from '../../../shared/networkUtils'
import { supabase } from '../../supabase'
import { fetchObject, notifyDataChange, uploadObjectPhoto } from '../dataService'
import {
  ALTBERICHT_PRODUCTIVE_PAGE_SCALE,
  renderAltberichtPdfPageToPngDataUrl,
} from './altberichtPdfPageThumb'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'

const CAPTION_PREFIX = 'Altbericht-Seitenfoto'

const buildPagePhotoCaption = (originalFilename: string, pageNumber: number): string =>
  `${CAPTION_PREFIX} · ${originalFilename} · S. ${pageNumber}`

export type ImportAltberichtPageAsPhotoCode =
  | 'imported'
  | 'already_imported'
  | 'no_object'
  | 'object_archived'
  | 'load_failed'
  | 'render_failed'
  | 'upload_failed'
  | 'not_online'
  | 'invalid_input'

export type ImportAltberichtPageAsPhotoResult = {
  ok: boolean
  code: ImportAltberichtPageAsPhotoCode
  message?: string
  objectPhotoId?: string
  caption?: string
}

const dataUrlToPngFile = async (dataUrl: string, fileName: string): Promise<File> => {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], fileName, { type: 'image/png' })
}

const logFailure = async (
  client: SupabaseClient,
  jobId: string | null,
  fileId: string | null,
  stagingObjectId: string,
  pageNumber: number,
  code: ImportAltberichtPageAsPhotoCode,
  message: string
): Promise<void> => {
  if (!jobId) return
  await insertAltberichtImportEvent(client, {
    jobId,
    fileId,
    stagingObjectId,
    level: 'warn',
    code: ALTBERICHT_IMPORT_EVENT.PAGE_PHOTO_FAILED,
    message: `Seitenfoto-Übernahme fehlgeschlagen (S. ${pageNumber}): ${message}`,
    payloadJson: { pageNumber, failureCode: code, message },
  })
}

export type ImportAltberichtPageAsObjectPhotoParams = {
  stagingObjectId: string
  pageNumber: number
}

/**
 * Übernimmt die übergebene PDF-Seite einer Staging-Zeile als Objektfoto in die Galerie des
 * `committed_object_id`. C1 muss vorher abgeschlossen sein, sonst `no_object`.
 */
export const importAltberichtPageAsObjectPhoto = async (
  params: ImportAltberichtPageAsObjectPhotoParams,
  client: SupabaseClient = supabase
): Promise<ImportAltberichtPageAsPhotoResult> => {
  const { stagingObjectId, pageNumber } = params

  if (typeof window === 'undefined') {
    return { ok: false, code: 'load_failed', message: 'Nur im Browser verfügbar.' }
  }
  if (!isOnline()) {
    return { ok: false, code: 'not_online', message: 'Nur online möglich.' }
  }
  if (!stagingObjectId.trim() || !Number.isFinite(pageNumber) || pageNumber < 1) {
    return { ok: false, code: 'invalid_input', message: 'Ungültige Eingabe.' }
  }
  const safePage = Math.floor(pageNumber)

  const { data: stagingRaw, error: stErr } = await client
    .from('altbericht_import_staging_object')
    .select('id, job_id, file_id, committed_object_id')
    .eq('id', stagingObjectId)
    .maybeSingle()
  if (stErr || !stagingRaw) {
    return {
      ok: false,
      code: 'load_failed',
      message: stErr?.message ?? 'Staging-Zeile nicht gefunden.',
    }
  }
  const staging = stagingRaw as {
    id: string
    job_id: string
    file_id: string
    committed_object_id: string | null
  }
  const objectId = staging.committed_object_id?.trim() ?? null
  if (!objectId) {
    return {
      ok: false,
      code: 'no_object',
      message: 'Objekt zuerst in Stammdaten übernehmen (C1).',
    }
  }

  const { data: fileRaw, error: fErr } = await client
    .from('altbericht_import_file')
    .select('id, job_id, original_filename, storage_bucket, storage_path')
    .eq('id', staging.file_id)
    .maybeSingle()
  if (fErr || !fileRaw) {
    await logFailure(
      client,
      staging.job_id,
      staging.file_id,
      stagingObjectId,
      safePage,
      'load_failed',
      fErr?.message ?? 'Datei nicht gefunden.'
    )
    return {
      ok: false,
      code: 'load_failed',
      message: fErr?.message ?? 'Datei nicht gefunden.',
    }
  }
  const fileRow = fileRaw as {
    id: string
    job_id: string
    original_filename: string
    storage_bucket: string
    storage_path: string
  }

  const obj = await fetchObject(objectId)
  if (!obj) {
    return { ok: false, code: 'no_object', message: 'Zielobjekt existiert nicht.' }
  }
  if (obj.archived_at) {
    return { ok: false, code: 'object_archived', message: 'Zielobjekt ist archiviert.' }
  }

  const caption = buildPagePhotoCaption(fileRow.original_filename, safePage)

  /**
   * Best-effort-Idempotenz: Caption-basierter Lookup. Ohne Schema-Migration die einzige
   * Möglichkeit, doppelte Uploads derselben Seite für dasselbe Objekt zu erkennen.
   */
  const { data: existing, error: exErr } = await client
    .from('object_photos')
    .select('id')
    .eq('object_id', objectId)
    .eq('caption', caption)
    .limit(1)
  if (!exErr && existing && existing.length > 0) {
    const found = existing[0] as { id: string }
    return {
      ok: true,
      code: 'already_imported',
      objectPhotoId: found.id,
      caption,
      message: 'Seitenfoto bereits übernommen.',
    }
  }

  const { data: pdfBlob, error: dlErr } = await supabase.storage
    .from(fileRow.storage_bucket)
    .download(fileRow.storage_path)
  if (dlErr || !pdfBlob) {
    const msg = dlErr?.message ?? 'PDF konnte nicht geladen werden.'
    await logFailure(client, fileRow.job_id, fileRow.id, stagingObjectId, safePage, 'load_failed', msg)
    return { ok: false, code: 'load_failed', message: msg }
  }
  const buf = await pdfBlob.arrayBuffer()

  const dataUrl = await renderAltberichtPdfPageToPngDataUrl(
    buf,
    safePage,
    ALTBERICHT_PRODUCTIVE_PAGE_SCALE
  )
  if (!dataUrl) {
    const msg = `PDF-Seite ${safePage} konnte nicht gerendert werden.`
    await logFailure(client, fileRow.job_id, fileRow.id, stagingObjectId, safePage, 'render_failed', msg)
    return { ok: false, code: 'render_failed', message: msg }
  }

  const fileName = `altbericht-seite-${safePage}.png`
  const file = await dataUrlToPngFile(dataUrl, fileName)

  const up = await uploadObjectPhoto(objectId, file, caption)
  if (up.error || !up.data?.id) {
    const msg = up.error?.message ?? 'Galerie-Upload fehlgeschlagen.'
    await logFailure(client, fileRow.job_id, fileRow.id, stagingObjectId, safePage, 'upload_failed', msg)
    return { ok: false, code: 'upload_failed', message: msg }
  }

  await insertAltberichtImportEvent(client, {
    jobId: fileRow.job_id,
    fileId: fileRow.id,
    stagingObjectId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.PAGE_PHOTO_IMPORTED,
    message: `Seitenfoto S. ${safePage} in Galerie übernommen`,
    payloadJson: {
      objectId,
      objectPhotoId: up.data.id,
      pageNumber: safePage,
      caption,
    },
  })

  notifyDataChange()
  return {
    ok: true,
    code: 'imported',
    objectPhotoId: up.data.id,
    caption,
    message: 'Seitenfoto übernommen.',
  }
}
