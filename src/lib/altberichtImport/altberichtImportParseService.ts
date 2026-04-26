import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import type { AltberichtImportFileRow } from './altberichtImportTypes'
import { extractPdfPlainText } from './extractPdfText'
import { runAltberichtEmbeddedImageScanForFile } from './altberichtImportEmbeddedImageService'
import { persistParserResultV1StagingOnly } from './parserPersistV1'
import { parseStructuredAltberichtPlainTextV1 } from './structuredAltberichtParserV1'

const MAX_EXTRACTED_TEXT_DB = 50_000

const PDF_MAGIC = [0x25, 0x50, 0x46, 0x44, 0x2d] as const // %PDF-
const PDF_MAGIC_SCAN_LIMIT = 2048

const findPdfMagicOffset = (bytes: ArrayBuffer, scanLimit = PDF_MAGIC_SCAN_LIMIT): number => {
  const needle = Uint8Array.from(PDF_MAGIC)
  if (bytes.byteLength < needle.length) return -1
  const headerLen = Math.min(bytes.byteLength, scanLimit)
  const a = new Uint8Array(bytes, 0, headerLen)
  const lastStart = headerLen - needle.length
  for (let i = 0; i <= lastStart; i += 1) {
    let hit = true
    for (let j = 0; j < needle.length; j += 1) {
      if (a[i + j] !== needle[j]) {
        hit = false
        break
      }
    }
    if (hit) {
      return i
    }
  }
  return -1
}

const findPdfMagicOffsetAscii = (bytes: ArrayBuffer, scanLimit = PDF_MAGIC_SCAN_LIMIT): number => {
  if (bytes.byteLength < PDF_MAGIC.length) return -1
  const headerLen = Math.min(bytes.byteLength, scanLimit)
  const view = new Uint8Array(bytes, 0, headerLen)
  const s = new TextDecoder('latin1').decode(view)
  return s.indexOf('%PDF-')
}

const findPdfMagicOffsetSafe = (bytes: ArrayBuffer): number => {
  const byteMatch = findPdfMagicOffset(bytes)
  if (byteMatch >= 0) return byteMatch
  return findPdfMagicOffsetAscii(bytes)
}

const isPdfMagicBytes = (bytes: ArrayBuffer): boolean => findPdfMagicOffsetSafe(bytes) >= 0

const toHexPreview = (bytes: ArrayBuffer, count = 16): string => {
  const view = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, count))
  return Array.from(view)
    .map((n) => n.toString(16).padStart(2, '0'))
    .join(' ')
}

const markFileParseFailed = async (
  client: SupabaseClient,
  fileId: string,
  jobId: string,
  code: string,
  message: string
): Promise<void> => {
  await client
    .from('altbericht_import_file')
    .update({
      status: 'parse_failed',
      parse_error_code: code,
      parse_error_message: message,
    })
    .eq('id', fileId)
  await insertAltberichtImportEvent(client, {
    jobId,
    fileId,
    level: 'error',
    code: ALTBERICHT_IMPORT_EVENT.PARSER_FAILED,
    message,
    payloadJson: { code },
  })
}

export type RunAltberichtImportParseForFileResult = { error: Error | null }

/**
 * Lädt PDF aus Storage, extrahiert Text, strukturierter Parser → DB:
 * Statusfolge: parsing → parsed (inkl. extracted_text) → staged (nach Staging-Insert).
 */
export const runAltberichtImportParseForFile = async (
  fileId: string,
  client: SupabaseClient = supabase
): Promise<RunAltberichtImportParseForFileResult> => {
  let jobId = ''
  let fileRow: AltberichtImportFileRow | null = null

  try {
    const { data, error: loadErr } = await client.from('altbericht_import_file').select('*').eq('id', fileId).single()
    if (loadErr || !data) {
      return { error: new Error(loadErr?.message ?? 'Datei nicht gefunden') }
    }
    fileRow = data as unknown as AltberichtImportFileRow
    jobId = fileRow.job_id

    const status = fileRow.status
    /** Inkl. `staged` (Reparse) und `parsing` (hängengebliebener Lauf) */
    if (!['pending', 'parse_failed', 'parsed', 'staged', 'parsing'].includes(status)) {
      return { error: new Error(`Datei hat Status „${status}“, Parsing nicht vorgesehen`) }
    }

    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.PARSER_STARTED,
      message: 'Parser gestartet',
      payloadJson: { originalFilename: fileRow.original_filename },
    })

    const { error: parsingUpdErr } = await client
      .from('altbericht_import_file')
      .update({ status: 'parsing', parse_error_code: null, parse_error_message: null })
      .eq('id', fileId)

    if (parsingUpdErr) {
      return { error: new Error(parsingUpdErr.message) }
    }

    const { data: blob, error: dlErr } = await client.storage
      .from(fileRow.storage_bucket)
      .download(fileRow.storage_path)

    if (dlErr || !blob) {
      const msg = dlErr?.message ?? 'Download fehlgeschlagen'
      await markFileParseFailed(client, fileId, jobId, 'storage_download', msg)
      return { error: new Error(msg) }
    }

    const buf = await blob.arrayBuffer()
    if (!isPdfMagicBytes(buf)) {
      const msg = 'Datei ist kein PDF (Magic Bytes)'
      await markFileParseFailed(client, fileId, jobId, 'not_pdf', msg)
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'warn',
        code: 'import.parser.not_pdf_diagnostics',
        message: 'PDF-Magic-Bytes im Header nicht gefunden',
        payloadJson: {
          scanLimit: PDF_MAGIC_SCAN_LIMIT,
          byteLength: buf.byteLength,
          magicOffset: findPdfMagicOffsetSafe(buf),
          magicOffsetBytes: findPdfMagicOffset(buf),
          magicOffsetAscii: findPdfMagicOffsetAscii(buf),
          blobType: blob.type || null,
          headerHex16: toHexPreview(buf, 16),
        },
      })
      return { error: new Error(msg) }
    }

    const plain = await extractPdfPlainText(buf)

    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.PARSER_TEXT_EXTRACTED,
      message: 'Text extrahiert',
      payloadJson: { charCount: plain.length },
    })

    const parsed = parseStructuredAltberichtPlainTextV1(plain, {
      originalFilename: fileRow.original_filename,
    })

    if (parsed.objects.length === 0) {
      const msg = parsed.warnings[0]?.message ?? 'Keine Parser-Objekte erzeugt'
      await markFileParseFailed(client, fileId, jobId, 'parser_no_objects', msg)
      return { error: new Error(msg) }
    }

    const extractedForDb =
      parsed.extractedText && parsed.extractedText.length > MAX_EXTRACTED_TEXT_DB
        ? `${parsed.extractedText.slice(0, MAX_EXTRACTED_TEXT_DB)}…`
        : parsed.extractedText ?? null

    const { error: parsedUpdErr } = await client
      .from('altbericht_import_file')
      .update({
        status: 'parsed',
        parsed_at: new Date().toISOString(),
        parser_version: parsed.parserVersion,
        extracted_text: extractedForDb,
        parse_error_code: null,
        parse_error_message: null,
      })
      .eq('id', fileId)

    if (parsedUpdErr) {
      await markFileParseFailed(client, fileId, jobId, 'db_parsed_update', parsedUpdErr.message)
      return { error: new Error(parsedUpdErr.message) }
    }

    const persistRes = await persistParserResultV1StagingOnly(client, jobId, fileId, parsed)
    if (persistRes.error) {
      await markFileParseFailed(client, fileId, jobId, 'staging_failed', persistRes.error.message)
      return persistRes
    }

    await runAltberichtEmbeddedImageScanForFile(client, jobId, fileId, buf)

    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.PARSER_SUCCEEDED,
      message: 'Parser und Staging erfolgreich',
      payloadJson: { parserVersion: parsed.parserVersion, objectCount: parsed.objects.length },
    })

    return { error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const j = jobId || fileRow?.job_id
    if (j && fileId) {
      await markFileParseFailed(client, fileId, j, 'parser_exception', message)
    }
    return { error: e instanceof Error ? e : new Error(message) }
  }
}

const REPARSEABLE_FILE_STATUS = new Set<string>([
  'pending',
  'parse_failed',
  'parsed',
  'staged',
  'parsing',
])

/**
 * Linear: alle Dateien eines Jobs nacheinander mit dem aktuellen Parser einlesen.
 * Ersetzt pro Datei Staging-Zeilen wie `persistParserResultV1StagingOnly` (Reparse inkl. bereits gestagter Dateien).
 */
export const runAltberichtImportParseJobSequential = async (
  jobId: string,
  client: SupabaseClient = supabase
): Promise<{ errors: Error[] }> => {
  const { data: files, error } = await client
    .from('altbericht_import_file')
    .select('id, status')
    .eq('job_id', jobId)
    .order('sequence', { ascending: true })

  if (error || !files?.length) {
    return { errors: error ? [new Error(error.message)] : [] }
  }

  const errors: Error[] = []
  for (const f of files) {
    if (!REPARSEABLE_FILE_STATUS.has(f.status)) continue
    const r = await runAltberichtImportParseForFile(f.id, client)
    if (r.error) errors.push(r.error)
  }
  return { errors }
}
