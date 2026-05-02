/**
 * Erkennung eingebetteter Bilder in PDFs über pdf.js Operatorliste (ohne OCR/CV).
 * Nur Browser (wie extractPdfText).
 *
 * Robustheits-Architektur (siehe Issue „AbortError beim Bildscan"):
 * - **Pro Seite** eine eigene try/catch-Insel. Eine kaputte/hängende Seite
 *   bricht den Gesamtscan nicht ab; alle anderen Seiten werden weiter
 *   gelesen und ihren Staging-Zeilen zugeordnet.
 * - **Pro Bild** werden die Maße zuerst aus der Operator-Argumentliste
 *   gelesen (`paintImageXObject` → `[objId, width, height]`, Inline-/Mask-
 *   Ops → `args[0]` enthält bereits `width/height`). Damit braucht der
 *   Standardpfad gar keinen Worker-Round-Trip mehr.
 * - **`objs.get`** läuft nur noch für die optionale Fingerprint-Heuristik
 *   (Logo-Erkennung) und hat ein hartes Per-Bild-Timeout. Wenn der pdf.js-
 *   Callback nie feuert, wird `null` zurückgegeben und das Bild ohne
 *   Fingerprint übernommen — der Scan hängt dadurch nicht.
 * - **`page.cleanup()`** nach jeder Seite gibt pdf.js-Streams frei und
 *   verhindert kumulative Hänger bei großen PDFs.
 * - **AbortSignal**: optional reinreichbar, wird zwischen Seiten und
 *   zwischen Einzelbildern geprüft (kooperativer Abbruch ohne Exception).
 */
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/** Enthält Logo-/Header-Heuristik + scan_meta_json (Migration Paket G). */
export const ALTBERICHT_PDF_IMAGE_SCAN_VERSION = 'pdfjs_operator_v3_args_first'

let workerConfigured = false

const ensurePdfWorker = (): void => {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  workerConfigured = true
}

export type AltberichtEmbeddedImageScanOpKind =
  | 'paintImageXObject'
  | 'paintInlineImageXObject'
  | 'paintImageMaskXObject'
  | 'paintInlineImageXObjectGroup'
  | 'paintImageMaskXObjectGroup'
  | 'paintImageXObjectRepeat'
  | 'paintImageMaskXObjectRepeat'
  | 'paintSolidColorImageMask'

export type AltberichtEmbeddedImageDraft = {
  pageNumber: number
  imageIndex: number
  opKind: AltberichtEmbeddedImageScanOpKind
}

export type ImagePaintOpsTable = {
  paintImageXObject: number
  paintInlineImageXObject: number
  paintImageMaskXObject: number
  paintInlineImageXObjectGroup: number
  paintImageMaskXObjectGroup: number
  paintImageXObjectRepeat: number
  paintImageMaskXObjectRepeat: number
  paintSolidColorImageMask: number
}

/** Reine Klassifikation (Unit-Tests mit Mock-`OPS` oder `pdfjs.OPS`). */
export const classifyImagePaintOp = (
  fn: number,
  OPS: ImagePaintOpsTable
): AltberichtEmbeddedImageScanOpKind | null => {
  if (fn === OPS.paintImageXObject) return 'paintImageXObject'
  if (fn === OPS.paintInlineImageXObject) return 'paintInlineImageXObject'
  if (fn === OPS.paintImageMaskXObject) return 'paintImageMaskXObject'
  if (fn === OPS.paintInlineImageXObjectGroup) return 'paintInlineImageXObjectGroup'
  if (fn === OPS.paintImageMaskXObjectGroup) return 'paintImageMaskXObjectGroup'
  if (fn === OPS.paintImageXObjectRepeat) return 'paintImageXObjectRepeat'
  if (fn === OPS.paintImageMaskXObjectRepeat) return 'paintImageMaskXObjectRepeat'
  if (fn === OPS.paintSolidColorImageMask) return 'paintSolidColorImageMask'
  return null
}

export const collectEmbeddedImageDraftsFromFnArray = (
  fnArray: number[],
  OPS: ImagePaintOpsTable
): AltberichtEmbeddedImageDraft[] => {
  const out: AltberichtEmbeddedImageDraft[] = []
  let imgOnPage = 0
  for (const fn of fnArray) {
    const kind = classifyImagePaintOp(fn, OPS)
    if (!kind) continue
    out.push({ pageNumber: 0, imageIndex: imgOnPage, opKind: kind })
    imgOnPage += 1
  }
  return out
}

/** Setzt Seitennummer (1-basiert) und fortlaufenden imageIndex pro Seite. */
export const finalizeDraftsPerPage = (
  perPage: AltberichtEmbeddedImageDraft[][]
): AltberichtEmbeddedImageDraft[] => {
  const all: AltberichtEmbeddedImageDraft[] = []
  for (let p = 0; p < perPage.length; p += 1) {
    const pageNum = p + 1
    const list = perPage[p]!
    for (let i = 0; i < list.length; i += 1) {
      all.push({ ...list[i]!, pageNumber: pageNum, imageIndex: i })
    }
  }
  return all
}

export type EmbeddedImageLogoLikelihood = 'none' | 'suspect' | 'likely'

export type AltberichtEmbeddedImageDraftEnriched = AltberichtEmbeddedImageDraft & {
  pageWidth: number
  pageHeight: number
  width: number
  height: number
  fingerprint: string
  logoLikelihood: EmbeddedImageLogoLikelihood
  logoReasons: string[]
}

type PdfJsImageLike = {
  width?: number
  height?: number
  data?: Uint8ClampedArray | Uint8Array
  bitmap?: ImageBitmap
}

type PdfJsPageWithObjects = import('pdfjs-dist').PDFPageProxy & {
  objs?: {
    get?: (objId: string, callback?: (data: unknown) => void) => unknown
  }
}

const isCanvasImageSource = (value: unknown): value is CanvasImageSource => {
  if (typeof window === 'undefined') return false
  return (
    value instanceof HTMLCanvasElement ||
    value instanceof HTMLImageElement ||
    (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap)
  )
}

const DEFAULT_PER_IMAGE_OBJS_TIMEOUT_MS = 2_500

/**
 * Liefert den Inhalt zu einem pdf.js-XObject mit hartem Per-Bild-Timeout.
 * Falls der pdf.js-Callback nicht innerhalb der Frist feuert (Worker-Hänger,
 * defekte Stream-Daten, ...), wird `null` zurückgegeben — der Scan blockiert
 * dadurch nie mehr auf einem einzelnen Bild.
 */
const objectStoreGetWithTimeout = (
  page: import('pdfjs-dist').PDFPageProxy,
  objId: string,
  timeoutMs: number
): Promise<unknown> => {
  const getter = (page as PdfJsPageWithObjects).objs?.get
  if (!getter) return Promise.resolve(null)
  return new Promise((resolve) => {
    let done = false
    const finalize = (data: unknown) => {
      if (done) return
      done = true
      clearTimeout(t)
      resolve(data)
    }
    const t = setTimeout(() => finalize(null), Math.max(50, timeoutMs))
    try {
      const immediate = getter.call(
        (page as PdfJsPageWithObjects).objs,
        objId,
        (data: unknown) => finalize(data)
      )
      if (immediate != null) finalize(immediate)
    } catch {
      finalize(null)
    }
  })
}

const rgbaFromPdfJsImage = (image: PdfJsImageLike): Uint8ClampedArray | null => {
  const width = image.width ?? 0
  const height = image.height ?? 0
  const data = image.data
  if (!width || !height || !data) return null
  const pixelCount = width * height
  if (data.length === pixelCount * 4) return new Uint8ClampedArray(data)
  if (data.length === pixelCount * 3) {
    const rgba = new Uint8ClampedArray(pixelCount * 4)
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      rgba[j] = data[i] ?? 0
      rgba[j + 1] = data[i + 1] ?? 0
      rgba[j + 2] = data[i + 2] ?? 0
      rgba[j + 3] = 255
    }
    return rgba
  }
  if (data.length === pixelCount) {
    const rgba = new Uint8ClampedArray(pixelCount * 4)
    for (let i = 0, j = 0; i < data.length; i += 1, j += 4) {
      const v = data[i] ?? 0
      rgba[j] = v
      rgba[j + 1] = v
      rgba[j + 2] = v
      rgba[j + 3] = 255
    }
    return rgba
  }
  return null
}

const fnv1a32Hex = (bytes: Uint8Array): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= bytes[i]!
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const fingerprintFromRgba = (
  width: number,
  height: number,
  rgba: Uint8ClampedArray
): string => {
  const stepX = Math.max(1, Math.floor(width / 24))
  const stepY = Math.max(1, Math.floor(height / 24))
  const parts: string[] = []
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = (Math.min(y, height - 1) * width + Math.min(x, width - 1)) * 4
      const r = rgba[i] ?? 0
      const g = rgba[i + 1] ?? 0
      const b = rgba[i + 2] ?? 0
      parts.push(String(Math.round((r + g + b) / 3)))
    }
  }
  return fnv1a32Hex(new TextEncoder().encode(parts.join(',')))
}

const fingerprintFromRawImage = async (
  raw: unknown
): Promise<{ w: number; h: number; fp: string }> => {
  const source =
    raw && typeof raw === 'object' && 'bitmap' in raw ? (raw as PdfJsImageLike).bitmap : raw
  if (isCanvasImageSource(source)) {
    const w = 'width' in source ? Number(source.width) : 0
    const h = 'height' in source ? Number(source.height) : 0
    if (!w || !h) return { w: 0, h: 0, fp: '0' }
    const canvas = document.createElement('canvas')
    const tw = Math.min(32, w)
    const th = Math.min(32, h)
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) return { w, h, fp: '0' }
    ctx.drawImage(source, 0, 0, tw, th)
    const d = ctx.getImageData(0, 0, tw, th).data
    return { w, h, fp: fingerprintFromRgba(tw, th, d) }
  }
  if (!raw || typeof raw !== 'object') return { w: 0, h: 0, fp: '0' }
  const image = raw as PdfJsImageLike
  const w = image.width ?? 0
  const h = image.height ?? 0
  const rgba = rgbaFromPdfJsImage(image)
  if (!w || !h || !rgba) return { w: w || 0, h: h || 0, fp: '0' }
  return { w, h, fp: fingerprintFromRgba(w, h, rgba) }
}

/**
 * Heuristik: wiederkehrende/kleine/breite Kopfgrafiken — keine CV, nur Metriken.
 * Export für Unit-Tests.
 */
export const classifyEmbeddedImageLogoLikelihood = (p: {
  width: number
  height: number
  pageWidth: number
  pageHeight: number
  fingerprintPageCount: number
}): { likelihood: EmbeddedImageLogoLikelihood; reasons: string[] } => {
  const reasons: string[] = []
  const w = p.width
  const h = p.height
  if (w <= 0 || h <= 0) return { likelihood: 'none', reasons: [] }

  const pageArea = p.pageWidth * p.pageHeight
  const imgArea = w * h
  const ratio = pageArea > 0 ? imgArea / pageArea : 0
  const maxDim = Math.max(w, h)
  const minDim = Math.min(w, h)

  if (p.fingerprintPageCount >= 2 && ratio < 0.12) {
    reasons.push(`Gleiches Bild auf ${p.fingerprintPageCount} Seiten (typ. Logo/Kopf)`)
    return { likelihood: 'likely', reasons }
  }

  if (ratio < 0.006 && maxDim < 210) {
    reasons.push('Sehr kleine Fläche auf der Seite')
    return { likelihood: 'likely', reasons }
  }

  if (w > h && w / h >= 2.8 && h <= 115 && w >= 90) {
    reasons.push('Sehr breites, flaches Bild (typ. Kopfzeile)')
    return { likelihood: 'likely', reasons }
  }

  if (maxDim <= 56 && imgArea < 5500) {
    reasons.push('Winziges Bild')
    return { likelihood: 'likely', reasons }
  }

  if (p.fingerprintPageCount >= 2 && ratio < 0.22) {
    reasons.push('Wiederholung auf mehreren Seiten (mittlere Größe)')
    return { likelihood: 'suspect', reasons }
  }

  if (ratio < 0.04 && maxDim < 270) {
    reasons.push('Kleine Bildfläche relativ zur Seite')
    return { likelihood: 'suspect', reasons }
  }

  if (maxDim < 72 && imgArea < 16000) {
    reasons.push('Kleine Kantenlänge')
    return { likelihood: 'suspect', reasons }
  }

  if (minDim > 0 && maxDim / minDim >= 4 && minDim <= 95 && maxDim >= 120) {
    reasons.push('Extremer Kantenverhältnis-Streifen')
    return { likelihood: 'suspect', reasons }
  }

  return { likelihood: 'none', reasons: [] }
}

type ScanRough = Omit<AltberichtEmbeddedImageDraftEnriched, 'logoLikelihood' | 'logoReasons'>

type ImageMetricsFromArgs = {
  width: number
  height: number
  inlineImage: PdfJsImageLike | null
  objId: string | null
}

/**
 * Maße direkt aus der pdf.js-Operator-Argumentliste lesen, **ohne** auf den
 * Worker zu warten. Liefert für Inline-/Mask-Ops zusätzlich die rohe `imgData`
 * mit, die direkt für den Fingerprint genutzt werden kann.
 *
 * Operator-Schema (pdf.js evaluator, Stand 2024+):
 * - `paintImageXObject` / `paintImageXObjectRepeat` → `[objId, width, height, ...]`
 * - `paintInlineImageXObject*`, `paintImageMaskXObject*` → `[imgData, ...]`
 *   mit `imgData.width`/`imgData.height` direkt verfügbar.
 */
const deriveMetricsFromArgs = (
  kind: AltberichtEmbeddedImageScanOpKind,
  args: unknown[] | undefined
): ImageMetricsFromArgs => {
  const empty: ImageMetricsFromArgs = { width: 0, height: 0, inlineImage: null, objId: null }
  if (!args || args.length === 0) return empty

  if (kind === 'paintImageXObject' || kind === 'paintImageXObjectRepeat') {
    const objId = typeof args[0] === 'string' ? args[0] : null
    const wRaw = args[1]
    const hRaw = args[2]
    const w =
      typeof wRaw === 'number' && Number.isFinite(wRaw) ? Math.max(0, Math.round(wRaw)) : 0
    const h =
      typeof hRaw === 'number' && Number.isFinite(hRaw) ? Math.max(0, Math.round(hRaw)) : 0
    return { width: w, height: h, inlineImage: null, objId }
  }

  const first = args[0]
  if (first && typeof first === 'object') {
    const obj = first as PdfJsImageLike
    const w =
      typeof obj.width === 'number' && Number.isFinite(obj.width)
        ? Math.max(0, Math.round(obj.width))
        : 0
    const h =
      typeof obj.height === 'number' && Number.isFinite(obj.height)
        ? Math.max(0, Math.round(obj.height))
        : 0
    return { width: w, height: h, inlineImage: obj, objId: null }
  }

  return empty
}

type ScanSinglePageOptions = {
  signal?: AbortSignal
  perImageObjsTimeoutMs: number
  onImageProgress?: (pageNumber: number, imagesOnPage: number) => void
}

const isAbortSignal = (s: AbortSignal | undefined): s is AbortSignal =>
  Boolean(s && s.aborted)

const scanSinglePage = async (
  doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>,
  pageNumber: number,
  OPS: ImagePaintOpsTable,
  rough: ScanRough[],
  options: ScanSinglePageOptions
): Promise<void> => {
  if (isAbortSignal(options.signal)) return
  let page: import('pdfjs-dist').PDFPageProxy | null = null
  try {
    page = await doc.getPage(pageNumber)
    if (isAbortSignal(options.signal)) return
    const viewport = page.getViewport({ scale: 1 })
    const pw = viewport.width
    const ph = viewport.height

    const opList = await page.getOperatorList()
    if (isAbortSignal(options.signal)) return
    const { fnArray, argsArray } = opList

    let seen = 0
    for (let i = 0; i < fnArray.length; i += 1) {
      if (isAbortSignal(options.signal)) return
      const fn = fnArray[i]!
      const kind = classifyImagePaintOp(fn, OPS)
      if (!kind) continue

      const args = argsArray[i] as unknown[] | undefined
      const fromArgs = deriveMetricsFromArgs(kind, args)
      let width = fromArgs.width
      let height = fromArgs.height
      let fingerprint = '0'

      let rawForFp: unknown = fromArgs.inlineImage
      if (!rawForFp && fromArgs.objId) {
        try {
          rawForFp = await objectStoreGetWithTimeout(
            page,
            fromArgs.objId,
            options.perImageObjsTimeoutMs
          )
        } catch {
          rawForFp = null
        }
      }
      if (rawForFp) {
        try {
          const f = await fingerprintFromRawImage(rawForFp)
          fingerprint = f.fp
          if (!width) width = f.w
          if (!height) height = f.h
        } catch {
          // Fingerprint optional — kein Bruchgrund.
        }
      }

      rough.push({
        pageNumber,
        imageIndex: seen,
        opKind: kind,
        pageWidth: pw,
        pageHeight: ph,
        width,
        height,
        fingerprint,
      })
      seen += 1
      options.onImageProgress?.(pageNumber, seen)
    }
  } finally {
    try {
      page?.cleanup()
    } catch {
      // pdf.js wirft hier gelegentlich beim Aufräumen — irrelevant für das Ergebnis.
    }
  }
}

const racePageScan = async (
  work: Promise<void>,
  pageNumber: number,
  timeoutMs: number
): Promise<void> => {
  if (timeoutMs <= 0) return work
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Seite ${pageNumber} (${timeoutMs} ms)`))
    }, timeoutMs)
  })
  try {
    await Promise.race([work, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

export type AltberichtEmbeddedImageScanOptions = {
  /** Hängt eine Seite, wird sie nach diesem Limit übersprungen; restliche Seiten laufen weiter. */
  perPageTimeoutMs?: number
  /**
   * Hartes Per-Bild-Timeout für `objs.get` (Fingerprint-/Logo-Heuristik).
   * Default 2 500 ms — schnell genug, dass ein einzelnes Problembild nie eine Seite blockiert.
   */
  perImageObjsTimeoutMs?: number
  /** Wird pro übersprungener Seite aufgerufen (z. B. für Event-Logs). */
  onPageWarning?: (pageNumber: number, message: string) => void
  /**
   * Wird nach jeder bearbeiteten Seite (erfolgreich oder übersprungen) gefeuert.
   * Damit kann das UI Fortschritt pro Seite anzeigen, statt einen 75 %-Block zu halten.
   */
  onPageProgress?: (pageDone: number, pageTotal: number) => void
  /**
   * Wird nach jedem erfolgreich gemessenen Bild auf einer Seite gefeuert
   * (kumuliert pro Seite). Erlaubt Live-Diagnose im Expertenmodus.
   */
  onImageProgress?: (pageNumber: number, imagesOnPage: number) => void
  /** Optional: erlaubt dem Aufrufer, den Scan kooperativ abzubrechen. */
  signal?: AbortSignal
}

/**
 * Scan mit Pixelmaßen, Fingerprint und Logo-Einstufung (pdf.js, nur Browser).
 * Pro-Seite-Timeout: einzelne hängende Seite wird übersprungen, restliche Seiten werden weiter gescannt.
 */
export const scanAltberichtPdfForEmbeddedImagesEnriched = async (
  pdfBytes: ArrayBuffer,
  options: AltberichtEmbeddedImageScanOptions = {}
): Promise<AltberichtEmbeddedImageDraftEnriched[]> => {
  if (typeof window === 'undefined') {
    throw new Error('PDF-Bildscan nur im Browser möglich')
  }
  ensurePdfWorker()
  const data = new Uint8Array(pdfBytes.slice(0))
  const loadingTask = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
  const doc = await loadingTask.promise
  const OPS = pdfjs.OPS as ImagePaintOpsTable
  const rough: ScanRough[] = []
  const perPageTimeoutMs = options.perPageTimeoutMs ?? 0
  const perImageObjsTimeoutMs =
    options.perImageObjsTimeoutMs ?? DEFAULT_PER_IMAGE_OBJS_TIMEOUT_MS
  try {
    for (let p = 1; p <= doc.numPages; p += 1) {
      if (isAbortSignal(options.signal)) break
      try {
        await racePageScan(
          scanSinglePage(doc, p, OPS, rough, {
            signal: options.signal,
            perImageObjsTimeoutMs,
            onImageProgress: options.onImageProgress,
          }),
          p,
          perPageTimeoutMs
        )
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        options.onPageWarning?.(p, message)
      } finally {
        options.onPageProgress?.(p, doc.numPages)
      }
    }
  } finally {
    void doc.destroy()
  }

  const fpToPages = new Map<string, Set<number>>()
  for (const r of rough) {
    if (r.fingerprint === '0') continue
    if (!fpToPages.has(r.fingerprint)) fpToPages.set(r.fingerprint, new Set())
    fpToPages.get(r.fingerprint)!.add(r.pageNumber)
  }

  return rough.map((r) => {
    const pageCount =
      r.fingerprint === '0' ? 1 : (fpToPages.get(r.fingerprint)?.size ?? 1)
    const { likelihood, reasons } = classifyEmbeddedImageLogoLikelihood({
      width: r.width,
      height: r.height,
      pageWidth: r.pageWidth,
      pageHeight: r.pageHeight,
      fingerprintPageCount: pageCount,
    })
    return {
      ...r,
      logoLikelihood: likelihood,
      logoReasons: reasons,
    }
  })
}

/**
 * Liefert pro eingebettetem Bild-Zeichenbefehl eine Zeile (Seite, Index, OP-Art).
 * Entspricht den Daten des erweiterten Scans ohne Metadaten (Abwärtskompatibilität).
 */
export const scanAltberichtPdfForEmbeddedImages = async (
  pdfBytes: ArrayBuffer
): Promise<AltberichtEmbeddedImageDraft[]> => {
  const enriched = await scanAltberichtPdfForEmbeddedImagesEnriched(pdfBytes)
  return enriched.map(({ pageNumber, imageIndex, opKind }) => ({
    pageNumber,
    imageIndex,
    opKind,
  }))
}

/**
 * Test-Helfer: kapselt die Pure-Function `deriveMetricsFromArgs`, damit
 * Unit-Tests die Args-First-Logik direkt prüfen können.
 */
export const __testDeriveMetricsFromArgs = deriveMetricsFromArgs
