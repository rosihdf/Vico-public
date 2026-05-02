/**
 * Browser-Pfad: PDF-Seiten in 6 vertikale Blöcke teilen und je Block den
 * Rohtext einsammeln. Reine Lese-Logik gegen pdf.js — keine DB- und keine
 * Bild-Renderer-Aufrufe.
 *
 * Design-Prinzipien (aus User-Vorgaben):
 * - **Pro Seite eine try/catch-Insel** (eine kaputte Seite blockiert den Rest nicht).
 * - **Pro Block eine eigene Auswertung** — Fehler innerhalb eines Blocks
 *   verfälschen die anderen Blöcke nicht.
 * - **Optionaler `AbortSignal`** + `onProgress(page, block)`-Callback, damit das
 *   UI sichtbar pro Position weiterläuft (statt 75 %-Block).
 * - **Keine Maße aus pdf.js-Worker-Calls** außer `getTextContent`/`getViewport` —
 *   damit kein Operator-Hänger auftritt.
 */

import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import {
  ALTBERICHT_RASTER_BLOCKS_PER_PAGE,
  assignAltberichtRasterBlockIndex,
  computeAllAltberichtRasterBlockBoundsForPage,
  computeAltberichtGlobalRowIndex,
  type AltberichtRasterBlockBounds,
} from './altberichtRasterGrid'

/** pdf.js-Worker einmalig konfigurieren (gleiches Pattern wie extractPdfText). */
let workerConfigured = false
const ensurePdfWorker = (): void => {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  workerConfigured = true
}

export type AltberichtRasterBlockData = AltberichtRasterBlockBounds & {
  /** Seitenbreite in PDF-Punkten (Viewport bei scale 1), für rechten Foto-Spalten in der Raster-Fotoanalyse. */
  pageWidth: number
  /** Konkatenation aller pdf.js-TextItems im Y-Bereich des Blocks (top-down sortiert). */
  rawText: string
  /** Anzahl Text-Items, die in diesen Block fielen. */
  itemCount: number
  /** True, wenn der Block effektiv leer ist (kein nicht-Whitespace-Zeichen). */
  isEmpty: boolean
}

export type AltberichtRasterPageData = {
  pageNumber: number
  pageWidth: number
  pageHeight: number
  blocks: AltberichtRasterBlockData[]
  /** True, wenn pdf.js für diese Seite einen Fehler geworfen hat (Block-Daten fehlen). */
  failed: boolean
  /** Optional: Diagnosetext bei `failed === true`. */
  failedReason?: string
}

export type AltberichtRasterScanProgress = {
  pageNumber: number
  pageTotal: number
  blockIndexOnPage: number
  blockTotal: number
  globalRowIndex: number
}

export type AltberichtRasterScanOptions = {
  /** Wird nach jedem (page, block)-Paar (auch bei leerem Block) gefeuert. */
  onProgress?: (event: AltberichtRasterScanProgress) => void
  /** Wird pro Seite gefeuert, sobald die Seite analysiert ist (egal ob erfolgreich oder fehlgeschlagen). */
  onPageDone?: (pageNumber: number, pageTotal: number) => void
  /** Optional: Caller kann den Scan kooperativ abbrechen. */
  signal?: AbortSignal
  /** Per-Seite-Timeout (Schutz vor pdf.js-Hängern). 0 = aus. Default 30 s. */
  perPageTimeoutMs?: number
}

const DEFAULT_PER_PAGE_TIMEOUT_MS = 30_000

const isAborted = (signal: AbortSignal | undefined): boolean => Boolean(signal?.aborted)

type PdfTextItemRaw = {
  str?: unknown
  transform?: unknown
}

const readBaselineYFromTransform = (transform: unknown): number | null => {
  if (!Array.isArray(transform) || transform.length < 6) return null
  const f = Number(transform[5])
  return Number.isFinite(f) ? f : null
}

const buildEmptyBlocksForPage = (
  pageNumber: number,
  pageHeight: number,
  pageWidth: number
): AltberichtRasterBlockData[] => {
  const bounds = computeAllAltberichtRasterBlockBoundsForPage(pageNumber, pageHeight)
  return bounds.map((b) => ({
    ...b,
    pageWidth,
    rawText: '',
    itemCount: 0,
    isEmpty: true,
  }))
}

const racePageWork = async <T>(
  work: Promise<T>,
  pageNumber: number,
  timeoutMs: number
): Promise<T> => {
  if (timeoutMs <= 0) return work
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Raster-Seite ${pageNumber} (${timeoutMs} ms)`))
    }, timeoutMs)
  })
  try {
    return await Promise.race([work, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

const scanSinglePageBlocks = async (
  doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>,
  pageNumber: number
): Promise<AltberichtRasterPageData> => {
  let page: pdfjs.PDFPageProxy | null = null
  try {
    page = await doc.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const pageWidth = viewport.width
    const pageHeight = viewport.height

    const content = await page.getTextContent()

    /**
     * Ein Block je Index 1..6 mit gesammelten Items in der Reihenfolge oben→unten
     * (PDF-Y absteigend). Das ergibt nach `join(' ')` einen lesbaren Block-Rohtext.
     */
    const buckets: Array<Array<{ text: string; baselineY: number }>> = Array.from(
      { length: ALTBERICHT_RASTER_BLOCKS_PER_PAGE },
      () => []
    )

    for (const raw of content.items as unknown as PdfTextItemRaw[]) {
      if (!raw || typeof raw !== 'object') continue
      const text = typeof raw.str === 'string' ? raw.str : ''
      if (!text) continue
      const baselineY = readBaselineYFromTransform(raw.transform)
      if (baselineY == null) continue
      const blockIdx = assignAltberichtRasterBlockIndex(baselineY, pageHeight)
      buckets[blockIdx - 1]!.push({ text, baselineY })
    }

    const blocks: AltberichtRasterBlockData[] = []
    for (let b = 1; b <= ALTBERICHT_RASTER_BLOCKS_PER_PAGE; b += 1) {
      const items = buckets[b - 1]!
      items.sort((a, c) => c.baselineY - a.baselineY)
      const rawText = items.map((it) => it.text).join(' ').replace(/\s+/g, ' ').trim()
      const bounds = computeAllAltberichtRasterBlockBoundsForPage(pageNumber, pageHeight)[b - 1]!
      blocks.push({
        ...bounds,
        pageWidth,
        rawText,
        itemCount: items.length,
        isEmpty: rawText.length === 0,
      })
    }

    return {
      pageNumber,
      pageWidth,
      pageHeight,
      blocks,
      failed: false,
    }
  } finally {
    try {
      page?.cleanup()
    } catch {
      // pdf.js wirft hier gelegentlich beim Aufräumen — irrelevant für das Ergebnis.
    }
  }
}

/**
 * Liest die ganze PDF Seite-für-Seite ein und liefert pro Seite die 6 Block-Daten.
 * Eine fehlgeschlagene Seite hat `failed: true`, leere Block-Daten und blockiert
 * den Scan **nicht** — alle anderen Seiten werden weiter gelesen.
 */
export const runAltberichtRasterScanForPdf = async (
  pdfBytes: ArrayBuffer,
  options: AltberichtRasterScanOptions = {}
): Promise<{ pages: AltberichtRasterPageData[]; failedPages: number[] }> => {
  if (typeof window === 'undefined') {
    throw new Error('Raster-Scan nur im Browser möglich')
  }
  ensurePdfWorker()
  const data = new Uint8Array(pdfBytes.slice(0))
  const loadingTask = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
  const doc = await loadingTask.promise
  const perPageTimeoutMs = options.perPageTimeoutMs ?? DEFAULT_PER_PAGE_TIMEOUT_MS
  const pages: AltberichtRasterPageData[] = []
  const failedPages: number[] = []

  try {
    for (let p = 1; p <= doc.numPages; p += 1) {
      if (isAborted(options.signal)) break
      let page: AltberichtRasterPageData
      try {
        page = await racePageWork(scanSinglePageBlocks(doc, p), p, perPageTimeoutMs)
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        failedPages.push(p)
        let pageHeight = 842
        let pageWidth = 595
        try {
          const tmp = await doc.getPage(p)
          const vp = tmp.getViewport({ scale: 1 })
          pageHeight = vp.height || 842
          pageWidth = vp.width || 595
          tmp.cleanup()
        } catch {
          // Fallback auf A4
        }
        page = {
          pageNumber: p,
          pageWidth,
          pageHeight,
          blocks: buildEmptyBlocksForPage(p, pageHeight, pageWidth),
          failed: true,
          failedReason: reason,
        }
      }
      pages.push(page)

      for (const block of page.blocks) {
        if (isAborted(options.signal)) break
        options.onProgress?.({
          pageNumber: page.pageNumber,
          pageTotal: doc.numPages,
          blockIndexOnPage: block.blockIndexOnPage,
          blockTotal: ALTBERICHT_RASTER_BLOCKS_PER_PAGE,
          globalRowIndex: block.globalRowIndex,
        })
      }
      options.onPageDone?.(page.pageNumber, doc.numPages)
    }
  } finally {
    void doc.destroy()
  }

  return { pages, failedPages }
}

/**
 * Hilfsfunktion: aus den Per-Seite-Block-Daten einen flachen, sortierten Stream
 * erzeugen — meist die handlichste Form für Persistenz und Tests. Trailing-Empty-
 * Blocks der LETZTEN Seite werden weggeschnitten (User: „leere Blöcke kommen nur
 * am Ende vor"); alle anderen leeren Blöcke bleiben erhalten, damit Diagnose
 * möglich bleibt.
 */
export const flattenAltberichtRasterBlocks = (
  pages: ReadonlyArray<AltberichtRasterPageData>
): AltberichtRasterBlockData[] => {
  const flat: AltberichtRasterBlockData[] = []
  for (const page of pages) flat.push(...page.blocks)

  /**
   * Trailing-Empty-Blocks am Ende des Streams entfernen — typischerweise auf der
   * letzten Seite, wenn z. B. nur 3 von 6 Positionen belegt sind. Verhindert,
   * dass für diese Blöcke globalRowIndex 58/59/60 generiert werden, obwohl es
   * keine Staging-Zeilen gibt.
   */
  let lastNonEmptyIdx = flat.length - 1
  while (lastNonEmptyIdx >= 0 && flat[lastNonEmptyIdx]!.isEmpty) {
    lastNonEmptyIdx -= 1
  }
  return flat.slice(0, lastNonEmptyIdx + 1)
}

/**
 * Zählt die nicht-leeren Blöcke pro Seite (Diagnose, Debug).
 */
export const countAltberichtRasterNonEmptyBlocksPerPage = (
  pages: ReadonlyArray<AltberichtRasterPageData>
): Array<{ pageNumber: number; nonEmpty: number; failed: boolean }> =>
  pages.map((p) => ({
    pageNumber: p.pageNumber,
    nonEmpty: p.blocks.filter((b) => !b.isEmpty).length,
    failed: p.failed,
  }))

/**
 * Aus einem flachen Block-Stream alle Blöcke filtern, die einer existierenden
 * Staging-Zeile entsprechen (matching über `sequence === globalRowIndex`).
 *
 * Reine Lese-Funktion. `stagingRowIdsBySequence` ist üblicherweise eine `Map`,
 * aber jeder kompatible Lookup ist erlaubt (z. B. Plain-Object für Tests).
 */
export const matchAltberichtRasterBlocksToStagingRows = (
  blocks: ReadonlyArray<AltberichtRasterBlockData>,
  stagingRowIdsBySequence: ReadonlyMap<number, string>
): Array<AltberichtRasterBlockData & { stagingRowId: string }> => {
  const out: Array<AltberichtRasterBlockData & { stagingRowId: string }> = []
  for (const block of blocks) {
    const id = stagingRowIdsBySequence.get(block.globalRowIndex)
    if (!id) continue
    out.push({ ...block, stagingRowId: id })
  }
  return out
}

/**
 * Test-Helfer: Block-Index aus Y und pageHeight ableiten (Re-Export der Pure-Function),
 * damit Tests konsistent das Pure-Modul testen können, ohne Implementation zu spiegeln.
 */
export const __testAssignAltberichtRasterBlockIndex = assignAltberichtRasterBlockIndex
export const __testComputeGlobalRowIndex = computeAltberichtGlobalRowIndex
