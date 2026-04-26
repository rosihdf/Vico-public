import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import { ALTBERICHT_IMPORT_PDF_BUCKET, altberichtImportOriginalPdfPath } from './storagePaths'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import type { AltberichtImportFileRow, AltberichtImportJobRow, AltberichtImportUploadInputFile } from './altberichtImportTypes'

export type CreateAltberichtImportJobParams = {
  title?: string | null
  notes?: string | null
  analysisMode?: boolean
  /** Wird in altbericht_import_job.parser_version gespeichert (optional). */
  parserVersion?: string | null
}

export type CreateAltberichtImportJobResult = {
  job: AltberichtImportJobRow | null
  error: Error | null
}

/**
 * Legt einen Import-Job an (Status draft).
 */
export const createAltberichtImportJob = async (
  params: CreateAltberichtImportJobParams = {},
  client: SupabaseClient = supabase
): Promise<CreateAltberichtImportJobResult> => {
  const { data: auth } = await client.auth.getUser()
  const createdBy = auth.user?.id ?? null

  const { data, error } = await client
    .from('altbericht_import_job')
    .insert({
      created_by: createdBy,
      status: 'draft',
      analysis_mode: params.analysisMode ?? false,
      title: params.title ?? null,
      notes: params.notes ?? null,
      parser_version: params.parserVersion ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { job: null, error: new Error(error?.message ?? 'Job-Anlage fehlgeschlagen') }
  }

  const job = data as unknown as AltberichtImportJobRow
  await insertAltberichtImportEvent(client, {
    jobId: job.id,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.JOB_CREATED,
    message: 'Import-Job angelegt',
    payloadJson: { title: job.title, analysisMode: job.analysis_mode },
  })

  return { job, error: null }
}

export type UploadPdfsToAltberichtImportJobParams = {
  jobId: string
  files: AltberichtImportUploadInputFile[]
  /** MIME, Standard application/pdf */
  contentType?: string
}

export type UploadPdfsToAltberichtImportJobResult = {
  job: AltberichtImportJobRow | null
  files: AltberichtImportFileRow[]
  error: Error | null
  failedAtIndex: number | null
}

const isProbablyPdf = (name: string): boolean => name.toLowerCase().endsWith('.pdf')

/**
 * Linear: für jede Datei Zeile anlegen → Storage-Upload → Events.
 * Bei Fehler: Job auf failed, Datei-Zeile ggf. entfernt, Abbruch.
 */
export const uploadPdfsToAltberichtImportJob = async (
  params: UploadPdfsToAltberichtImportJobParams,
  client: SupabaseClient = supabase
): Promise<UploadPdfsToAltberichtImportJobResult> => {
  const { jobId, files } = params
  const contentType = params.contentType ?? 'application/pdf'
  const uploaded: AltberichtImportFileRow[] = []

  if (files.length === 0) {
    return { job: null, files: [], error: new Error('Keine Dateien übergeben'), failedAtIndex: null }
  }

  await insertAltberichtImportEvent(client, {
    jobId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.JOB_UPLOADS_STARTED,
    message: 'Upload der PDF-Dateien gestartet',
    payloadJson: { fileCount: files.length },
  })

  const startedAt = new Date().toISOString()
  await client
    .from('altbericht_import_job')
    .update({ status: 'running', started_at: startedAt })
    .eq('id', jobId)

  for (let i = 0; i < files.length; i += 1) {
    const item = files[i]!
    const originalFilename = (item.originalFilename ?? item.file.name).trim() || `datei-${i + 1}.pdf`
    const fileId = crypto.randomUUID()
    const storagePath = altberichtImportOriginalPdfPath(jobId, fileId)
    const sequence = i + 1

    if (!isProbablyPdf(originalFilename)) {
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'warn',
        code: 'import.upload.non_pdf_extension',
        message: 'Dateiname endet nicht auf .pdf',
        payloadJson: { originalFilename },
      })
    }

    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.UPLOAD_STARTED,
      message: `Upload gestartet: ${originalFilename}`,
      payloadJson: { sequence, storagePath },
    })

    const { error: insErr, data: fileRow } = await client
      .from('altbericht_import_file')
      .insert({
        id: fileId,
        job_id: jobId,
        sequence,
        status: 'pending',
        original_filename: originalFilename,
        content_type: item.file.type?.trim() || contentType,
        storage_bucket: ALTBERICHT_IMPORT_PDF_BUCKET,
        storage_path: storagePath,
      })
      .select('*')
      .single()

    if (insErr || !fileRow) {
      const err = new Error(insErr?.message ?? 'Datei-Zeile konnte nicht angelegt werden')
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'error',
        code: ALTBERICHT_IMPORT_EVENT.UPLOAD_FAILED,
        message: err.message,
        payloadJson: { phase: 'db_insert', sequence },
      })
      await client
        .from('altbericht_import_job')
        .update({ status: 'failed', finished_at: new Date().toISOString(), current_file_id: null })
        .eq('id', jobId)
      await insertAltberichtImportEvent(client, {
        jobId,
        level: 'error',
        code: ALTBERICHT_IMPORT_EVENT.JOB_UPLOADS_FAILED,
        message: 'Upload abgebrochen (Datenbank)',
        payloadJson: { failedAtIndex: i },
      })
      return { job: null, files: uploaded, error: err, failedAtIndex: i }
    }

    const { error: upErr } = await client.storage
      .from(ALTBERICHT_IMPORT_PDF_BUCKET)
      .upload(storagePath, item.file, { upsert: false, contentType: item.file.type?.trim() || contentType })

    if (upErr) {
      await client.from('altbericht_import_file').delete().eq('id', fileId)
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'error',
        code: ALTBERICHT_IMPORT_EVENT.UPLOAD_FAILED,
        message: upErr.message,
        payloadJson: { phase: 'storage_upload', sequence },
      })
      await client
        .from('altbericht_import_job')
        .update({ status: 'failed', finished_at: new Date().toISOString(), current_file_id: null })
        .eq('id', jobId)
      await insertAltberichtImportEvent(client, {
        jobId,
        level: 'error',
        code: ALTBERICHT_IMPORT_EVENT.JOB_UPLOADS_FAILED,
        message: 'Upload abgebrochen (Storage)',
        payloadJson: { failedAtIndex: i },
      })
      return { job: null, files: uploaded, error: new Error(upErr.message), failedAtIndex: i }
    }

    const row = fileRow as unknown as AltberichtImportFileRow
    const { data: updatedFile, error: sizeErr } = await client
      .from('altbericht_import_file')
      .update({ byte_size: item.file.size })
      .eq('id', fileId)
      .select('*')
      .single()

    if (!sizeErr && updatedFile) {
      uploaded.push(updatedFile as unknown as AltberichtImportFileRow)
    } else {
      uploaded.push({ ...row, byte_size: item.file.size })
    }

    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.UPLOAD_SUCCEEDED,
      message: `Upload abgeschlossen: ${originalFilename}`,
      payloadJson: { sequence, byteSize: item.file.size, storagePath },
    })

    await client.from('altbericht_import_job').update({ current_file_id: fileId }).eq('id', jobId)
  }

  const finishedAt = new Date().toISOString()
  await client
    .from('altbericht_import_job')
    .update({
      status: 'queued',
      finished_at: finishedAt,
    })
    .eq('id', jobId)

  await insertAltberichtImportEvent(client, {
    jobId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.JOB_UPLOADS_COMPLETED,
    message: 'Alle PDF-Uploads erfolgreich',
    payloadJson: { fileCount: uploaded.length },
  })

  const { data: jobRow } = await client.from('altbericht_import_job').select('*').eq('id', jobId).single()

  return {
    job: jobRow ? (jobRow as unknown as AltberichtImportJobRow) : null,
    files: uploaded,
    error: null,
    failedAtIndex: null,
  }
}

/**
 * Convenience: Job anlegen und alle PDFs linear hochladen.
 */
export const createAltberichtImportJobWithPdfUploads = async (
  jobParams: CreateAltberichtImportJobParams,
  files: AltberichtImportUploadInputFile[],
  client: SupabaseClient = supabase
): Promise<UploadPdfsToAltberichtImportJobResult> => {
  const { job, error: jobErr } = await createAltberichtImportJob(jobParams, client)
  if (jobErr || !job) {
    return {
      job: null,
      files: [],
      error: jobErr ?? new Error('Job-Anlage fehlgeschlagen'),
      failedAtIndex: null,
    }
  }
  return uploadPdfsToAltberichtImportJob({ jobId: job.id, files }, client)
}
