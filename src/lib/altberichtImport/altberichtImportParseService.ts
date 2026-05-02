import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import type { AltberichtImportFileRow } from './altberichtImportTypes'
import { extractPdfPlainText } from './extractPdfText'
import { runAltberichtEmbeddedImageScanForFile } from './altberichtImportEmbeddedImageService'
import { runAltberichtRasterAnalysisForFile } from './altberichtRasterFindingsService'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'
import { persistParserResultV1StagingOnly } from './parserPersistV1'
import { parseStructuredAltberichtPlainTextV1 } from './structuredAltberichtParserV1'
import {
  buildParseProgressPayload,
  type AltberichtImportParseStats,
  type AltberichtImportUiProgressCallback,
} from './altberichtImportUiProgress'

const MAX_EXTRACTED_TEXT_DB = 50_000

type StatusFindingsDebugTrace = {
  sequence?: unknown
  blockRawPreview?: unknown
  statusRawAround?: unknown
  statusCandidate?: unknown
  rejectedReason?: unknown
  findingsFilled?: unknown
  statusFindingAccepted?: unknown
  findingsCount?: unknown
}

const shortDebugText = (value: unknown, max = 180): string | null => {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max)}…` : text
}

const readStatusFindingsDebugTrace = (trace: unknown): StatusFindingsDebugTrace | null => {
  if (!trace || typeof trace !== 'object') return null
  const raw = (trace as { statusFindingsDebug?: unknown }).statusFindingsDebug
  if (!raw || typeof raw !== 'object') return null
  return raw as StatusFindingsDebugTrace
}

const buildStatusFindingsDebugPayload = (
  parsed: ReturnType<typeof parseStructuredAltberichtPlainTextV1>
): {
  totalRows: number
  statusCandidatesCount: number
  findingsCreatedCount: number
  statusFoundCount: number
  statusAcceptedCount: number
  statusRejectedCount: number
  findingsFilledCount: number
  examples: Array<{
    sequence: number | null
    blockRawPreview: string | null
    statusCandidate: string | null
    rejectedReason: string | null
    statusRawAround: string | null
    findingsFilled: boolean
    findingsCount: number
  }>
} => {
  let statusFoundCount = 0
  let statusAcceptedCount = 0
  let statusRejectedCount = 0
  let findingsFilledCount = 0
  const examples: Array<{
    sequence: number | null
    blockRawPreview: string | null
    statusCandidate: string | null
    rejectedReason: string | null
    statusRawAround: string | null
    findingsFilled: boolean
    findingsCount: number
  }> = []

  for (const object of parsed.objects) {
    const debug = readStatusFindingsDebugTrace(object.analysisTrace)
    const blockRawPreview = shortDebugText(debug?.blockRawPreview, 260)
    const statusRawAround = shortDebugText(debug?.statusRawAround)
    const statusCandidate = shortDebugText(debug?.statusCandidate)
    const rejectedReason = shortDebugText(debug?.rejectedReason, 80)
    const findingsFilled = Boolean(debug?.findingsFilled) || object.findings.length > 0
    const findingsCount =
      typeof debug?.findingsCount === 'number' ? debug.findingsCount : object.findings.length
    const accepted = Boolean(debug?.statusFindingAccepted)

    if (statusRawAround || statusCandidate) statusFoundCount += 1
    if (accepted) statusAcceptedCount += 1
    if (!accepted && rejectedReason) statusRejectedCount += 1
    if (findingsFilled) findingsFilledCount += 1
    if (examples.length < 12) {
      examples.push({
        sequence: typeof debug?.sequence === 'number' ? debug.sequence : object.sequence,
        blockRawPreview,
        statusCandidate,
        rejectedReason,
        statusRawAround,
        findingsFilled,
        findingsCount,
      })
    }
  }

  return {
    totalRows: parsed.objects.length,
    statusCandidatesCount: statusFoundCount,
    findingsCreatedCount: statusAcceptedCount,
    statusFoundCount,
    statusAcceptedCount,
    statusRejectedCount,
    findingsFilledCount,
    examples,
  }
}

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

export type RunAltberichtImportParseForFileOptions = {
  onProgress?: AltberichtImportUiProgressCallback
  /** 0-basiert bei Parse-Job mit mehreren Dateien */
  parseFileIndex?: number
  parseFileTotal?: number
  /**
   * Bildanalyse-Verhalten:
   *  - 'auto'  → globaler PDF-Operator-Bildscan läuft direkt nach Staging (alt-Verhalten).
   *  - 'skip'  → Bildscan wird übersprungen; Standardmodus zeigt Positionsausschnitt /
   *               Seitenfoto-Fallback. Bildanalyse kann im Expertenmodus on-demand
   *               gestartet werden. **Default**, weil der globale Operator-Scan in
   *               großen PDFs zu Zeitüberschreitungen und falschen Massen-Zuordnungen
   *               führte.
   */
  imageScan?: 'auto' | 'skip'
  /**
   * Raster-Analyse: Status-Mängel und Block-Foto-Stubs werden positionsgenau
   * abgeleitet (6-Blöcke-pro-Seite-Heuristik).
   *  - 'auto' → Standard, läuft direkt nach Staging und schreibt findings_json
   *             additiv (Parser-Findings bleiben unangetastet).
   *  - 'skip' → Raster-Analyse aus, z. B. wenn jemand bewusst nur den C1-Pfad will.
   */
  rasterAnalysis?: 'auto' | 'skip'
}

export type RunAltberichtImportParseForFileResult = {
  error: Error | null
  stats?: AltberichtImportParseStats
}

/**
 * Lädt PDF aus Storage, extrahiert Text, strukturierter Parser → DB:
 * Statusfolge: parsing → parsed (inkl. extracted_text) → staged (nach Staging-Insert).
 */
export const runAltberichtImportParseForFile = async (
  fileId: string,
  client: SupabaseClient = supabase,
  parseOptions: RunAltberichtImportParseForFileOptions = {}
): Promise<RunAltberichtImportParseForFileResult> => {
  const onProgress = parseOptions.onProgress
  const fi = parseOptions.parseFileIndex ?? 0
  const ft = Math.max(1, parseOptions.parseFileTotal ?? 1)
  const report = (phaseIndex: number, statusLine: string, expertDetailLines?: string[]) => {
    onProgress?.(
      buildParseProgressPayload({
        phaseIndex,
        statusLine,
        fileIndex: fi,
        fileTotal: ft,
        expertDetailLines,
      })
    )
  }
  let jobId = ''
  let fileRow: AltberichtImportFileRow | null = null

  try {
    report(1, 'PDF wird geladen …')

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

    report(2, 'Text wird gelesen …')

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

    // pdf.js transferiert ArrayBuffer teilweise an den Worker. Text und Bildscan bekommen getrennte Kopien,
    // damit der nachgelagerte Embedded-Image-Scan nicht auf einem detached Buffer läuft.
    const textBuffer = buf.slice(0)
    const imageScanBuffer = buf.slice(0)

    const plain = await extractPdfPlainText(textBuffer)

    report(3, 'Positionen werden erkannt …', [`${plain.length.toLocaleString('de-DE')} Zeichen extrahiert`])

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
    const statusDebugPayload = buildStatusFindingsDebugPayload(parsed)

    report(4, 'Daten werden vorbereitet …', [`${parsed.objects.length} Positionen erkannt`])

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

    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.PARSER_STATUS_FINDINGS_DEBUG,
      message: 'Status-Mängel-Debug aus Parser erzeugt',
      payloadJson: statusDebugPayload,
    })

    const persistRes = await persistParserResultV1StagingOnly(client, jobId, fileId, parsed)
    if (persistRes.error) {
      await markFileParseFailed(client, fileId, jobId, 'staging_failed', persistRes.error.message)
      return persistRes
    }

    const matchReused = persistRes.matchReusedCount ?? 0
    const expertAfterStaging =
      matchReused > 0 ? [`${matchReused} Zuordnung(en) aus vorherigem Parse wiederverwendet`] : undefined

    /**
     * Phase 4.5: Raster-Analyse (Block-Status-Mängel + Block-Foto-Stubs).
     * Läuft additiv zur staging-Persistenz, ohne C1/C2-Service zu berühren. Eigene
     * try/catch-Insel, damit ein Raster-Fehler den C1-Pfad niemals abreißt.
     */
    const rasterMode = parseOptions.rasterAnalysis ?? 'auto'
    let rasterStats = {
      blockStatusFindingsAdded: 0,
      blockStatusSuspectCount: 0,
      blockCropsRegistered: 0,
      failedPages: [] as number[],
    }
    if (rasterMode === 'auto') {
      try {
        const stagingRes = await client
          .from('altbericht_import_staging_object')
          .select('*')
          .eq('file_id', fileId)
        if (!stagingRes.error) {
          const stagingForFile = (stagingRes.data ?? []) as unknown as AltberichtImportStagingObjectRow[]
          const rasterBuffer = buf.slice(0)
          const totalRows = stagingForFile.length
          const r = await runAltberichtRasterAnalysisForFile(
            client,
            jobId,
            fileId,
            rasterBuffer,
            stagingForFile,
            {
              onProgress: ({ pageNumber, pageTotal, blockIndexOnPage, blockTotal, globalRowIndex }) => {
                const detail =
                  totalRows > 0
                    ? [`Position ${Math.min(globalRowIndex, totalRows)}/${totalRows}`]
                    : undefined
                report(
                  4,
                  `Rasteranalyse … Seite ${pageNumber}/${pageTotal}, Block ${blockIndexOnPage}/${blockTotal}`,
                  detail
                )
              },
              onBlockPhotoProgress: (ev) => {
                const lk = `${ev.globalRowIndex}.${ev.photoIndexInBlock}`
                const blockPair =
                  ev.blocksDone != null && ev.blocksTotal != null && ev.blocksOnPage != null && ev.blockOrdinalOnPage != null
                    ? `Positionsfotoanalyse ${ev.blocksDone}/${ev.blocksTotal} · Seite ${ev.pageNumber}/${ev.pageTotal}, Block ${ev.blockOrdinalOnPage}/${ev.blocksOnPage}`
                    : ev.blocksDone != null && ev.blocksTotal != null
                      ? `Positionsfotoanalyse ${ev.blocksDone}/${ev.blocksTotal} · Seite ${ev.pageNumber}/${ev.pageTotal}`
                      : `Seite ${ev.pageNumber}/${ev.pageTotal}`
                const detail =
                  totalRows > 0
                    ? [`Foto-Schlüssel ${lk} (${ev.photoIndexInBlock}/${ev.photoCountInBlock} im Block)`]
                    : [`Foto-Schlüssel ${lk}`]
                report(
                  4,
                  `Raster … ${blockPair} · Pos.${ev.globalRowIndex} · Foto ${lk}`,
                  detail
                )
              },
            }
          )
          rasterStats = {
            blockStatusFindingsAdded: r.result.blockStatusFindingsAdded,
            blockStatusSuspectCount: r.result.blockStatusSuspectCount,
            blockCropsRegistered: r.result.blockCropsRegistered,
            failedPages: r.result.failedPages,
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        await insertAltberichtImportEvent(client, {
          jobId,
          fileId,
          level: 'warn',
          code: ALTBERICHT_IMPORT_EVENT.RASTER_ANALYSIS_FAILED,
          message: `Rasteranalyse-Phase übersprungen: ${message}`,
          payloadJson: { phase: 'parse_service' },
        })
      }
    } else {
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'info',
        code: ALTBERICHT_IMPORT_EVENT.RASTER_ANALYSIS_DONE,
        message: 'Rasteranalyse übersprungen (rasterAnalysis=skip).',
      })
    }

    const imageScanMode = parseOptions.imageScan ?? 'skip'
    let embedCount = 0

    if (imageScanMode === 'auto') {
      report(5, 'Bilder werden analysiert …', expertAfterStaging)
      const embedRes = await runAltberichtEmbeddedImageScanForFile(client, jobId, fileId, imageScanBuffer, {
        onPageProgress: (pageDone, pageTotal) => {
          const detail =
            matchReused > 0
              ? [`${matchReused} Zuordnung(en) aus vorherigem Parse wiederverwendet`]
              : undefined
          report(5, `Bilder werden analysiert … (Seite ${pageDone}/${pageTotal})`, detail)
        },
      })
      embedCount = embedRes.count
      const embedSummaryLine = embedRes.error
        ? 'Bilder konnten nicht analysiert werden.'
        : embedRes.reused
          ? `${embedRes.count} Bild(er) wiederverwendet (Zuordnungen erhalten)`
          : `${embedRes.count} eingebettete PDF-Bilder per Operator-Scan`
      report(6, 'Import wird abgeschlossen …', [
        `${parsed.objects.length} Positionen`,
        `${rasterStats.blockCropsRegistered} Raster-Foto(s) aus Block-Analyse`,
        embedSummaryLine,
      ])
    } else {
      /**
       * Skip-Pfad: kein globaler Operator-Scan. UI zeigt im Standardmodus den
       * Positionsausschnitt-Fallback (Block-Render aus Geometrie). Im Expertenmodus
       * kann eine Bildanalyse on-demand gestartet werden.
       */
      const rasterSummaryLine =
        rasterStats.blockStatusFindingsAdded > 0
          ? `${rasterStats.blockStatusFindingsAdded} Block-Status-Mangelhinweise (${rasterStats.blockStatusSuspectCount} davon prüfpflichtig)`
          : 'Keine Block-Status-Mängel erkannt'
      report(5, 'Bildanalyse wird übersprungen (Bildanalyse im Expertenmodus optional) …', expertAfterStaging)
      const rasterPhotosLine =
        rasterStats.blockCropsRegistered > 0
          ? `${rasterStats.blockCropsRegistered} Raster-Foto(s) aus Block-Analyse`
          : 'Keine Raster-Fotos registriert (Block-Analyse leer)'
      report(6, 'Import wird abgeschlossen …', [
        `${parsed.objects.length} Positionen`,
        rasterSummaryLine,
        rasterPhotosLine,
        'Operator-Bildanalyse übersprungen (im Expertenmodus startbar)',
      ])
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'info',
        code: 'import.parser.embedded_image_scan_skipped',
        message:
          'Bildscan im Standardmodus übersprungen – auf Wunsch im Expertenmodus startbar.',
      })
    }

    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.PARSER_SUCCEEDED,
      message: 'Parser und Staging erfolgreich',
      payloadJson: { parserVersion: parsed.parserVersion, objectCount: parsed.objects.length },
    })

    return {
      error: null,
      stats: {
        positionCount: parsed.objects.length,
        embeddedImageScanCount: embedCount,
        rasterPositionPhotoCount: rasterStats.blockCropsRegistered,
        matchReusedCount: matchReused,
      },
    }
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
  client: SupabaseClient = supabase,
  options: {
    onProgress?: AltberichtImportUiProgressCallback
    imageScan?: 'auto' | 'skip'
    rasterAnalysis?: 'auto' | 'skip'
  } = {}
): Promise<{ errors: Error[]; stats?: AltberichtImportParseStats }> => {
  const { data: files, error } = await client
    .from('altbericht_import_file')
    .select('id, status')
    .eq('job_id', jobId)
    .order('sequence', { ascending: true })

  if (error || !files?.length) {
    return { errors: error ? [new Error(error.message)] : [] }
  }

  const parseable = files.filter((f) => REPARSEABLE_FILE_STATUS.has(f.status))
  const n = parseable.length
  const errors: Error[] = []
  const stats: AltberichtImportParseStats = {
    positionCount: 0,
    embeddedImageScanCount: 0,
    rasterPositionPhotoCount: 0,
    matchReusedCount: 0,
  }
  let idx = 0
  for (const f of parseable) {
    const r = await runAltberichtImportParseForFile(f.id, client, {
      onProgress: options.onProgress,
      parseFileIndex: idx,
      parseFileTotal: n,
      imageScan: options.imageScan,
      rasterAnalysis: options.rasterAnalysis,
    })
    idx += 1
    if (r.error) errors.push(r.error)
    else if (r.stats) {
      stats.positionCount += r.stats.positionCount
      stats.embeddedImageScanCount += r.stats.embeddedImageScanCount
      stats.rasterPositionPhotoCount += r.stats.rasterPositionPhotoCount
      stats.matchReusedCount += r.stats.matchReusedCount
    }
  }
  return { errors, stats: n > 0 ? stats : undefined }
}
