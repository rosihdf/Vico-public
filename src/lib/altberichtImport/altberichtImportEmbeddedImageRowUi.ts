import {
  collectPagesMentionedOnStagingRow,
  suggestStagingObjectIdForPage,
} from './altberichtEmbeddedImageSuggest'
import { ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP } from './altberichtRasterGrid'
import type { AltberichtImportEmbeddedImageRow } from './altberichtImportTypes'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'

export type EmbeddedImageLogoLikelihoodLevel = 'none' | 'suspect' | 'likely'

/**
 * Liest den logischen Foto-Schlüssel `<globalRowIndex>.<photoIndexInBlock>` aus
 * dem `scan_meta_json` einer eingebetteten Bildzeile. Liefert `null`, wenn die
 * Zeile nicht aus dem Raster-Workflow stammt oder das Feld fehlt.
 */
export const getEmbeddedImageLogicalPhotoKey = (
  im: AltberichtImportEmbeddedImageRow
): string | null => {
  const raw = im.scan_meta_json
  if (!raw || typeof raw !== 'object') return null
  const k = (raw as { logicalPhotoKey?: unknown }).logicalPhotoKey
  return typeof k === 'string' && k.trim() !== '' ? k.trim() : null
}

/** Globaler Positionsindex aus Raster-`scan_meta_json` (Abgleich mit `staging.sequence`). */
export const getEmbeddedImageRasterGlobalRowIndex = (
  im: AltberichtImportEmbeddedImageRow
): number | null => {
  const raw = im.scan_meta_json
  if (!raw || typeof raw !== 'object') return null
  const g = (raw as { globalRowIndex?: unknown }).globalRowIndex
  return typeof g === 'number' && Number.isFinite(g) ? g : null
}

export const isAltberichtRasterRawCropSafetyRow = (im: AltberichtImportEmbeddedImageRow): boolean => {
  const raw = im.scan_meta_json
  if (!raw || typeof raw !== 'object') return false
  return (raw as { rasterSource?: unknown }).rasterSource === 'block_raw_crop'
}

/**
 * `true`, wenn die Zeile vom Raster-Modul als reiner Positions-/Block-Ausschnitt
 * angelegt wurde (kein „echtes" Operator-Bild aus pdf.js).
 */
export const isAltberichtBlockCropRow = (im: AltberichtImportEmbeddedImageRow): boolean =>
  im.op_kind === ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP

/**
 * Bezeichnung aus `scan_meta_json.subtype`: Raster-Segment vs. Fallback-Streifen.
 */

export const getEmbeddedImageRasterCropSubtypeLabelDe = (
  im: AltberichtImportEmbeddedImageRow
): string | null => {
  if (!isAltberichtBlockCropRow(im)) return null
  const raw = im.scan_meta_json
  if (!raw || typeof raw !== 'object') return null
  const subtype = (raw as { subtype?: unknown }).subtype
  const reviewCrop = (raw as { rasterReviewCrop?: unknown }).rasterReviewCrop === true
  if (reviewCrop) return 'Raster-Bildfläche (unsicher · Prüfung empfohlen)'
  if (subtype === 'strip_fallback' || subtype === 'positionsausschnitt') {
    const widePlate = (raw as { rasterWidePhotoPlate?: unknown }).rasterWidePhotoPlate === true
    const posFb = (raw as { rasterPositionsFallback?: unknown }).rasterPositionsFallback === true
    if (subtype === 'positionsausschnitt' && widePlate)
      return 'Raster-Fallback (volle Platte · prüfen)'
    if ((subtype === 'positionsausschnitt' || subtype === 'strip_fallback') && posFb)
      return 'Raster-Fallback (Positionsausschnitt · prüfen)'
    return 'Positionsausschnitt'
  }
  if (subtype === 'block_raw_safety') return 'Sicherheits-Rohstreifen (Debug)'
  return 'Einzelbild (Raster)'
}

export const getEmbeddedImageLogoLikelihood = (
  im: AltberichtImportEmbeddedImageRow
): EmbeddedImageLogoLikelihoodLevel | null => {
  const raw = im.scan_meta_json
  if (!raw || typeof raw !== 'object') return null
  const l = (raw as { logoLikelihood?: unknown }).logoLikelihood
  if (l === 'likely' || l === 'suspect' || l === 'none') return l
  return null
}

/** Aus Positions-Workflow ausgeblendet (Scan setzt meist user_intent ignore). */
export const isEmbeddedImageLikelyLogo = (im: AltberichtImportEmbeddedImageRow): boolean =>
  getEmbeddedImageLogoLikelihood(im) === 'likely'

export const isEmbeddedImageSuspectLogo = (im: AltberichtImportEmbeddedImageRow): boolean =>
  getEmbeddedImageLogoLikelihood(im) === 'suspect'

export const listEmbeddedImagesForStagingRow = (
  row: AltberichtImportStagingObjectRow,
  allStaging: AltberichtImportStagingObjectRow[],
  images: AltberichtImportEmbeddedImageRow[]
): AltberichtImportEmbeddedImageRow[] => {
  const sameFileStaging = allStaging.filter((x) => x.file_id === row.file_id)
  const rowPages = collectPagesMentionedOnStagingRow(row)

  const filtered = images.filter((im) => {
    if (im.file_id !== row.file_id) return false

    if (isEmbeddedImageLikelyLogo(im)) return false

    /**
     * Raster-Foto-/Block-Zeilen: nur bei Zuordnung zu dieser Staging-Zeile.
     */

    if (isAltberichtBlockCropRow(im)) {
      if (isAltberichtRasterRawCropSafetyRow(im)) return false
      if (im.linked_staging_object_id === row.id) return true
      return im.suggested_staging_object_id === row.id
    }

    if (im.linked_staging_object_id) {

      return im.linked_staging_object_id === row.id
    }

    if (im.suggested_staging_object_id === row.id) return true

    /**
     * Wenn der Parser für genau diese Seite eine andere Zeile per source_refs/media_hints
     * verlinkt, gewinnt der parserbasierte Vorschlag. Wir liefern das Bild dann nicht
     * an alle anderen Zeilen aus, weil die Page-Heuristik dort weniger sicher ist.
     */

    const parserMatch = suggestStagingObjectIdForPage(row.file_id, im.page_number, sameFileStaging)

    if (parserMatch === row.id) return true

    if (parserMatch !== null) return false

    /**

     * Mehrere Positionen können auf derselben PDF-Seite stehen.

     * Bilder dieser Seite werden bei jeder dieser Positionen als „möglicherweise passend"

     * angeboten, solange sie nicht bereits einer anderen Zeile manuell oder per stärkerem

     * Vorschlag zugeordnet sind.

     */

    if (im.suggested_staging_object_id) return false

    if (rowPages.has(im.page_number)) return true

    /**

     * Sequenz-Heuristik (Standardmodus, Parser ohne Page-Anker):

     * Wenn keine Zeile dieselbe Seite explizit referenziert und auch der Bildscan

     * keinen Vorschlag liefert, wird das Bild der Position mit `sequence === page_number`

     * als Vorschlag gezeigt. Klassifikation in der UI bleibt „Möglicherweise passend".

     * Ohne Sequence-Fallback wären Standardmodus-Anwender ohne Einzelbild-Vorschau,

     * obwohl der Bildscan Bilder erkannt hat.

     */

    if (typeof row.sequence === 'number' && row.sequence === im.page_number) return true

    return false

  })

  /** Raster-Zeileneinträge vor Operator-Bildern, damit der Standardworkflow oben liegt. */

  return filtered.sort((a, b) => {

    const blk = Number(isAltberichtBlockCropRow(b)) - Number(isAltberichtBlockCropRow(a))

    if (blk !== 0) return blk

    if (a.page_number !== b.page_number) return a.page_number - b.page_number

    return a.image_index - b.image_index

  })

}

export type AltberichtEmbeddedImagePrimaryKind = 'imported' | 'failed' | 'assigned' | 'ignored' | 'detected'

export const getAltberichtEmbeddedImagePrimaryKind = (
  im: AltberichtImportEmbeddedImageRow
): AltberichtEmbeddedImagePrimaryKind => {
  const st = im.import_status ?? 'not_imported'
  if (st === 'imported') return 'imported'
  if (st === 'failed') return 'failed'
  if (im.user_intent === 'ignore') return 'ignored'
  if (im.user_intent === 'object_photo' || im.user_intent === 'defect_photo') return 'assigned'
  return 'detected'
}

export const primaryKindLabelDe = (k: AltberichtEmbeddedImagePrimaryKind): string => {
  switch (k) {
    case 'imported':
      return 'Übernommen'
    case 'failed':
      return 'Fehler'
    case 'assigned':
      return 'Zugeordnet'
    case 'ignored':
      return 'Ignoriert'
    case 'detected':
      return 'Erkannt'
  }
}

export const shouldCountAltberichtEmbeddedImageForFileStats = (
  im: AltberichtImportEmbeddedImageRow
): boolean => !isAltberichtRasterRawCropSafetyRow(im)

export const describeEmbeddedImageAssignmentReason = (
  im: AltberichtImportEmbeddedImageRow,
  stagingRowId: string
): string => {
  if (im.linked_staging_object_id === stagingRowId) {
    return 'Manuelle Verknüpfung mit dieser Zeile'
  }
  if (im.suggested_staging_object_id === stagingRowId) {
    if (isAltberichtBlockCropRow(im)) {
      return 'Raster-Zuordnung (6-Blöcke je Seite)'
    }
    return 'Automatischer Vorschlag (Seite / Parser)'
  }
  return 'Zuordnung über PDF-Seite und Positions-Reihenfolge'
}

export type AltberichtEmbeddedImageAssignmentConfidence =
  | 'manual'
  | 'suggested'
  | 'page-fallback'
  | 'logo-hidden'

/**
 * Sicherheitsgrad der Zuordnung zur konkreten Staging-Zeile.
 * Reine Lese-Logik, kein I/O, keine Mutation.
 */
export const getAltberichtEmbeddedImageAssignmentConfidence = (
  im: AltberichtImportEmbeddedImageRow,
  stagingRowId: string,
  stagingRowSequence?: number | null
): AltberichtEmbeddedImageAssignmentConfidence => {
  if (isEmbeddedImageLikelyLogo(im)) return 'logo-hidden'
  if (im.linked_staging_object_id === stagingRowId) return 'manual'
  if (im.suggested_staging_object_id === stagingRowId) return 'suggested'
  if (
    isAltberichtBlockCropRow(im) &&
    stagingRowSequence != null &&
    Number.isFinite(stagingRowSequence)
  ) {
    const gri = getEmbeddedImageRasterGlobalRowIndex(im)
    if (gri != null && gri === stagingRowSequence) return 'suggested'
  }
  return 'page-fallback'
}

export const assignmentConfidenceLabelDe = (k: AltberichtEmbeddedImageAssignmentConfidence): string => {
  switch (k) {
    case 'manual':
      return 'Manuell zugeordnet'
    case 'suggested':
      return 'Vorgeschlagen'
    case 'page-fallback':
      return 'Möglicherweise passend'
    case 'logo-hidden':
      return 'Logo/Header (ausgeblendet)'
  }
}

/** Anderer Kandidat derselben Datei/Seite/Index bereits produktiv am gleichen Objekt. */
export const findDuplicateEmbeddedImportForTarget = (
  im: AltberichtImportEmbeddedImageRow,
  allJobImages: AltberichtImportEmbeddedImageRow[],
  targetObjectId: string | null
): AltberichtImportEmbeddedImageRow | null => {
  if (!targetObjectId?.trim()) return null
  const tid = targetObjectId.trim()
  return (
    allJobImages.find(
      (o) =>
        o.id !== im.id &&
        o.file_id === im.file_id &&
        o.page_number === im.page_number &&
        o.image_index === im.image_index &&
        (o.import_status ?? 'not_imported') === 'imported' &&
        (o.target_object_id ?? '').trim() === tid
    ) ?? null
  )
}
