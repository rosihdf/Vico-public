/**
 * Raster-Block-Fotos: Rendert die rechte Foto-Spalte eines Positionsbands,
 * segmentiert vertikal nach Tinten-Zeilen, splittet horizontal nach Weiß-Spalten,
 * persistiert wiederholbare viewport-Pixel-Rechtecke in `scan_meta_json`.
 */

import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import {
  ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP,
  ALTBERICHT_RASTER_SCAN_VERSION,
  computeAltberichtRasterRawCropImageIndex,
  computeAltberichtRasterImageIndex,
  formatAltberichtLogicalPhotoKey,
} from './altberichtRasterGrid'
import type { AltberichtRasterBlockData } from './altberichtRasterScan'
import { releaseTransientCanvas } from './altberichtPdfPageThumb'

/** Wiederverwendet für erneutes Render und identische Crops in Vorschau und Übernahme. */
export const ALTBERICHT_RASTER_VIEWPORT_SCALE = 1.35

/**
 * Fotospalte linker Rand in PDF-User-Koordinaten (Anteil der Seitenbreite vom linken Rand).
 * Vgl. gerenderte WEG-Vorlage: Foto häufig ab ~½ Seitenbreite — leicht linker, damit Türfotos nicht abgeschnitten werden.
 */
export const ALTBERICHT_RASTER_PHOTO_ZONE_LEFT_FRAC = 0.475

/** Rechter Rand leicht nach innen schieben (Tabellen-/Seitenkante ohne volle Außenlinie). */
export const ALTBERICHT_RASTER_PHOTO_ZONE_RIGHT_INSET_FRAC = 0.014

/**
 * Unterer Anteil eines Positionsbands, der beim Streifen-Clipping verworfen wird
 * — reduziert rote Statuszeilen am Blockfuß.
 */
/** Deutlicher als zuvor: Status-/Rotzeile typ. im unteren Block-Anteil liegen soll rausgeschoren werden. */
export const ALTBERICHT_RASTER_PHOTO_BLOCK_BOTTOM_SHAVE_FRAC = 0.14

/** @deprecated Alte Konstante (Breite rechts); Layout nutzt {@link ALTBERICHT_RASTER_PHOTO_ZONE_LEFT_FRAC}. */
export const ALTBERICHT_RASTER_PHOTO_RIGHT_STRIP_FRAC = 0.38

let workerConfigured = false
const ensurePdfWorker = (): void => {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  workerConfigured = true
}

export type AltberichtRasterPhotoCropViewportPx = {
  sx: number
  sy: number
  sw: number
  sh: number
}

export type RasterBlockPhotoProgressEvent = {
  pageNumber: number
  pageTotal: number
  blockIndexOnPage: number
  globalRowIndex: number
  photoIndexInBlock: number
  photoCountInBlock: number
  /** Fortschritt über alle nicht-leeren Blöcke des Jobs (für Hintergrund-Lauf / UI). */
  blocksDone?: number
  blocksTotal?: number
  /** Blöcke auf dieser PDF-Seite (nicht leer). */
  blocksOnPage?: number
  /** Laufende Nummer auf der Seite (1-basiert). */
  blockOrdinalOnPage?: number
}

/** Max. Geometrie-/Zonen-Versuche pro Positionsblock (kein Endloslauf). */
export const ALTBERICHT_RASTER_MAX_BLOCK_ANALYSIS_ATTEMPTS = 3 as const

const RASTER_ZONE_LEFT_FRAC_ATTEMPTS: readonly number[] = [
  ALTBERICHT_RASTER_PHOTO_ZONE_LEFT_FRAC,
  0.432,
  0.518,
]

export type RasterPhotoBlockQualityStatus =
  | 'ok'
  | 'needs_review'
  | 'fallback_used'
  | 'failed'

const rasterAttemptRowsAcceptable = (rows: readonly AltberichtRasterPhotoInsertPayload[]): boolean => {
  if (rows.length === 0) return false
  /** Echtes Segment (nicht Nur-Positionsplatte): Versuch gilt als gut genug, keine weitere Rasterzone nötig. */
  const hasSegmentSubtype = rows.some((r) => {
    const m = r.scan_meta_json as
      | { forcedBlockFallback?: unknown; subtype?: unknown }
      | null
      | undefined
    if (!m || typeof m !== 'object') return false
    if (m.forcedBlockFallback) return false
    const st = m.subtype
    return st === 'segment' || st === 'strip_fallback'
  })
  /** Mindestens ein Kandidat, der keine reine »Notfall-platte« ist */
  const hasNonForcedPlate = rows.some((r) => {
    const m = r.scan_meta_json
    if (!m || typeof m !== 'object') return true
    const forced = Boolean((m as { forcedBlockFallback?: unknown }).forcedBlockFallback)
    return !forced
  })
  return hasSegmentSubtype || hasNonForcedPlate
}

const deriveQualityStatusFromRows = (
  rows: readonly AltberichtRasterPhotoInsertPayload[]
): RasterPhotoBlockQualityStatus => {
  if (rows.length === 0) return 'failed'
  const anyFallback = rows.some((r) => {
    const m = r.scan_meta_json
    return Boolean(m && typeof m === 'object' && (m as { forcedBlockFallback?: unknown }).forcedBlockFallback)
  })
  if (anyFallback) return 'fallback_used'
  const anyWeak = rows.some((r) => {
    const m = r.scan_meta_json
    return Boolean(m && typeof m === 'object' && (m as { lowConfidence?: unknown }).lowConfidence)
  })
  if (anyWeak) return 'needs_review'
  return 'ok'
}

const enrichSegmentRowsWithBlockMeta = (
  rows: AltberichtRasterPhotoInsertPayload[],
  meta: {
    attemptCount: number
    blockAnalysisFinalStatus: RasterPhotoBlockQualityStatus
    qualityStatus: RasterPhotoBlockQualityStatus
  }
): AltberichtRasterPhotoInsertPayload[] =>
  rows.map((r) => ({
    ...r,
    scan_meta_json: {
      ...r.scan_meta_json,
      rasterSource: 'block_crop',
      attemptCount: meta.attemptCount,
      blockAnalysisFinalStatus: meta.blockAnalysisFinalStatus,
      qualityStatus: meta.qualityStatus,
    },
  }))

export type AltberichtRasterPhotoInsertPayload = {
  job_id: string
  file_id: string
  page_number: number
  image_index: number
  scan_version: string
  op_kind: string
  suggested_staging_object_id: string
  linked_staging_object_id: null
  user_intent: 'unreviewed'
  preview_storage_path: null
  scan_meta_json: Record<string, unknown>
}

const LUM_CEIL = 246
const ROW_INK = 0.012
/** Kleinere vertikale Einheiten zulassen (mehr echte Fotos, weiterhin durch Semantik-/Textur-Gates gefiltert). */
const MIN_VERT_SEG_PX = 34

/** Weißraum-Trim: Pixel gelten als „Hintergrund“, wenn alle RGB-Kanäle ≥ Schwelle. */
export const RASTER_CROP_TRIM_WHITE_RGB = 240

const RASTER_CROP_TRIM_PAD_PX = 2
/** Schranken nach Innen-Zuschnitt (vor finalem Pixel-Gate beim Speichern). */
const RASTER_REFINE_MIN_EDGE_AFTER_TRIM = 22
const RASTER_REFINE_MIN_AREA_AFTER_TRIM = 560

const RASTER_CROP_MIN_AREA_VS_SEGMENT = 0.08
const RASTER_CROP_MIN_CONTENT_FILL = 0.56

/** Nach Trim: zu viel Weiß → verwerfen (Anteil Pixel die „weiß“ sind). */
const RASTER_CROP_MAX_WHITE_FRAC_AFTER_TRIM = 0.4

/** Mindest-Kante für „starke“ Segment-Crops (Detail-/Türfotos oft kleiner → Review-/Weak-Pfad). */
const RASTER_FINAL_MIN_W = 42
const RASTER_FINAL_MIN_H = 42
const RASTER_FINAL_MIN_AREA = RASTER_FINAL_MIN_W * RASTER_FINAL_MIN_H

/** Schwache Segmente / zweite Reihe neben starken Kandidaten. */
const RASTER_WEAK_MIN_W = 26
const RASTER_WEAK_MIN_H = 26
const RASTER_WEAK_MIN_AREA = RASTER_WEAK_MIN_W * RASTER_WEAK_MIN_H

/** Review-Tier: minimal behalten wenn Bildtextur plausibel (needs_review). */
const RASTER_REVIEW_MIN_W = 24
const RASTER_REVIEW_MIN_H = 24
const RASTER_REVIEW_MIN_AREA = RASTER_REVIEW_MIN_W * RASTER_REVIEW_MIN_H

/** Unterhalb: kaum Helligkeitsstreuung ⇒ eher Tabellenfläche als Foto. */
const RASTER_MIN_LUMINANCE_VARIANCE_FOR_REVIEW = 38
const RASTER_MIN_LUMINANCE_VARIANCE_WIDE_DETAILS = 72

/**
 * Breite flache Platten (typ. Statuszeile / Tabellenzeile): \(w/h\) groß.
 * Hochformat \(h \gg w\) (Tür u. Ä.) wird separat über die Nadel-Schwelle entschieden – nicht mehr symmetrisch mit \(h/w \le\) … ablehnen.
 */
const RASTER_REJECT_WIDE_PLATE_WH = 4

/**
 * Extrem hohe schmale Streifen ohne useful Breite (\(w\) klein) – keine typischen Hochformat-Fotos.
 */
const RASTER_REJECT_TALL_SLIVER_HW = 20
/** Oberhalb dieser Breiten gelten sehr hohe Rechtecke als Porträt, nicht als Nadelstreifen. */
const RASTER_TALL_NEEDLE_MAX_W = 44

/** Dünne horizontale Linie/Tabelle: sehr wenig Höhe bei großem Verhältnis. */
const RASTER_LINE_MAX_H_PX = 24
const RASTER_LINE_MIN_WH_RATIO = 10

/** Roter Statustext: R dominiert, G/B gedämpft. */
const RASTER_STATUS_RED_R_MIN = 150
const RASTER_STATUS_RED_G_MAX = 100
const RASTER_STATUS_RED_B_MAX = 100

/** Anteil Rot-Status unter allen Pixeln / unter Nichtweiß – nur in Kombination mit breiter Platte, Linienform oder kompakter Fläche (s. shouldRejectRasterSemanticsOnly). */
const RASTER_REJECT_RED_FRAC_TOTAL = 0.068
const RASTER_REJECT_RED_FRAC_NONWHITE = 0.36

/** Flächen bis hier: rote Dominanz gilt auch ohne breite Platte (kleine Status-/Hinweiseblöcke). */
const RASTER_RED_SEM_COMPACT_AREA_PX = 42000

/** Oberer Kopf („komplett Putz“, rote Hinweisausgabe): obersten Anteil separat messen. */
const RASTER_TOP_BAND_FRAC_FOR_RED = 0.2
const RASTER_REJECT_TOP_BAND_RED_RATIO = 0.055

/** Unterer Blockrand: rote Status-/Fußzeilen (PDF), gleiche Logik wie oben. */
const RASTER_BOTTOM_BAND_FRAC_FOR_RED = 0.18
const RASTER_REJECT_BOTTOM_BAND_RED_RATIO = 0.052

/**
 * Rot unter Nicht-Weiß im Kopf-/Fußband: auch bei großen Crops (ohne redDominanceContext)
 * Statusstreifen erkennen — sonst bleiben z. B. Foto+rot oben als „ok“.
 */
const RASTER_REJECT_BAND_MIN_NONWHITE = 24
const RASTER_REJECT_BAND_RED_IN_NONWHITE_TOP = 0.31
const RASTER_REJECT_BAND_RED_IN_NONWHITE_BOTTOM = 0.28

/** Extrem-Verhältnis (\(\max(w/h,h/w)\)): leicht erhöht für schmale Hochporträt-Fotos (Tür). */
const RASTER_MAX_ASPECT_EXTREME = 22

/** Fallback-Positionsausschnitt: vertikaler Abstand relativ zur Segment-/Streifen-Höhe (Tabellenköpfe unten mehr abschneiden). */
const FALLBACK_SEGMENT_TOP_PAD_FRAC = 0.07
const FALLBACK_SEGMENT_BOTTOM_PAD_FRAC = 0.13

/**
 * Innerer Arbeitsbereich vor BBox-Anker (\(10\%/16\%\) des Bands) –
 * kopf-/statusferner als nur „Segment-Padding“ allein.
 */
const FALLBACK_INNER_BAND_TOP_FRAC = 0.1
const FALLBACK_INNER_BAND_BOTTOM_FRAC = 0.16

/** Bounding-Box-Anker: Rand um non-white relativ zur Streifengröße. */
const FALLBACK_INK_CLUSTER_PAD_SCALE = 0.045

/**
 * Nimmt gefülltes Rechteck ≈ gesamtes Suchfenster ⇒ kein eigener Bio-Anker
 * („breiter Platten“-Fallback, Review).
 */
const FALLBACK_WIDE_PLATE_INNER_AREA_FRAC = 0.67

/** Positionsausschnitt strikt: Tabellenkopf / volle Platte vermeiden. */
const POSITIONS_FALLBACK_MAX_INNER_COVER_FRAC = 0.58
const POSITIONS_FALLBACK_MIN_INNER_COVER_FRAC = 0.012
const POSITIONS_FALLBACK_MIN_NONWHITE_DENSITY = 0.048
const POSITIONS_FALLBACK_MAX_WHITE_FRAC = 0.52

/** Gelockertes Gate für needs_review-Positionsausschnitte (weiterhin keine fast-Vollfläche ohne Textur). */
const POSITIONS_FALLBACK_REVIEW_MAX_INNER_COVER_FRAC = 0.74
const POSITIONS_FALLBACK_REVIEW_MIN_INNER_COVER_FRAC = 0.004
const POSITIONS_FALLBACK_REVIEW_MIN_NONWHITE_DENSITY = 0.022
const POSITIONS_FALLBACK_REVIEW_MAX_WHITE_FRAC = 0.58

/** Horizontale Foto-Trennung: nur bei ausreichend breitem weißen Spalt (weniger Fragmentierung). */
const COL_GAP_MAX_INK_FRAC = 0.032
/** Etwas feinere horizontale Trennung (nebeneinanderliegende kleine Fotos / Mini-Inseln). */
const MIN_GAP_COLUMNS = 10
const MIN_HORIZ_REGION_PX = 34

/** Nachbarschafts-Merge vertikaler Segmente (kleine Lücken = ein Foto, keine Teilfragmente). */
const VERT_SEGMENT_MERGE_MAX_GAP_PX = 14
const VERT_SEGMENT_MERGE_HEIGHT_RATIO_MIN = 0.34

/** Max. echte block_crop-Zeilen pro Positionsblock (Fragmente vermeiden; fachlich meist 2–3). */
const RASTER_BLOCK_MAX_PHOTOS_PER_BLOCK = 4

/** Fragment-Erkennung: sehr kleine Fläche nur bei plausibler Fototextur behalten. */
const RASTER_FRAGMENT_DROP_AREA_WEAK_REVIEW = 2350
const RASTER_FRAGMENT_TEXTURE_MIN_KEEP_SMALL = 95
const RASTER_FRAGMENT_WIDE_EMPTY_WHITE_FRAC = 0.59

/** IoU: überlappende/alternative Teil-Crops zusammenfallen lassen. */
const RASTER_BLOCK_IOU_MERGE_THRESHOLD = 0.44

const isRasterWidePlateWOverH = (rw: number, rh: number): boolean =>
  rw >= rh * RASTER_REJECT_WIDE_PLATE_WH

const isRasterTallNeedleSliver = (rw: number, rh: number): boolean =>
  rw <= RASTER_TALL_NEEDLE_MAX_W && rh >= rw * RASTER_REJECT_TALL_SLIVER_HW

const isRgbWhiteForTrim = (data: Uint8ClampedArray, pxBase: number, whiteRgb: number): boolean => {
  const r = data[pxBase] ?? 255
  const g = data[pxBase + 1] ?? 255
  const b = data[pxBase + 2] ?? 255
  return r >= whiteRgb && g >= whiteRgb && b >= whiteRgb
}

const pixelNonWhiteForTrim = (
  data: Uint8ClampedArray,
  stripW: number,
  x: number,
  y: number,
  whiteRgb: number
): boolean => {
  const i = (y * stripW + x) * 4
  return !isRgbWhiteForTrim(data, i, whiteRgb)
}

/**
 * Bounding Box alle Pixel, bei denen nicht alle RGB ≥ whiteRgb (innenhalb des Teilrechtecks).
 * Koordinaten in Strip-Pixelkoordinaten; `y` absolut 0..stripH-1.
 */
export const computeNonWhiteBoundingBoxInRect = (
  data: Uint8ClampedArray,
  stripW: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  whiteRgb: number = RASTER_CROP_TRIM_WHITE_RGB
): { minX: number; maxX: number; minY: number; maxY: number } | null => {
  if (rw < 1 || rh < 1) return null
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let found = false
  const xe = Math.min(x0 + rw, stripW)
  const xStart = Math.max(0, x0)
  for (let y = y0; y < y0 + rh; y += 1) {
    if (y < 0) continue
    for (let x = xStart; x < xe; x += 1) {
      if (pixelNonWhiteForTrim(data, stripW, x, y, whiteRgb)) {
        found = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (!found || !Number.isFinite(minX)) return null
  return { minX, maxX, minY, maxY }
}

const rowHasNonWhite = (
  data: Uint8ClampedArray,
  stripW: number,
  x0: number,
  rw: number,
  y: number,
  whiteRgb: number
): boolean => {
  const xe = Math.min(x0 + rw, stripW)
  const xStart = Math.max(0, x0)
  for (let x = xStart; x < xe; x += 1) {
    if (pixelNonWhiteForTrim(data, stripW, x, y, whiteRgb)) return true
  }
  return false
}

const countNonWhiteInRect = (
  data: Uint8ClampedArray,
  stripW: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  whiteRgb: number
): number => {
  let n = 0
  const xe = x0 + rw
  const ye = y0 + rh
  for (let y = y0; y < ye; y += 1) {
    for (let x = x0; x < xe; x += 1) {
      if (pixelNonWhiteForTrim(data, stripW, x, y, whiteRgb)) n += 1
    }
  }
  return n
}

/** Anteil weiß-trim-Barer Pixel in Rechteck (0–1); hoher Wert = viel weißer Hintergrund */
const rectWhiteFrac = (
  data: Uint8ClampedArray,
  stripW: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  whiteRgb: number
): number => {
  if (w < 1 || h < 1) return 1
  const nk = countNonWhiteInRect(data, stripW, x0, y0, w, h, whiteRgb)
  const area = w * h
  return area > 0 ? 1 - nk / area : 1
}

const contentFillRatio = (
  data: Uint8ClampedArray,
  stripW: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  whiteRgb: number
): number => {
  const rw = maxX - minX + 1
  const rh = maxY - minY + 1
  if (rw < 1 || rh < 1) return 0
  const ink = countNonWhiteInRect(data, stripW, minX, minY, rw, rh, whiteRgb)
  return ink / (rw * rh)
}

/**
 * Grobe luminanzbezogene Streuung im Crop (hoch bei Fototextur, niedrig bei homogenem Tabellenfeld).
 * Gleichmäßiges Gittersampling, rechenarm für Edge-Kontext.
 */
const rasterRegionLuminanceVariance = (
  data: Uint8ClampedArray,
  stripW: number,
  stripH: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): number => {
  const xs = Math.max(0, Math.floor(bx))
  const ys = Math.max(0, Math.floor(by))
  const iw = Math.max(1, Math.floor(bw))
  const ih = Math.max(1, Math.floor(bh))
  const step = Math.max(1, Math.floor(Math.min(iw, ih) / 14))
  let sum = 0
  let sumSq = 0
  let n = 0
  const xe = Math.min(xs + iw, stripW)
  const ye = Math.min(ys + ih, stripH)
  for (let y = ys; y < ye && n < 520; y += step) {
    for (let x = xs; x < xe && n < 520; x += step) {
      const i = (y * stripW + x) * 4
      const lum = ((data[i] ?? 0) * 299 + (data[i + 1] ?? 0) * 587 + (data[i + 2] ?? 0) * 114) / 1000
      sum += lum
      sumSq += lum * lum
      n += 1
    }
  }
  if (n < 10) return 0
  const mean = sum / n
  return Math.max(0, sumSq / n - mean * mean)
}

const clampAndPadBBox = (
  bb: { minX: number; maxX: number; minY: number; maxY: number },
  pad: number,
  xClipMin: number,
  xClipMax: number,
  yMin: number,
  yMax: number
): { minX: number; maxX: number; minY: number; maxY: number } => {
  const minX = Math.max(xClipMin, bb.minX - pad)
  const maxX = Math.min(xClipMax, bb.maxX + pad)
  const minY = Math.max(yMin, bb.minY - pad)
  const maxY = Math.min(yMax, bb.maxY + pad)
  return { minX, maxX, minY, maxY }
}

type FallbackInkBBoxResult = {
  tight: { x: number; y: number; w: number; h: number }
  isWidePlate: boolean
}

/**
 * Sucht einen non-white Bounding-Box-Anker innerhalb eines schon vertikal gekappten Rechtecks
 * (Fallback nur um sichtbare Bildecke statt gesamtem Streifen).
 */
const pickFromFallbackInkBBox = (
  rgba: Uint8ClampedArray,
  stripW: number,
  stripH: number,
  xClipMin: number,
  xClipMaxIncl: number,
  innerYs: number,
  innerYeExclusive: number,
  whiteRgb: number = RASTER_CROP_TRIM_WHITE_RGB
): FallbackInkBBoxResult | null => {
  const cw = Math.max(1, xClipMaxIncl - xClipMin + 1)
  const ch = Math.max(1, innerYeExclusive - innerYs)
  const bb = computeNonWhiteBoundingBoxInRect(rgba, stripW, xClipMin, innerYs, cw, ch, whiteRgb)
  if (!bb) return null
  const pad = Math.max(
    RASTER_CROP_TRIM_PAD_PX + 4,
    Math.floor(Math.min(stripW, innerYeExclusive) * FALLBACK_INK_CLUSTER_PAD_SCALE)
  )
  const yMaxClamp = innerYeExclusive - 1
  const padded = clampAndPadBBox(bb, pad, xClipMin, xClipMaxIncl, innerYs, yMaxClamp)
  const tw = padded.maxX - padded.minX + 1
  const th = padded.maxY - padded.minY + 1
  if (tw < RASTER_WEAK_MIN_W || th < RASTER_WEAK_MIN_H) return null
  if (th <= RASTER_LINE_MAX_H_PX + 6 && tw >= th * Math.max(6, RASTER_LINE_MIN_WH_RATIO - 2)) return null
  const fill = contentFillRatio(rgba, stripW, padded.minX, padded.minY, padded.maxX, padded.maxY, whiteRgb)
  if (fill < 0.034) return null
  const innerArea = cw * ch
  const pickArea = tw * th
  const coverFrac = pickArea / innerArea
  const isWidePlate = pickArea >= innerArea * FALLBACK_WIDE_PLATE_INNER_AREA_FRAC
  const textureVar = rasterRegionLuminanceVariance(rgba, stripW, stripH, padded.minX, padded.minY, tw, th)

  /** Fast gesamte Innenfläche ohne nennbare Textur ⇒ Tabellen-/Whiteplate. */
  if (coverFrac > 0.9 && textureVar < 55 && fill < 0.055) return null

  /** Breite Platte und sehr flaches Feld ohne Fotostreuung. */
  if (isWidePlate && textureVar < 48 && fill < 0.045) return null

  if (
    positionsFallbackCropPasses(
      rgba,
      stripW,
      stripH,
      xClipMin,
      xClipMaxIncl,
      innerYs,
      innerYeExclusive,
      padded.minX,
      padded.minY,
      tw,
      th,
      whiteRgb
    )
  ) {
    return {
      tight: { x: padded.minX, y: padded.minY, w: tw, h: th },
      isWidePlate,
    }
  }

  if (
    textureVar >= RASTER_MIN_LUMINANCE_VARIANCE_FOR_REVIEW &&
    positionsFallbackCropPassesReview(
      rgba,
      stripW,
      stripH,
      xClipMin,
      xClipMaxIncl,
      innerYs,
      innerYeExclusive,
      padded.minX,
      padded.minY,
      tw,
      th,
      whiteRgb
    )
  ) {
    return {
      tight: { x: padded.minX, y: padded.minY, w: tw, h: th },
      isWidePlate,
    }
  }

  /** Breite Detail-Bildausschnitte mit klarer Textur. */
  if (
    isWidePlate &&
    textureVar >= RASTER_MIN_LUMINANCE_VARIANCE_WIDE_DETAILS &&
    th >= 44 &&
    positionsFallbackCropPassesReview(
      rgba,
      stripW,
      stripH,
      xClipMin,
      xClipMaxIncl,
      innerYs,
      innerYeExclusive,
      padded.minX,
      padded.minY,
      tw,
      th,
      whiteRgb
    )
  ) {
    return {
      tight: { x: padded.minX, y: padded.minY, w: tw, h: th },
      isWidePlate,
    }
  }

  return null
}

export type RasterStripCropClipOptions = {
  clipXMin?: number
  clipXMax?: number
}

/**
 * Nach vertikaler Segmentierung: enges Rechteck um Fotoinhalt (Weiß trimmen).
 * Fallback: gesamten Clip-Rechteck × Segmenthöhe bei unplausiblem Trimmen.
 */
export const refineRasterStripSegmentCrop = (
  rgba: Uint8ClampedArray,
  stripW: number,
  stripH: number,
  seg: { ys: number; ye: number },
  options?: {
    whiteRgb?: number
    padPx?: number
    minContentFill?: number
    clip?: RasterStripCropClipOptions
  }
): { x: number; y: number; w: number; h: number } => {
  const ys = Math.max(0, Math.min(seg.ys, stripH))
  const ye = Math.max(ys, Math.min(seg.ye, stripH))
  const segH = ye - ys
  const clipXMin = Math.max(0, Math.floor(options?.clip?.clipXMin ?? 0))
  const clipXMax = Math.min(stripW - 1, Math.floor(options?.clip?.clipXMax ?? stripW - 1))
  const clipW = clipXMax - clipXMin + 1

  const whiteRgb = options?.whiteRgb ?? RASTER_CROP_TRIM_WHITE_RGB
  const pad = options?.padPx ?? RASTER_CROP_TRIM_PAD_PX
  const minFill = options?.minContentFill ?? RASTER_CROP_MIN_CONTENT_FILL

  const fallback = (): { x: number; y: number; w: number; h: number } => ({
    x: clipXMin,
    y: ys,
    w: Math.max(1, clipW),
    h: Math.max(1, segH),
  })

  if (segH < 1 || stripW < 1 || clipW < 1 || clipXMax < clipXMin) return fallback()

  const segArea = clipW * segH

  const finalizeFromRawBBox = (
    bb: { minX: number; maxX: number; minY: number; maxY: number } | null,
    fillMin: number
  ): { x: number; y: number; w: number; h: number } | null => {
    if (!bb) return null
    const padded = clampAndPadBBox(bb, pad, clipXMin, clipXMax, ys, ye - 1)
    const tw = padded.maxX - padded.minX + 1
    const th = padded.maxY - padded.minY + 1
    if (tw < RASTER_REFINE_MIN_EDGE_AFTER_TRIM || th < RASTER_REFINE_MIN_EDGE_AFTER_TRIM) return null
    if (tw * th < RASTER_REFINE_MIN_AREA_AFTER_TRIM) return null
    if (tw * th < segArea * RASTER_CROP_MIN_AREA_VS_SEGMENT) return null
    const fill = contentFillRatio(rgba, stripW, padded.minX, padded.minY, padded.maxX, padded.maxY, whiteRgb)
    if (fill < fillMin) return null
    const wf = rectWhiteFrac(rgba, stripW, padded.minX, padded.minY, tw, th, whiteRgb)
    if (wf > RASTER_CROP_MAX_WHITE_FRAC_AFTER_TRIM) return null
    const ar = Math.max(tw / th, th / tw)
    if (ar > RASTER_MAX_ASPECT_EXTREME) return null
    return { x: padded.minX, y: padded.minY, w: tw, h: th }
  }

  const minFillRelax = Math.max(0.45, minFill - 0.12)

  const full2d = computeNonWhiteBoundingBoxInRect(rgba, stripW, clipXMin, ys, clipW, segH, whiteRgb)
  let tight =
    finalizeFromRawBBox(full2d, minFill) ?? finalizeFromRawBBox(full2d, minFillRelax)
  if (tight) return tight

  let yTop = ys
  while (
    yTop < ye &&
    !rowHasNonWhite(rgba, stripW, clipXMin, clipW, yTop, whiteRgb)
  )
    yTop += 1
  let yBot = ye - 1
  while (
    yBot >= ys &&
    !rowHasNonWhite(rgba, stripW, clipXMin, clipW, yBot, whiteRgb)
  )
    yBot -= 1
  if (yBot < yTop) return fallback()

  const vOnlySegH = yBot - yTop + 1
  const hTrim = computeNonWhiteBoundingBoxInRect(
    rgba,
    stripW,
    clipXMin,
    yTop,
    clipW,
    vOnlySegH,
    whiteRgb
  )
  tight = finalizeFromRawBBox(hTrim, minFill) ?? finalizeFromRawBBox(hTrim, minFillRelax)
  if (tight) return tight

  const vy = Math.max(ys, yTop - pad)
  const vye = Math.min(ye - 1, yBot + pad)
  const vh = vye - vy + 1
  if (vh >= RASTER_REFINE_MIN_EDGE_AFTER_TRIM && clipW * vh >= RASTER_REFINE_MIN_AREA_AFTER_TRIM) {
    const filler = contentFillRatio(rgba, stripW, clipXMin, vy, clipXMax, vye, whiteRgb)
    if (filler >= minFillRelax) {
      return { x: clipXMin, y: vy, w: clipW, h: vh }
    }
  }

  return fallback()
}

const pdfStripToViewportDiv = (
  vp: pdfjs.PageViewport,
  yBottom: number,
  yTop: number,
  xLeft: number,
  xRight: number
): { sx: number; sy: number; sw: number; sh: number } => {
  const p00 = vp.convertToViewportPoint(xLeft, yBottom)
  const p10 = vp.convertToViewportPoint(xRight, yBottom)
  const p01 = vp.convertToViewportPoint(xLeft, yTop)
  const p11 = vp.convertToViewportPoint(xRight, yTop)
  const xs = [p00[0], p10[0], p01[0], p11[0]]
  const ys = [p00[1], p10[1], p01[1], p11[1]]
  return {
    sx: Math.min(...xs),
    sy: Math.min(...ys),
    sw: Math.max(...xs) - Math.min(...xs),
    sh: Math.max(...ys) - Math.min(...ys),
  }
}

const segmentsFromStripInkRows = (rows: Uint8Array): Array<{ ys: number; ye: number }> => {
  const spans: Array<{ ys: number; ye: number }> = []
  let y = 0
  while (y < rows.length) {
    while (y < rows.length && rows[y] === 0) y += 1
    if (y >= rows.length) break
    const ys = y
    while (y < rows.length && rows[y] === 1) y += 1
    const ye = y
    if (ye - ys >= MIN_VERT_SEG_PX) spans.push({ ys, ye })
  }
  return spans.slice(0, 6)
}

/**
 * Benachbarte vertikale Tinten-Segmente zusammenführen, wenn die Lücke klein ist und die Bandhöhen
 * nicht extrem verschieden sind (ein zusammenhängendes Foto statt 3–4 Teilsegmenten).
 */
const mergeAdjacentVerticalSegments = (
  spans: ReadonlyArray<{ ys: number; ye: number }>,
  stripH: number
): Array<{ ys: number; ye: number }> => {
  if (spans.length <= 1) return [...spans]
  const sorted = [...spans].sort((a, b) => a.ys - b.ys)
  const out: Array<{ ys: number; ye: number }> = []
  let cur = { ys: sorted[0]!.ys, ye: sorted[0]!.ye }
  for (let i = 1; i < sorted.length; i += 1) {
    const nxt = sorted[i]!
    const gap = nxt.ys - cur.ye
    const h0 = Math.max(1, cur.ye - cur.ys)
    const h1 = Math.max(1, nxt.ye - nxt.ys)
    const ratio = Math.min(h0, h1) / Math.max(h0, h1)
    const merge =
      gap <= VERT_SEGMENT_MERGE_MAX_GAP_PX &&
      gap >= 0 &&
      ratio >= VERT_SEGMENT_MERGE_HEIGHT_RATIO_MIN &&
      nxt.ye <= stripH + 2
    if (merge) {
      cur = { ys: cur.ys, ye: Math.min(stripH, Math.max(cur.ye, nxt.ye)) }
    } else {
      out.push(cur)
      cur = { ys: nxt.ys, ye: nxt.ye }
    }
  }
  out.push(cur)
  return out.slice(0, 6)
}

/** Nur für Vitest */
export const __testMergeAdjacentVerticalSegments = mergeAdjacentVerticalSegments

const buildInkRowsStrip = (data: Uint8ClampedArray, w: number, h: number): Uint8Array => {
  const rows = new Uint8Array(h)
  for (let y = 0; y < h; y += 1) {
    let ink = 0
    let off = y * w * 4
    for (let x = 0; x < w; x += 1) {
      const r = data[off] ?? 0
      const g = data[off + 1] ?? 0
      const b = data[off + 2] ?? 0
      off += 4
      const lum = (r * 299 + g * 587 + b * 114) / 1000
      if (lum < LUM_CEIL) ink += 1
    }
    rows[y] = ink / w >= ROW_INK ? 1 : 0
  }
  for (let y = 1; y < h - 1; y += 1) {
    if (rows[y] === 0 && rows[y - 1] === 1 && rows[y + 1] === 1) rows[y] = 1
  }
  return rows
}

/** Liefert zusammenhängende x-Bereiche (Spalten) mit genug „Tinte“ zwischen Weiß-Spalten. */
export const horizontalInkSpansFromSegment = (
  data: Uint8ClampedArray,
  stripW: number,
  seg: { ys: number; ye: number },
  whiteRgb: number = RASTER_CROP_TRIM_WHITE_RGB
): Array<{ xa: number; xbIncl: number }> => {
  const ys = Math.max(0, seg.ys)
  const ye = Math.max(ys + 1, seg.ye)
  const segH = ye - ys
  const colFrac: number[] = new Array(stripW)
  for (let x = 0; x < stripW; x += 1) {
    let nk = 0
    for (let y = ys; y < ye; y += 1) {
      if (pixelNonWhiteForTrim(data, stripW, x, y, whiteRgb)) nk += 1
    }
    colFrac[x] = nk / segH
  }

  type Run = { a: number; b: number; anyInk: boolean }
  const runs: Run[] = []
  let cx = 0
  while (cx < stripW) {
    const gap = colFrac[cx]! < COL_GAP_MAX_INK_FRAC
    let x2 = cx
    while (
      x2 < stripW &&
      (colFrac[x2]! < COL_GAP_MAX_INK_FRAC) === gap
    )
      x2 += 1
    runs.push({ a: cx, b: x2 - 1, anyInk: !gap })
    cx = x2
  }

  const inkRuns = runs.filter((r) => r.anyInk && r.b - r.a + 1 >= MIN_HORIZ_REGION_PX)
  if (inkRuns.length <= 1) {
    /** Kein stabiler weißer Spaltentrenner: ein Bereich oder flach zusammenlegen */
    let minInkX = stripW - 1
    let maxInkX = 0
    let any = false
    for (let x = 0; x < stripW; x += 1) {
      if (colFrac[x]! >= COL_GAP_MAX_INK_FRAC + 1e-6) {
        any = true
        if (x < minInkX) minInkX = x
        if (x > maxInkX) maxInkX = x
      }
    }
    if (!any) return [{ xa: 0, xbIncl: stripW - 1 }]
    const xa = minInkX
    const xbIncl = maxInkX
    if (xbIncl - xa + 1 < MIN_HORIZ_REGION_PX) return []
    return [{ xa, xbIncl }]
  }
  /** Mehrere Trennung(en): zusammenfassen, wenn Lücke &lt; MIN_GAP_COLUMNS */
  const spans: Array<{ xa: number; xbIncl: number }> = []
  const merged: Array<{ a: number; b: number }> = [{ a: inkRuns[0]!.a, b: inkRuns[0]!.b }]
  for (let i = 1; i < inkRuns.length; i += 1) {
    const cur = inkRuns[i]!
    const prev = merged[merged.length - 1]!
    const gap = cur.a - prev.b - 1
    if (gap >= MIN_GAP_COLUMNS && prev.b - prev.a + 1 >= MIN_HORIZ_REGION_PX) {
      merged.push({ a: cur.a, b: cur.b })
    } else {
      merged[merged.length - 1] = { a: prev.a, b: cur.b }
    }
  }
  for (const m of merged) {
    const wPx = m.b - m.a + 1
    if (wPx >= MIN_HORIZ_REGION_PX) spans.push({ xa: m.a, xbIncl: m.b })
  }
  if (spans.length === 0) return [{ xa: 0, xbIncl: stripW - 1 }]
  return spans
}

/** Nur für Vitest */
export const __testBuildInkRowsStrip = buildInkRowsStrip
/** Nur für Vitest */
export const __testSegmentsFromStripInkRows = segmentsFromStripInkRows
/** Nur für Vitest */
export const __testHorizontalInkSpansFromSegment = horizontalInkSpansFromSegment

const passesRasterFinalGeometry = (
  w: number,
  h: number
): boolean => {
  if (w < RASTER_FINAL_MIN_W || h < RASTER_FINAL_MIN_H) return false
  if (w * h < RASTER_FINAL_MIN_AREA) return false
  const ar = Math.max(w / h, h / w)
  if (!Number.isFinite(ar) || ar > RASTER_MAX_ASPECT_EXTREME) return false
  if (isRasterWidePlateWOverH(w, h)) return false
  if (isRasterTallNeedleSliver(w, h)) return false
  return true
}

/** Geometrie für schwache/low_confidence-Speicherung (nur wenn keine starken Bildausschnitte im Block). */
const passesRasterWeakGeometry = (w: number, h: number): boolean => {
  if (w < RASTER_WEAK_MIN_W || h < RASTER_WEAK_MIN_H) return false
  if (w * h < RASTER_WEAK_MIN_AREA) return false
  const ar = Math.max(w / h, h / w)
  if (!Number.isFinite(ar) || ar > RASTER_MAX_ASPECT_EXTREME) return false
  if (isRasterWidePlateWOverH(w, h)) return false
  if (isRasterTallNeedleSliver(w, h)) return false
  if (h <= RASTER_LINE_MAX_H_PX && w >= h * RASTER_LINE_MIN_WH_RATIO) return false
  return true
}

/** Kleinstes behalten für needs_review, wenn Textur/Semantik mitspielen (nicht für „strong“). */
const passesRasterReviewGeometry = (w: number, h: number): boolean => {
  if (w < RASTER_REVIEW_MIN_W || h < RASTER_REVIEW_MIN_H) return false
  if (w * h < RASTER_REVIEW_MIN_AREA) return false
  const ar = Math.max(w / h, h / w)
  if (!Number.isFinite(ar) || ar > RASTER_MAX_ASPECT_EXTREME) return false
  if (isRasterTallNeedleSliver(w, h)) return false
  if (h <= RASTER_LINE_MAX_H_PX && w >= h * RASTER_LINE_MIN_WH_RATIO) return false
  if (isRasterWidePlateWOverH(w, h) && h < 38) return false
  return true
}

/** Rote Mängel-/Statustextfarbe (PDF-Render), kein Foto. */
const pixelIsLikelyRedStatus = (data: Uint8ClampedArray, pxBase: number): boolean => {
  const r = data[pxBase] ?? 0
  const g = data[pxBase + 1] ?? 0
  const b = data[pxBase + 2] ?? 0
  return r > RASTER_STATUS_RED_R_MIN && g < RASTER_STATUS_RED_G_MAX && b < RASTER_STATUS_RED_B_MAX
}

/** Sehr dunkles, annähernd neutrales Tintenpixel (Linie/Textstrich). */
const pixelIsLikelyDarkLineOrRule = (data: Uint8ClampedArray, pxBase: number): boolean => {
  const r = data[pxBase] ?? 0
  const g = data[pxBase + 1] ?? 0
  const b = data[pxBase + 2] ?? 0
  const lum = (r * 299 + g * 587 + b * 114) / 1000
  return lum < 95 && Math.max(r, g, b) < 120
}

type RedStatusBandPixels = {
  topNw: number
  topRed: number
  bottomNw: number
  bottomRed: number
}

const scanRedStatusBandPixels = (
  data: Uint8ClampedArray,
  stripW: number,
  xs: number,
  ys: number,
  xe: number,
  ye: number,
  whiteRgb: number
): RedStatusBandPixels => {
  const rh = ye - ys + 1
  const hTopBand = Math.max(2, Math.floor(rh * RASTER_TOP_BAND_FRAC_FOR_RED))
  const hBotBand = Math.max(2, Math.floor(rh * RASTER_BOTTOM_BAND_FRAC_FOR_RED))
  let topNw = 0
  let topRed = 0
  let bottomNw = 0
  let bottomRed = 0
  for (let yy = ys; yy <= ye; yy += 1) {
    const yRel = yy - ys
    const inTop = yRel < hTopBand
    const inBot = yy > ye - hBotBand
    if (!inTop && !inBot) continue
    for (let xx = xs; xx <= xe; xx += 1) {
      const i = (yy * stripW + xx) * 4
      if (!isRgbWhiteForTrim(data, i, whiteRgb)) {
        if (inTop) {
          topNw += 1
          if (pixelIsLikelyRedStatus(data, i)) topRed += 1
        }
        if (inBot) {
          bottomNw += 1
          if (pixelIsLikelyRedStatus(data, i)) bottomRed += 1
        }
      }
    }
  }
  return { topNw, topRed, bottomNw, bottomRed }
}

const rejectByDominantRedStatusBands = (
  rw: number,
  rh: number,
  bands: RedStatusBandPixels,
  redDominanceContext: boolean
): boolean => {
  const { topNw, topRed, bottomNw, bottomRed } = bands
  const topBandArea = rw * Math.min(Math.max(2, Math.floor(rh * RASTER_TOP_BAND_FRAC_FOR_RED)), rh)
  const bottomBandArea = rw * Math.min(Math.max(2, Math.floor(rh * RASTER_BOTTOM_BAND_FRAC_FOR_RED)), rh)

  if (
    topNw >= RASTER_REJECT_BAND_MIN_NONWHITE &&
    topRed / topNw > RASTER_REJECT_BAND_RED_IN_NONWHITE_TOP
  )
    return true
  if (
    bottomNw >= RASTER_REJECT_BAND_MIN_NONWHITE &&
    bottomRed / bottomNw > RASTER_REJECT_BAND_RED_IN_NONWHITE_BOTTOM
  )
    return true

  if (topBandArea > 0 && redDominanceContext && topRed / topBandArea > RASTER_REJECT_TOP_BAND_RED_RATIO)
    return true
  if (
    bottomBandArea > 0 &&
    redDominanceContext &&
    bottomRed / bottomBandArea > RASTER_REJECT_BOTTOM_BAND_RED_RATIO
  )
    return true

  return false
}

/** Nur Vitest — Kopf-/Fußband-Rotanteile separat messen. */
export const __testScanRedStatusBandPixels = scanRedStatusBandPixels

/** Nur Vitest — Dominanz roter PDF-Status in Kopf-/Fußband. */
export const __testRejectByDominantRedStatusBands = rejectByDominantRedStatusBands

/**
 * Status-/Linien-/Textheuristik — gilt für stark und schwach.
 * Rot-Dominanz nur bei breiter/flacher Platte, Linienform oder relativ kompakter Fläche ablehnen (keine echte Großfotos nur wegen Flecken verworfen).
 * Sehr kleine Rechtecke (&lt; 28²) weiter ablehnen (Rauschen).
 */
export const shouldRejectRasterSemanticsOnly = (
  data: Uint8ClampedArray,
  stripW: number,
  stripH: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  whiteRgb: number = RASTER_CROP_TRIM_WHITE_RGB
): boolean => {
  const xs = Math.max(0, Math.floor(bx))
  const ys = Math.max(0, Math.floor(by))
  const iw = Math.floor(bw)
  const ih = Math.floor(bh)
  if (iw < 28 || ih < 28) return true
  let xe = xs + iw - 1
  let ye = ys + ih - 1
  xe = Math.min(stripW - 1, xe)
  ye = Math.min(stripH - 1, ye)
  if (xe < xs || ye < ys) return true
  const rw = xe - xs + 1
  const rh = ye - ys + 1

  if (rw * rh < 28 * 28) return true
  if (isRasterWidePlateWOverH(rw, rh)) return true
  if (isRasterTallNeedleSliver(rw, rh)) return true
  if (rh <= RASTER_LINE_MAX_H_PX && rw >= rh * RASTER_LINE_MIN_WH_RATIO) return true

  let nonWhite = 0
  let redCount = 0
  let darkCount = 0
  let hiRow = 0

  const hTopBand = Math.max(2, Math.floor(rh * RASTER_TOP_BAND_FRAC_FOR_RED))
  const hBotBand = Math.max(2, Math.floor(rh * RASTER_BOTTOM_BAND_FRAC_FOR_RED))
  let topBandNonWhite = 0
  let topBandRed = 0
  let bottomBandNonWhite = 0
  let bottomBandRed = 0

  for (let yy = ys; yy <= ye; yy += 1) {
    let rowInk = 0
    const yRel = yy - ys
    const inTop = yRel < hTopBand
    const inBot = yy > ye - hBotBand
    for (let xx = xs; xx <= xe; xx += 1) {
      const i = (yy * stripW + xx) * 4
      if (!isRgbWhiteForTrim(data, i, whiteRgb)) {
        nonWhite += 1
        rowInk += 1
        if (inTop) topBandNonWhite += 1
        if (inBot) bottomBandNonWhite += 1
        if (pixelIsLikelyRedStatus(data, i)) {
          redCount += 1
          if (inTop) topBandRed += 1
          if (inBot) bottomBandRed += 1
        }
        if (pixelIsLikelyDarkLineOrRule(data, i)) darkCount += 1
      }
    }
    if (rw > 24 && rowInk / rw >= 0.82) hiRow += 1
  }

  const area = rw * rh
  const isThinLinePlate = rh <= RASTER_LINE_MAX_H_PX && rw >= rh * RASTER_LINE_MIN_WH_RATIO
  const redDominanceContext =
    isRasterWidePlateWOverH(rw, rh) || isThinLinePlate || area <= RASTER_RED_SEM_COMPACT_AREA_PX

  if (nonWhite === 0) return true
  if (nonWhite / area < 0.015) return true

  const whiteFrac = 1 - nonWhite / area
  if (whiteFrac > 0.415) return true

  if (rh <= 30 && hiRow <= 4 && hiRow >= 1 && rw / rh >= 6.6) return true

  if (redDominanceContext && redCount / area > RASTER_REJECT_RED_FRAC_TOTAL) return true
  if (redDominanceContext && redCount / nonWhite > RASTER_REJECT_RED_FRAC_NONWHITE) return true

  if (
    rejectByDominantRedStatusBands(
      rw,
      rh,
      {
        topNw: topBandNonWhite,
        topRed: topBandRed,
        bottomNw: bottomBandNonWhite,
        bottomRed: bottomBandRed,
      },
      redDominanceContext
    )
  )
    return true

  if (darkCount / nonWhite > 0.72 && rh <= 34 && rw / rh >= 7) return true

  const fillInk = nonWhite / area
  if (fillInk < 0.032 && rw / rh >= 5.5) return true

  return false
}

/**
 * Für needs_review: wenn streng verworfen, bei erkennbarer Bildtextur und ausreichend Inhalt dennoch akzeptieren.
 * Dünne Status-/Tabellenlinien bleiben verworfen.
 */
const shouldRejectRasterSemanticsReviewTier = (
  data: Uint8ClampedArray,
  stripW: number,
  stripH: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  whiteRgb: number = RASTER_CROP_TRIM_WHITE_RGB
): boolean => {
  if (!shouldRejectRasterSemanticsOnly(data, stripW, stripH, bx, by, bw, bh, whiteRgb)) return false

  const xs = Math.max(0, Math.floor(bx))
  const ys = Math.max(0, Math.floor(by))
  const iw = Math.floor(bw)
  const ih = Math.floor(bh)
  let xe = xs + iw - 1
  let ye = ys + ih - 1
  xe = Math.min(stripW - 1, xe)
  ye = Math.min(stripH - 1, ye)
  if (xe < xs || ye < ys) return true
  const rw = xe - xs + 1
  const rh = ye - ys + 1
  if (rw < 22 || rh < 22) return true
  if (rh <= RASTER_LINE_MAX_H_PX && rw >= rh * RASTER_LINE_MIN_WH_RATIO) return true

  const bands = scanRedStatusBandPixels(data, stripW, xs, ys, xe, ye, whiteRgb)
  const area = rw * rh
  const isThinLinePlate = rh <= RASTER_LINE_MAX_H_PX && rw >= rh * RASTER_LINE_MIN_WH_RATIO
  const redDominanceContext =
    isRasterWidePlateWOverH(rw, rh) || isThinLinePlate || area <= RASTER_RED_SEM_COMPACT_AREA_PX
  if (rejectByDominantRedStatusBands(rw, rh, bands, redDominanceContext)) return true

  const textureVar = rasterRegionLuminanceVariance(data, stripW, stripH, xs, ys, rw, rh)
  let nonWhite = 0
  for (let yy = ys; yy <= ye; yy += 1) {
    for (let xx = xs; xx <= xe; xx += 1) {
      const i = (yy * stripW + xx) * 4
      if (!isRgbWhiteForTrim(data, i, whiteRgb)) nonWhite += 1
    }
  }
  const fillInk = nonWhite / Math.max(1, area)
  if (textureVar >= 130 && fillInk >= 0.03) return false
  if (textureVar >= 95 && fillInk >= 0.038 && rh >= 26) return false
  if (textureVar >= 72 && fillInk >= 0.045 && rh >= 32 && rw >= 28) return false
  return true
}

/**
 * Post-Segmentierung: typische Teilfragmente verwerfen (dünne Streifen, Randreste, „Foto + viel Weiß“),
 * echte kleine Detailaufnahmen über Textur/`strong`-Klassifikation behalten.
 */
const isSuspectedRasterFragmentDrop = (
  data: Uint8ClampedArray,
  stripW: number,
  stripH: number,
  tight: { x: number; y: number; w: number; h: number },
  kind: 'strong' | 'weak' | 'review',
  whiteRgb: number = RASTER_CROP_TRIM_WHITE_RGB
): boolean => {
  const ix = Math.max(0, Math.floor(tight.x))
  const iy = Math.max(0, Math.floor(tight.y))
  let iw = Math.max(1, Math.floor(tight.w))
  let ih = Math.max(1, Math.floor(tight.h))
  iw = Math.min(iw, stripW - ix)
  ih = Math.min(ih, stripH - iy)
  if (iw < 1 || ih < 1) return true
  const area = iw * ih
  const ar = Math.max(iw / ih, ih / iw)

  if (Math.min(iw, ih) <= 13 && Math.max(iw, ih) >= 44) return true

  let nonWhite = 0
  for (let yy = iy; yy < iy + ih; yy += 1) {
    for (let xx = ix; xx < ix + iw; xx += 1) {
      const bi = (yy * stripW + xx) * 4
      if (!isRgbWhiteForTrim(data, bi, whiteRgb)) nonWhite += 1
    }
  }
  const fillInk = nonWhite / Math.max(1, area)
  const whiteFrac = 1 - fillInk

  if (kind !== 'strong' && area <= RASTER_FRAGMENT_DROP_AREA_WEAK_REVIEW) {
    const tv = rasterRegionLuminanceVariance(data, stripW, stripH, ix, iy, iw, ih)
    if (tv < RASTER_FRAGMENT_TEXTURE_MIN_KEEP_SMALL) return true
  }

  if (kind !== 'strong' && area < 4100 && fillInk < 0.1 && ar > 8.2) return true
  if (kind !== 'strong' && whiteFrac >= RASTER_FRAGMENT_WIDE_EMPTY_WHITE_FRAC && ar > 6.2) return true

  /** Schmaler vertikaler Kanten-/Detailstreifen relativ zur Fotospalte (Restfragment). */
  const stripFracW = iw / Math.max(1, stripW)
  if (kind !== 'strong' && stripFracW <= 0.15 && ih >= iw * 2.35 && area < 7800) return true
  if (kind === 'strong' && stripFracW <= 0.13 && ih >= iw * 2.15 && area < 9000) {
    const tvEdge = rasterRegionLuminanceVariance(data, stripW, stripH, ix, iy, iw, ih)
    if (tvEdge < 88) return true
  }

  if (kind === 'strong' && area < 1750) {
    const tv = rasterRegionLuminanceVariance(data, stripW, stripH, ix, iy, iw, ih)
    if (tv < 60 && fillInk < 0.21) return true
  }

  return false
}

/** Nur für Vitest */
export const __testIsSuspectedRasterFragmentDrop = isSuspectedRasterFragmentDrop

/**
 * Strenges Gate für Positionsausschnitt-Fallbacks: kompakter Tinten-Anker im Suchfenster,
 * kein Tabellen-/Breitplattenfüller (Cover vs. Inner-Band).
 */
const positionsFallbackCropPasses = (
  rgba: Uint8ClampedArray,
  stripW: number,
  stripH: number,
  innerXs: number,
  innerXeIncl: number,
  innerYs: number,
  innerYeExclusive: number,
  ix: number,
  iy: number,
  iw: number,
  ih: number,
  whiteRgb: number = RASTER_CROP_TRIM_WHITE_RGB
): boolean => {
  const fiw = Math.floor(iw)
  const fih = Math.floor(ih)
  const fix = Math.floor(ix)
  const fiy = Math.floor(iy)
  if (fiw < 8 || fih < 8) return false
  if (fix < 0 || fiy < 0 || fix + fiw > stripW || fiy + fih > stripH) return false

  const innerW = Math.max(1, innerXeIncl - innerXs + 1)
  const innerH = Math.max(1, innerYeExclusive - innerYs)
  const innerArea = innerW * innerH
  const cropArea = fiw * fih
  const coverFrac = cropArea / innerArea
  if (!Number.isFinite(coverFrac)) return false
  if (coverFrac > POSITIONS_FALLBACK_MAX_INNER_COVER_FRAC) return false
  if (coverFrac < POSITIONS_FALLBACK_MIN_INNER_COVER_FRAC) return false

  const maxX = fix + fiw - 1
  const maxY = fiy + fih - 1
  const fill = contentFillRatio(rgba, stripW, fix, fiy, maxX, maxY, whiteRgb)
  if (fill < POSITIONS_FALLBACK_MIN_NONWHITE_DENSITY) return false

  const wf = rectWhiteFrac(rgba, stripW, fix, fiy, fiw, fih, whiteRgb)
  if (wf > POSITIONS_FALLBACK_MAX_WHITE_FRAC) return false

  if (!passesRasterWeakGeometry(fiw, fih)) return false
  if (shouldRejectRasterSemanticsOnly(rgba, stripW, stripH, fix, fiy, fiw, fih, whiteRgb)) return false

  return true
}

const positionsFallbackCropPassesReview = (
  rgba: Uint8ClampedArray,
  stripW: number,
  stripH: number,
  innerXs: number,
  innerXeIncl: number,
  innerYs: number,
  innerYeExclusive: number,
  ix: number,
  iy: number,
  iw: number,
  ih: number,
  whiteRgb: number = RASTER_CROP_TRIM_WHITE_RGB
): boolean => {
  const fiw = Math.floor(iw)
  const fih = Math.floor(ih)
  const fix = Math.floor(ix)
  const fiy = Math.floor(iy)
  if (fiw < 8 || fih < 8) return false
  if (fix < 0 || fiy < 0 || fix + fiw > stripW || fiy + fih > stripH) return false

  const innerW = Math.max(1, innerXeIncl - innerXs + 1)
  const innerH = Math.max(1, innerYeExclusive - innerYs)
  const innerArea = innerW * innerH
  const cropArea = fiw * fih
  const coverFrac = cropArea / innerArea
  if (!Number.isFinite(coverFrac)) return false
  if (coverFrac > POSITIONS_FALLBACK_REVIEW_MAX_INNER_COVER_FRAC) return false
  if (coverFrac < POSITIONS_FALLBACK_REVIEW_MIN_INNER_COVER_FRAC) return false

  const maxX = fix + fiw - 1
  const maxY = fiy + fih - 1
  const fill = contentFillRatio(rgba, stripW, fix, fiy, maxX, maxY, whiteRgb)
  if (fill < POSITIONS_FALLBACK_REVIEW_MIN_NONWHITE_DENSITY) return false

  const wf = rectWhiteFrac(rgba, stripW, fix, fiy, fiw, fih, whiteRgb)
  if (wf > POSITIONS_FALLBACK_REVIEW_MAX_WHITE_FRAC) return false

  if (!passesRasterReviewGeometry(fiw, fih)) return false
  if (shouldRejectRasterSemanticsReviewTier(rgba, stripW, stripH, fix, fiy, fiw, fih, whiteRgb))
    return false

  return true
}

/** Nur Vitest — gleiche Implementierung wie {@link positionsFallbackCropPassesReview}. */
export const __testPositionsFallbackCropPassesReview = positionsFallbackCropPassesReview

/** Nur Vitest — gleiche Implementierung wie {@link positionsFallbackCropPasses}. */
export const __testPositionsFallbackCropPasses = positionsFallbackCropPasses

/**
 * Produkt-Schranke: Mindest‑50 px-Kante plus Semantik (Vitest & externe Ablehnungslogik).
 */
export const shouldRejectRasterStripCrop = (
  data: Uint8ClampedArray,
  stripW: number,
  stripH: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  whiteRgb: number = RASTER_CROP_TRIM_WHITE_RGB
): boolean => {
  const xs = Math.max(0, Math.floor(bx))
  const ys = Math.max(0, Math.floor(by))
  const iw = Math.floor(bw)
  const ih = Math.floor(bh)
  if (iw < 8 || ih < 8) return true
  let xe = xs + iw - 1
  let ye = ys + ih - 1
  xe = Math.min(stripW - 1, xe)
  ye = Math.min(stripH - 1, ye)
  if (xe < xs || ye < ys) return true
  const rw = xe - xs + 1
  const rh = ye - ys + 1

  if (!passesRasterFinalGeometry(rw, rh)) return true
  return shouldRejectRasterSemanticsOnly(data, stripW, stripH, bx, by, bw, bh, whiteRgb)
}

/** Nur Vitest — gleiche Implementierung wie {@link shouldRejectRasterStripCrop}. */
export const __testShouldRejectRasterStripCrop = shouldRejectRasterStripCrop
/** Nur Vitest — gleiche Implementierung wie {@link shouldRejectRasterSemanticsOnly}. */
export const __testShouldRejectRasterSemanticsOnly = shouldRejectRasterSemanticsOnly

export const runAltberichtRasterBlockPhotoAnalysis = async (
  pdfBytes: ArrayBuffer,
  fileId: string,
  jobId: string,
  blocks: ReadonlyArray<AltberichtRasterBlockData & { stagingRowId: string }>,
  options: {
    pageTotal: number
    onBlockPhotoProgress?: (e: RasterBlockPhotoProgressEvent) => void
    /** Nach jedem Positionsblock: UI/Event-Loop entlasten (z. B. requestAnimationFrame). */
    yieldToMain?: () => void | Promise<void>
    /** Schreibt gebündelte Zeilen dieser Datei (Rohstreifen + Segmente eines Blocks); optional wenn Legacy-Bulk-Up am Ende. */
    onPersistBlock?: (rows: AltberichtRasterPhotoInsertPayload[]) => void | Promise<void>
  }
): Promise<{ inserts: AltberichtRasterPhotoInsertPayload[] }> => {
  if (typeof window === 'undefined') {
    return { inserts: [] }
  }
  ensurePdfWorker()

  const data = new Uint8Array(pdfBytes.slice(0))
  const loadingTask = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
  const doc = await loadingTask.promise
  const inserts: AltberichtRasterPhotoInsertPayload[] = []
  const rasterBlocksTotal = blocks.filter((b) => !b.isEmpty).length
  let rasterCompletedBlocks = 0

  const byPage = new Map<number, Array<AltberichtRasterBlockData & { stagingRowId: string }>>()
  for (const b of blocks) {
    if (!byPage.has(b.pageNumber)) byPage.set(b.pageNumber, [])
    byPage.get(b.pageNumber)!.push(b)
  }

  const pageNums = [...byPage.keys()].sort((a, c) => a - c)

  try {
    for (const pageNumber of pageNums) {
      const list = byPage.get(pageNumber) ?? []
      let page: pdfjs.PDFPageProxy | null = null
      let pageCanvas: HTMLCanvasElement | null = null
      try {
        page = await doc.getPage(pageNumber)
        const vp = page.getViewport({ scale: ALTBERICHT_RASTER_VIEWPORT_SCALE })
        pageCanvas = document.createElement('canvas')
        pageCanvas.width = vp.width
        pageCanvas.height = vp.height
        const ctx = pageCanvas.getContext('2d')
        if (!ctx) continue

        const task = page.render({ canvasContext: ctx, viewport: vp })
        await task.promise

        const sortedPageBlocks = [...list].sort((a, b) => a.globalRowIndex - b.globalRowIndex)
        const rasterNonEmptyBlocksOnPage = sortedPageBlocks.filter((b) => !b.isEmpty).length
        let pageRasterOrdinal = 0
        for (const block of sortedPageBlocks) {
          if (block.isEmpty) continue
          const pageW = block.pageWidth
          const bandH = block.yTop - block.yBottom
          if (!(bandH > 0)) continue
          pageRasterOrdinal += 1
          const rasterWorkingIndex = rasterCompletedBlocks + 1
          const blockInsertSliceStart = inserts.length

          const bottomShave = Math.min(
            bandH * ALTBERICHT_RASTER_PHOTO_BLOCK_BOTTOM_SHAVE_FRAC,
            bandH * 0.34
          )
          const yBottomClip = Math.min(block.yTop - 0.001, block.yBottom + bottomShave)

          options.onBlockPhotoProgress?.({
            pageNumber,
            pageTotal: options.pageTotal,
            blockIndexOnPage: block.blockIndexOnPage,
            globalRowIndex: block.globalRowIndex,
            photoIndexInBlock: 0,
            photoCountInBlock: 1,
            blocksDone: rasterWorkingIndex,
            blocksTotal: rasterBlocksTotal,
            blocksOnPage: rasterNonEmptyBlocksOnPage,
            blockOrdinalOnPage: pageRasterOrdinal,
          })

          let rawSx = -1
          let rawSy = 0
          let rawSw = 0
          let rawSh = 0

          let finalSegmentRows: AltberichtRasterPhotoInsertPayload[] = []
          let attemptsUsedFinal = 0
          let blockFinalStatus: RasterPhotoBlockQualityStatus = 'failed'

          attemptLoop: for (
            let attIx = 0;
            attIx < ALTBERICHT_RASTER_MAX_BLOCK_ANALYSIS_ATTEMPTS;
            attIx += 1
          ) {
            const leftFrac =
              RASTER_ZONE_LEFT_FRAC_ATTEMPTS[attIx] ?? ALTBERICHT_RASTER_PHOTO_ZONE_LEFT_FRAC
            const xLeftRaw = pageW * leftFrac
            const xLeft = Math.max(xLeftRaw - 6, 0)
            const xRight = Math.max(
              xLeft + 72,
              pageW * (1 - ALTBERICHT_RASTER_PHOTO_ZONE_RIGHT_INSET_FRAC)
            )
            const div = pdfStripToViewportDiv(vp, yBottomClip, block.yTop, xLeft, xRight)
            const sx = Math.max(0, Math.floor(div.sx))
            const sy = Math.max(0, Math.floor(div.sy))
            const sw = Math.min(pageCanvas!.width - sx, Math.ceil(div.sw))
            const sh = Math.min(pageCanvas!.height - sy, Math.ceil(div.sh))
            if (sw < 8 || sh < 8) continue

            if (rawSx < 0) {
              rawSx = sx
              rawSy = sy
              rawSw = sw
              rawSh = sh
            }

            attemptsUsedFinal = attIx + 1

            const segmentInsertsForAttempt: AltberichtRasterPhotoInsertPayload[] = []

            const strip = document.createElement('canvas')
            strip.width = sw
            strip.height = sh
            try {
              const sctx = strip.getContext('2d')
              if (!sctx) continue
              sctx.drawImage(pageCanvas!, sx, sy, sw, sh, 0, 0, sw, sh)
              const id = sctx.getImageData(0, 0, sw, sh)
              const rowsArr = buildInkRowsStrip(id.data, sw, sh)
              let segments = segmentsFromStripInkRows(rowsArr)
              segments = mergeAdjacentVerticalSegments(segments, sh)

              let inkTotal = 0
              for (let i = 0; i < id.data.length; i += 4) {
                const lum = ((id.data[i]! + id.data[i + 1]! + id.data[i + 2]!) / 3) | 0
                if (lum < LUM_CEIL) inkTotal += 1
              }
              const inkRatio = inkTotal / Math.max(1, sw * sh)

              if (segments.length === 0 && inkRatio >= 0.012) {
                segments = [{ ys: 0, ye: sh }]
              }

              const photosVertical = segments.length > 0 ? segments : []

              type BlockEmitCandidate = {
                tightViewportStrip: { x: number; y: number; w: number; h: number }
                kind: 'strong' | 'weak' | 'review'
                tightened: boolean
                subFromHorizSplit: boolean
                cropTightenSkipped: boolean
                subtype: string
                forcedBlockFallback?: boolean
                /** Bounding-Box deckt fast gesamte Innenfläche – kein eigener Foto-Anker. */
                forcedWidePlate?: boolean
              }

              let blockPhotoOrdinal = 0

              const estimatePlannedFromChosen = (n: number): number => Math.max(1, Math.min(99, n))

              let plannedPhotosInBlock = 1

              const emitRasterCrop = (args: {
                tightViewportStrip: { x: number; y: number; w: number; h: number }
                inkRatioEffective: number
                subFromHorizSplit: boolean
                cropTightenSkipped: boolean
                subtype: string
                lowConfidence?: boolean
                forcedBlockFallback?: boolean
                forcedWidePlate?: boolean
                /** UI / QA: unsichere echte Bildfläche (needs_review-Zweig). */
                rasterReviewCrop?: boolean
              }): void => {
                const { tightViewportStrip: t } = args
                const tx = Math.max(0, Math.floor(t.x))
                const ty = Math.max(0, Math.floor(t.y))
                const twp = Math.max(1, Math.floor(t.w))
                const thp = Math.max(1, Math.floor(t.h))

                let cSx = Math.max(0, Math.floor(sx + tx))
                let cSy = Math.max(0, Math.floor(sy + ty))
                let cSw = Math.max(8, twp)
                let cSh = Math.max(8, thp)
                cSw = Math.min(cSw, pageCanvas!.width - cSx)
                cSh = Math.min(cSh, pageCanvas!.height - cSy)

                const posFallback = args.subtype === 'positionsausschnitt'
                const effectiveLowConfidence =
                  posFallback ||
                  Boolean(args.lowConfidence) ||
                  Boolean(args.forcedWidePlate)
                /** Breite Platte + Positionsausschnitt → wie erzwungener Block-Fallback klassifizieren. */
                const effectiveForcedBlock =
                  Boolean(args.forcedBlockFallback) ||
                  (posFallback && Boolean(args.forcedWidePlate))

                if (effectiveForcedBlock) {
                  if (cSw < 24 || cSh < 24) return
                } else if (effectiveLowConfidence) {
                  const reviewCrop = Boolean(args.rasterReviewCrop)
                  const geoOk =
                    passesRasterWeakGeometry(cSw, cSh) ||
                    (reviewCrop && passesRasterReviewGeometry(cSw, cSh))
                  if (!geoOk) return
                  if (
                    reviewCrop
                      ? shouldRejectRasterSemanticsReviewTier(id.data, sw, sh, tx, ty, twp, thp)
                      : shouldRejectRasterSemanticsOnly(id.data, sw, sh, tx, ty, twp, thp)
                  )
                    return
                } else {
                  if (!passesRasterFinalGeometry(cSw, cSh)) return
                  if (shouldRejectRasterSemanticsOnly(id.data, sw, sh, tx, ty, twp, thp)) return
                }

                blockPhotoOrdinal += 1
                if (blockPhotoOrdinal > 99)
                  throw new Error('Zu viele Raster-Segmente in einem Positionsblock (max. 99)')

                options.onBlockPhotoProgress?.({
                  pageNumber,
                  pageTotal: options.pageTotal,
                  blockIndexOnPage: block.blockIndexOnPage,
                  globalRowIndex: block.globalRowIndex,
                  photoIndexInBlock: blockPhotoOrdinal,
                  photoCountInBlock: plannedPhotosInBlock,
                })

                let confBase =
                  plannedPhotosInBlock > 1
                    ? 0.74
                    : args.inkRatioEffective > 0.08
                      ? 0.82
                      : args.inkRatioEffective > 0.025
                        ? 0.68
                        : posFallback
                          ? 0.3
                          : 0.36
                if (posFallback && args.forcedWidePlate) confBase = Math.min(confBase, 0.22)
                if (args.rasterReviewCrop) confBase = Math.min(confBase, 0.34)
                if (effectiveLowConfidence) confBase = Math.min(confBase * 0.52, 0.3)
                if (effectiveForcedBlock) confBase = Math.min(confBase, 0.19)
                const conf = args.cropTightenSkipped
                  ? Math.max(0.13, confBase - Math.min(0.12, confBase * 0.18))
                  : confBase

                segmentInsertsForAttempt.push({
                  job_id: jobId,
                  file_id: fileId,
                  page_number: pageNumber,
                  image_index: computeAltberichtRasterImageIndex(block.blockIndexOnPage, blockPhotoOrdinal),
                  scan_version: ALTBERICHT_RASTER_SCAN_VERSION,
                  op_kind: ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP,
                  suggested_staging_object_id: block.stagingRowId,
                  linked_staging_object_id: null,
                  user_intent: 'unreviewed',
                  preview_storage_path: null,
                  scan_meta_json: {
                    v: 2,
                    source: 'block_crop',
                    photoAnalysis: 'viewport_crop_v2',
                    viewportScaleUsed: ALTBERICHT_RASTER_VIEWPORT_SCALE,
                    cropViewportPx: { sx: cSx, sy: cSy, sw: cSw, sh: cSh },
                    ...(args.cropTightenSkipped ? { cropTightenSkipped: true } : {}),
                    ...(effectiveLowConfidence ? { lowConfidence: true } : {}),
                    ...(effectiveForcedBlock ? { forcedBlockFallback: true } : {}),
                    ...(posFallback ? { rasterPositionsFallback: true } : {}),
                    ...(args.forcedWidePlate && posFallback ? { rasterWidePhotoPlate: true } : {}),
                    ...(args.rasterReviewCrop ? { rasterReviewCrop: true } : {}),
                    blockIndexOnPage: block.blockIndexOnPage,
                    globalRowIndex: block.globalRowIndex,
                    photoIndexInBlock: blockPhotoOrdinal,
                    logicalPhotoKey: formatAltberichtLogicalPhotoKey(block.globalRowIndex, blockPhotoOrdinal),
                    confidence: conf,
                    subtype: args.subtype,
                    pageWidthPdf: pageW,
                    pageHeightPdf: block.pageHeight,
                    ...(args.subFromHorizSplit ? { horizSplit: true } : {}),
                    ...(photosVertical.length > 1 ? { multiVertSegment: true } : {}),
                  },
                })
              }

              const classifyTightCrop = (
                pick: { x: number; y: number; w: number; h: number },
                meta: Omit<BlockEmitCandidate, 'tightViewportStrip' | 'kind'>
              ): BlockEmitCandidate | null => {
                const iw = Math.floor(pick.w)
                const ih = Math.floor(pick.h)
                const ix = Math.floor(pick.x)
                const iy = Math.floor(pick.y)
                if (iw < 8 || ih < 8) return null
                if (passesRasterFinalGeometry(iw, ih) && !shouldRejectRasterSemanticsOnly(id.data, sw, sh, ix, iy, iw, ih))
                  return { tightViewportStrip: pick, ...meta, kind: 'strong' }
                if (passesRasterWeakGeometry(iw, ih) && !shouldRejectRasterSemanticsOnly(id.data, sw, sh, ix, iy, iw, ih))
                  return { tightViewportStrip: pick, ...meta, kind: 'weak' }
                if (
                  passesRasterReviewGeometry(iw, ih) &&
                  !shouldRejectRasterSemanticsReviewTier(id.data, sw, sh, ix, iy, iw, ih)
                )
                  return { tightViewportStrip: pick, ...meta, kind: 'review' }
                return null
              }

              const subtypeForRegions = (regionsCount: number): string => {
                if (regionsCount >= 3 || photosVertical.length > 1) return 'segment'
                if (inkRatio < 0.013) return 'strip_fallback'
                return 'segment'
              }

              const segmentInnerFallbackPick = (
                seg: { ys: number; ye: number },
                regions: ReadonlyArray<{ xa: number; xbIncl: number }>
              ): {
                tight: { x: number; y: number; w: number; h: number }
                subFromHorizSplit: boolean
                forcedWidePlate: boolean
              } | null => {
                const xaFull = regions[0]!.xa
                const xbFull = regions[regions.length - 1]!.xbIncl
                const segBandH = Math.max(1, seg.ye - seg.ys)

                const padTopCombined = Math.max(
                  Math.floor(segBandH * FALLBACK_SEGMENT_TOP_PAD_FRAC),
                  Math.floor(segBandH * FALLBACK_INNER_BAND_TOP_FRAC)
                )
                const padBotCombined = Math.max(
                  Math.floor(segBandH * FALLBACK_SEGMENT_BOTTOM_PAD_FRAC),
                  Math.floor(segBandH * FALLBACK_INNER_BAND_BOTTOM_FRAC)
                )
                let innerYs = Math.min(seg.ye - RASTER_WEAK_MIN_H - 10, Math.max(seg.ys + 3, seg.ys + padTopCombined))
                let innerYe = Math.max(innerYs + RASTER_WEAK_MIN_H + 2, seg.ye - padBotCombined)
                innerYe = Math.min(innerYe, seg.ye - 2)
                innerYs = Math.max(seg.ys, Math.min(innerYs, innerYe - RASTER_WEAK_MIN_H - 2))
                if (innerYe - innerYs < RASTER_WEAK_MIN_H) return null

                const boxed = pickFromFallbackInkBBox(
                  id.data,
                  sw,
                  sh,
                  xaFull,
                  xbFull,
                  innerYs,
                  innerYe,
                  RASTER_CROP_TRIM_WHITE_RGB
                )
                if (!boxed) return null
                return {
                  tight: boxed.tight,
                  subFromHorizSplit: regions.length >= 3,
                  forcedWidePlate: false,
                }
              }

              const collectFromSegment = (seg: { ys: number; ye: number }): BlockEmitCandidate[] => {
                let regions = horizontalInkSpansFromSegment(id.data, sw, seg)
                if (regions.length === 0)
                  regions = [{ xa: 0, xbIncl: Math.max(0, sw - 1) }]
                const multiHoriz = regions.length >= 2
                const out: BlockEmitCandidate[] = []

                for (const r of regions) {
                  const clipped = refineRasterStripSegmentCrop(id.data, sw, sh, seg, {
                    clip: { clipXMin: r.xa, clipXMax: r.xbIncl },
                  })
                  const rawBand = {
                    x: r.xa,
                    y: seg.ys,
                    w: Math.max(8, Math.min(sw - r.xa, r.xbIncl - r.xa + 1)),
                    h: Math.max(8, seg.ye - seg.ys),
                  }
                  const clippedOk = passesRasterFinalGeometry(Math.floor(clipped.w), Math.floor(clipped.h))
                  const subtype = subtypeForRegions(regions.length)

                  const baseMeta = (
                    tightened: boolean,
                    cropSk: boolean,
                    split: boolean
                  ): Omit<BlockEmitCandidate, 'tightViewportStrip' | 'kind'> => ({
                    tightened,
                    subFromHorizSplit: split && multiHoriz,
                    cropTightenSkipped: cropSk,
                    subtype,
                  })

                  let cand = classifyTightCrop(clipped, baseMeta(clippedOk, !clippedOk, true))
                  if (!cand) cand = classifyTightCrop(rawBand, baseMeta(false, true, multiHoriz))
                  if (cand) out.push(cand)
                }

                return out
              }

              const buildBlockWideFallbackCandidates = (): BlockEmitCandidate[] => {
                const innerY0 = Math.max(2, Math.floor(sh * FALLBACK_INNER_BAND_TOP_FRAC))
                let innerY1 = sh - Math.floor(sh * 0.173)
                innerY1 = Math.max(
                  innerY0 + RASTER_WEAK_MIN_H + 6,
                  Math.min(sh - 3, innerY1)
                )
                const bandSeg = { ys: innerY0, ye: innerY1 }
                const regions = [{ xa: 0, xbIncl: Math.max(0, sw - 1) }]
                const fb = segmentInnerFallbackPick(bandSeg, regions)
                if (!fb) return []
                const cn = classifyTightCrop(fb.tight, {
                  tightened: false,
                  subFromHorizSplit: fb.subFromHorizSplit,
                  cropTightenSkipped: true,
                  subtype: 'positionsausschnitt',
                  forcedWidePlate: false,
                })
                return cn ? [cn] : []
              }

              const stripBBoxIoU = (
                a: { x: number; y: number; w: number; h: number },
                b: { x: number; y: number; w: number; h: number }
              ): number => {
                const ax2 = a.x + a.w
                const ay2 = a.y + a.h
                const bx2 = b.x + b.w
                const by2 = b.y + b.h
                const ix1 = Math.max(a.x, b.x)
                const iy1 = Math.max(a.y, b.y)
                const ix2 = Math.min(ax2, bx2)
                const iy2 = Math.min(ay2, by2)
                const iw = Math.max(0, ix2 - ix1)
                const ih = Math.max(0, iy2 - iy1)
                const inter = iw * ih
                const u = a.w * a.h + b.w * b.h - inter
                return u > 0 ? inter / u : 0
              }

              const kindPickPriority = (k: BlockEmitCandidate['kind']): number =>
                k === 'strong' ? 3 : k === 'weak' ? 2 : 1

              const areaViewportStrip = (t: { w: number; h: number }): number =>
                Math.max(1, Math.floor(t.w)) * Math.max(1, Math.floor(t.h))

              /** Wenn bereits große starke Segmente existieren: kleine Schwächlinge / Kantenfragmente verwerfen. */
              const pruneRelativeTinyFragmentsInBlock = (
                chosen: BlockEmitCandidate[],
                stripWidth: number
              ): BlockEmitCandidate[] => {
                if (chosen.length <= 1) return chosen
                const scored = chosen.map((c) => ({
                  c,
                  a: areaViewportStrip(c.tightViewportStrip),
                }))
                const maxArea = Math.max(...scored.map((s) => s.a))
                const strongAreas = scored.filter((s) => s.c.kind === 'strong').map((s) => s.a)
                const maxStrongArea = strongAreas.length > 0 ? Math.max(...strongAreas) : 0
                const hasStrong = strongAreas.length > 0

                if (maxArea < 5400) return chosen

                return scored
                  .filter(({ c, a }) => {
                    const tw = Math.floor(c.tightViewportStrip.w)
                    const th = Math.floor(c.tightViewportStrip.h)
                    const narrowFrac = tw / Math.max(1, stripWidth)

                    if (hasStrong && maxStrongArea >= 9500 && a < maxArea * 0.22 && a < 5600) {
                      if (c.kind !== 'strong') return false
                    }
                    if (
                      hasStrong &&
                      maxStrongArea >= 11000 &&
                      a <= 5200 &&
                      a < maxStrongArea * 0.42 &&
                      c.kind !== 'strong'
                    )
                      return false
                    if (
                      hasStrong &&
                      maxStrongArea >= 7200 &&
                      a < maxStrongArea * 0.34 &&
                      a < 6100 &&
                      narrowFrac < 0.175 &&
                      th > tw * 1.15
                    )
                      return false
                    return true
                  })
                  .map((s) => s.c)
              }

              /** --- Pro Block: alle Kandidaten sammeln, Fragmente droppen, IoU, Cap --- */
              const blockCollectedRaw: BlockEmitCandidate[] = []
              if (photosVertical.length === 0 && inkRatio >= 0.012) {
                blockCollectedRaw.push(...collectFromSegment({ ys: 0, ye: sh }))
              } else {
                for (const segV of photosVertical) blockCollectedRaw.push(...collectFromSegment(segV))
              }

              const blockCollected = blockCollectedRaw.filter(
                (c) =>
                  !isSuspectedRasterFragmentDrop(id.data, sw, sh, c.tightViewportStrip, c.kind)
              )

              const sortedForDedupe = [...blockCollected].sort((a, b) => {
                const kp = kindPickPriority(b.kind) - kindPickPriority(a.kind)
                if (kp !== 0) return kp
                return areaViewportStrip(b.tightViewportStrip) - areaViewportStrip(a.tightViewportStrip)
              })

              let chosenForBlock: BlockEmitCandidate[] = []
              for (const c of sortedForDedupe) {
                if (
                  chosenForBlock.some(
                    (k) =>
                      stripBBoxIoU(k.tightViewportStrip, c.tightViewportStrip) >
                      RASTER_BLOCK_IOU_MERGE_THRESHOLD
                  )
                )
                  continue
                chosenForBlock.push(c)
              }
              chosenForBlock = pruneRelativeTinyFragmentsInBlock(chosenForBlock, sw)
              if (chosenForBlock.length > RASTER_BLOCK_MAX_PHOTOS_PER_BLOCK) {
                chosenForBlock = chosenForBlock.slice(0, RASTER_BLOCK_MAX_PHOTOS_PER_BLOCK)
              }

              if (chosenForBlock.length === 0) {
                chosenForBlock = buildBlockWideFallbackCandidates()
              }

              plannedPhotosInBlock = estimatePlannedFromChosen(chosenForBlock.length)

              for (const ch of chosenForBlock) {
                emitRasterCrop({
                  tightViewportStrip: ch.tightViewportStrip,
                  inkRatioEffective: inkRatio,
                  subFromHorizSplit: ch.subFromHorizSplit,
                  cropTightenSkipped: ch.cropTightenSkipped,
                  subtype: ch.subtype,
                  lowConfidence: ch.kind !== 'strong',
                  forcedBlockFallback: Boolean(ch.forcedBlockFallback),
                  forcedWidePlate: Boolean(ch.forcedWidePlate),
                  rasterReviewCrop: ch.kind === 'review',
                })
              }

            } finally {
              releaseTransientCanvas(strip)
            }

            const acceptable = rasterAttemptRowsAcceptable(segmentInsertsForAttempt)
            const lastAtt = attIx === ALTBERICHT_RASTER_MAX_BLOCK_ANALYSIS_ATTEMPTS - 1
            if (acceptable || lastAtt) {
              if (acceptable) {
                blockFinalStatus = deriveQualityStatusFromRows(segmentInsertsForAttempt)
                finalSegmentRows = enrichSegmentRowsWithBlockMeta(segmentInsertsForAttempt, {
                  attemptCount: attemptsUsedFinal,
                  blockAnalysisFinalStatus: blockFinalStatus,
                  qualityStatus: blockFinalStatus,
                })
              } else if (rawSx >= 0) {
                /** Kein gültiger Foto-Anker: kein Platten-Positionsausschnitt — nur Rohstreifen + Review. */
                blockFinalStatus = 'needs_review'
                finalSegmentRows = []
              } else {
                blockFinalStatus = 'failed'
                finalSegmentRows = []
              }
              break attemptLoop
            }
          }

          if (rawSx >= 0) {
            const rawReflectsBlockQuality = finalSegmentRows.length === 0
            const rawBlockAnalysisStatus: RasterPhotoBlockQualityStatus = rawReflectsBlockQuality
              ? blockFinalStatus
              : 'ok'
            const rawQualityStatus: RasterPhotoBlockQualityStatus = rawReflectsBlockQuality
              ? blockFinalStatus
              : 'ok'
            inserts.push({
              job_id: jobId,
              file_id: fileId,
              page_number: pageNumber,
              image_index: computeAltberichtRasterRawCropImageIndex(block.globalRowIndex),
              scan_version: ALTBERICHT_RASTER_SCAN_VERSION,
              op_kind: ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP,
              suggested_staging_object_id: block.stagingRowId,
              linked_staging_object_id: null,
              user_intent: 'unreviewed',
              preview_storage_path: null,
              scan_meta_json: {
                v: 2,
                rasterSource: 'block_raw_crop',
                source: 'block_raw_crop',
                photoAnalysis: 'viewport_crop_v2',
                viewportScaleUsed: ALTBERICHT_RASTER_VIEWPORT_SCALE,
                cropViewportPx: { sx: rawSx, sy: rawSy, sw: rawSw, sh: rawSh },
                blockIndexOnPage: block.blockIndexOnPage,
                globalRowIndex: block.globalRowIndex,
                photoIndexInBlock: 0,
                logicalPhotoKey: `${block.globalRowIndex}.raw`,
                confidence: 0.12,
                subtype: 'block_raw_safety',
                pageWidthPdf: pageW,
                pageHeightPdf: block.pageHeight,
                blockAnalysisFinalStatus: rawBlockAnalysisStatus,
                qualityStatus: rawQualityStatus,
                attemptCount: attemptsUsedFinal,
              },
            })
          }

          inserts.push(...finalSegmentRows)
          await options.onPersistBlock?.(inserts.slice(blockInsertSliceStart))
          await options.yieldToMain?.()
          rasterCompletedBlocks += 1
        }
      } finally {
        releaseTransientCanvas(pageCanvas)
        try {
          page?.cleanup()
        } catch {
          /* ignore pdf.js cleanup quirks */
        }
      }
    }
  } finally {
    void doc.destroy()
  }

  /** image_index konsistent umbiegen: pro Block laufende 1..n (computeAltberichtRasterImageIndex bereits so). */
  return { inserts }
}
