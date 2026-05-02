/**
 * Raster-Logik für Altbericht-Wartungsberichte.
 *
 * Die geprüften Wartungs-PDFs haben ein **stabiles 6-Blöcke-pro-Seite-Raster**
 * (Position 1–6 auf Seite 1, Position 7–12 auf Seite 2, …). Daraus folgt eine
 * deterministische Abbildung Block → Staging-Zeile, ohne dass komplexe
 * Geometrie-Heuristik nötig ist.
 *
 * Dieses Modul enthält **nur reine Funktionen** (kein DB-, pdf.js- oder UI-Code).
 * Damit ist es vollständig unit-testbar und unabhängig vom Browser nutzbar.
 *
 * Konventionen
 * ------------
 * - PDF-Y wächst nach oben (Origin unten links). Block 1 liegt deshalb am
 *   **oberen** Seitenrand (höchste y-Werte), Block 6 am unteren (kleinste y-Werte).
 * - `blockIndexOnPage` ist 1-basiert (1..6).
 * - `globalRowIndex` ist 1-basiert und entspricht 1:1 `staging.sequence`:
 *     globalRowIndex = (pageNumber - 1) * BLOCKS_PER_PAGE + blockIndexOnPage
 * - `logicalPhotoKey` hat das Format `<globalRowIndex>.<photoIndexInBlock>`,
 *   z. B. `7.2`. `photoIndexInBlock` ist 1-basiert.
 *
 * Das Modul macht **keine** Annahme, dass der C1-Parser das Raster nutzt — der
 * bleibt unverändert. Es liefert nur die Brücke zwischen Block-Position auf der
 * PDF-Seite und der Staging-Zeile, die der Parser erzeugt hat.
 */

/** Feste Anzahl Positionsblöcke je voller PDF-Seite. */
export const ALTBERICHT_RASTER_BLOCKS_PER_PAGE = 6

export type AltberichtRasterBlockBounds = {
  pageNumber: number
  blockIndexOnPage: number
  globalRowIndex: number
  pageHeight: number
  /** PDF-Y der Block-Oberkante (höher = weiter oben auf der Seite). */
  yTop: number
  /** PDF-Y der Block-Unterkante. */
  yBottom: number
}

/**
 * Liefert den globalen Zeilen-Index (= staging.sequence) für einen Block.
 * Wirft einen Fehler bei ungültigen Eingaben — der Aufrufer ist für die Validierung verantwortlich.
 */
export const computeAltberichtGlobalRowIndex = (
  pageNumber: number,
  blockIndexOnPage: number
): number => {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error(`pageNumber muss ≥ 1 sein, war ${pageNumber}`)
  }
  if (
    !Number.isInteger(blockIndexOnPage) ||
    blockIndexOnPage < 1 ||
    blockIndexOnPage > ALTBERICHT_RASTER_BLOCKS_PER_PAGE
  ) {
    throw new Error(
      `blockIndexOnPage muss zwischen 1 und ${ALTBERICHT_RASTER_BLOCKS_PER_PAGE} liegen, war ${blockIndexOnPage}`
    )
  }
  return (pageNumber - 1) * ALTBERICHT_RASTER_BLOCKS_PER_PAGE + blockIndexOnPage
}

/**
 * Umkehrung: aus einem globalen Zeilen-Index die Seite und den Block ermitteln.
 * Liefert `null` bei ungültigen Eingaben.
 */
export const splitAltberichtGlobalRowIndex = (
  globalRowIndex: number
): { pageNumber: number; blockIndexOnPage: number } | null => {
  if (!Number.isInteger(globalRowIndex) || globalRowIndex < 1) return null
  const zero = globalRowIndex - 1
  const pageNumber = Math.floor(zero / ALTBERICHT_RASTER_BLOCKS_PER_PAGE) + 1
  const blockIndexOnPage = (zero % ALTBERICHT_RASTER_BLOCKS_PER_PAGE) + 1
  return { pageNumber, blockIndexOnPage }
}

/**
 * Liefert für einen Block die vertikalen Grenzen in PDF-Koordinaten.
 * Annahme: Seite ist vertikal in {@link ALTBERICHT_RASTER_BLOCKS_PER_PAGE} **gleich** große Bänder geteilt.
 *
 * Block 1 liegt **oben** (yTop = pageHeight), Block 6 liegt **unten** (yBottom = 0).
 */
export const computeAltberichtRasterBlockBounds = (
  pageNumber: number,
  blockIndexOnPage: number,
  pageHeight: number
): AltberichtRasterBlockBounds => {
  if (pageHeight <= 0 || !Number.isFinite(pageHeight)) {
    throw new Error(`pageHeight muss > 0 sein, war ${pageHeight}`)
  }
  const globalRowIndex = computeAltberichtGlobalRowIndex(pageNumber, blockIndexOnPage)
  const bandHeight = pageHeight / ALTBERICHT_RASTER_BLOCKS_PER_PAGE
  const fromTop = blockIndexOnPage - 1
  const yTop = pageHeight - fromTop * bandHeight
  const yBottom = pageHeight - (fromTop + 1) * bandHeight
  return {
    pageNumber,
    blockIndexOnPage,
    globalRowIndex,
    pageHeight,
    yTop,
    yBottom,
  }
}

/**
 * Liefert für eine y-Koordinate (PDF-Coords, Origin unten links) den zugehörigen
 * Block-Index 1..6. Werte außerhalb der Seite werden auf den Rand-Block geklemmt
 * (yTop ≥ pageHeight → 1, yBottom ≤ 0 → 6).
 */
export const assignAltberichtRasterBlockIndex = (
  pdfY: number,
  pageHeight: number
): number => {
  if (pageHeight <= 0 || !Number.isFinite(pageHeight)) return 1
  if (!Number.isFinite(pdfY)) return 1
  const fromTop = pageHeight - pdfY
  if (fromTop <= 0) return 1
  if (fromTop >= pageHeight) return ALTBERICHT_RASTER_BLOCKS_PER_PAGE
  const idxZero = Math.floor((fromTop / pageHeight) * ALTBERICHT_RASTER_BLOCKS_PER_PAGE)
  const idx = idxZero + 1
  if (idx < 1) return 1
  if (idx > ALTBERICHT_RASTER_BLOCKS_PER_PAGE) return ALTBERICHT_RASTER_BLOCKS_PER_PAGE
  return idx
}

/**
 * Liefert alle 6 Block-Bounds einer Seite in Reihenfolge 1..6.
 */
export const computeAllAltberichtRasterBlockBoundsForPage = (
  pageNumber: number,
  pageHeight: number
): AltberichtRasterBlockBounds[] => {
  const out: AltberichtRasterBlockBounds[] = []
  for (let b = 1; b <= ALTBERICHT_RASTER_BLOCKS_PER_PAGE; b += 1) {
    out.push(computeAltberichtRasterBlockBounds(pageNumber, b, pageHeight))
  }
  return out
}

/**
 * Logischer Foto-Schlüssel `<globalRowIndex>.<photoIndexInBlock>`, sichtbar in
 * UI / Debug / scan_meta_json. `photoIndexInBlock` ist 1-basiert.
 */
export const formatAltberichtLogicalPhotoKey = (
  globalRowIndex: number,
  photoIndexInBlock: number
): string => {
  if (!Number.isInteger(globalRowIndex) || globalRowIndex < 1) {
    throw new Error(`globalRowIndex muss ≥ 1 sein, war ${globalRowIndex}`)
  }
  if (!Number.isInteger(photoIndexInBlock) || photoIndexInBlock < 1) {
    throw new Error(`photoIndexInBlock muss ≥ 1 sein, war ${photoIndexInBlock}`)
  }
  return `${globalRowIndex}.${photoIndexInBlock}`
}

/**
 * Umkehrung: parst einen Foto-Schlüssel zurück. Liefert `null` bei ungültigem Format.
 */
export const parseAltberichtLogicalPhotoKey = (
  key: string
): { globalRowIndex: number; photoIndexInBlock: number } | null => {
  const m = /^(\d{1,4})\.(\d{1,3})$/.exec(key.trim())
  if (!m) return null
  const globalRowIndex = Number(m[1])
  const photoIndexInBlock = Number(m[2])
  if (
    !Number.isInteger(globalRowIndex) ||
    globalRowIndex < 1 ||
    !Number.isInteger(photoIndexInBlock) ||
    photoIndexInBlock < 1
  ) {
    return null
  }
  return { globalRowIndex, photoIndexInBlock }
}

/**
 * Reservierter Wert für `op_kind`, der vom Raster-Modul stammt (kein
 * pdf.js-Operator, sondern ein gerenderter Block-Ausschnitt).
 */
export const ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP = 'block_crop' as const

/**
 * Reservierte `scan_version`, die das Raster-Modul für eingetragene
 * `altbericht_import_embedded_image`-Stubs nutzt. So bleiben Operator-Scan-Daten
 * (`pdfjs_operator_v3_args_first`) und Raster-Daten klar trennbar.
 */
export const ALTBERICHT_RASTER_SCAN_VERSION = 'raster_block_v2_viewport_photo' as const

/**
 * Reservierter `image_index`-Bereich für Raster-Stubs, damit die Unique-Constraint
 * (file_id, page_number, image_index) nicht mit Operator-Scan-Werten kollidiert
 * (Operator-Scan nutzt 0..N).
 *
 * Schema:  image_index = RASTER_IMAGE_INDEX_BASE + blockIndexOnPage * 100 + photoIndexInBlock
 * Beispiel: Block 2, Foto 1 → 1000 + 200 + 1 = 1201
 */
export const ALTBERICHT_RASTER_IMAGE_INDEX_BASE = 1000

/**
 * Separater `image_index`-Bereich für Stufe-1-Sicherheits-Crop (`block_raw_crop`).
 * Pro globaler Zeile genau ein Slot: `3000 + globalRowIndex` (kollidiert nicht mit
 * {@link computeAltberichtRasterImageIndex}, solange `globalRowIndex < 2000`).
 */
export const ALTBERICHT_RASTER_RAW_CROP_IMAGE_INDEX_BASE = 3000

export const computeAltberichtRasterRawCropImageIndex = (globalRowIndex: number): number => {
  if (!Number.isInteger(globalRowIndex) || globalRowIndex < 1 || globalRowIndex > 50_000) {
    throw new Error(`globalRowIndex für Raw-Crop-Index muss 1..50000 sein, war ${globalRowIndex}`)
  }
  return ALTBERICHT_RASTER_RAW_CROP_IMAGE_INDEX_BASE + globalRowIndex
}

export const isAltberichtRasterRawCropImageIndex = (imageIndex: number): boolean =>
  Number.isInteger(imageIndex) &&
  imageIndex > ALTBERICHT_RASTER_RAW_CROP_IMAGE_INDEX_BASE &&
  imageIndex <= ALTBERICHT_RASTER_RAW_CROP_IMAGE_INDEX_BASE + 50_000

export const computeAltberichtRasterImageIndex = (
  blockIndexOnPage: number,
  photoIndexInBlock: number
): number => {
  if (
    !Number.isInteger(blockIndexOnPage) ||
    blockIndexOnPage < 1 ||
    blockIndexOnPage > ALTBERICHT_RASTER_BLOCKS_PER_PAGE
  ) {
    throw new Error(`blockIndexOnPage muss 1..${ALTBERICHT_RASTER_BLOCKS_PER_PAGE} sein`)
  }
  if (!Number.isInteger(photoIndexInBlock) || photoIndexInBlock < 1 || photoIndexInBlock > 99) {
    throw new Error(`photoIndexInBlock muss 1..99 sein`)
  }
  return ALTBERICHT_RASTER_IMAGE_INDEX_BASE + blockIndexOnPage * 100 + photoIndexInBlock
}

/**
 * Erkennt, ob ein DB-`image_index` aus dem Raster-Bereich stammt. Hilft im UI,
 * Operator-Scan-Reihen von Raster-Block-Crops zu unterscheiden, ohne `scan_version`
 * lesen zu müssen.
 */
export const isAltberichtRasterImageIndex = (imageIndex: number): boolean =>
  Number.isInteger(imageIndex) &&
  imageIndex >= ALTBERICHT_RASTER_IMAGE_INDEX_BASE + 100 + 1 &&
  imageIndex <= ALTBERICHT_RASTER_IMAGE_INDEX_BASE + ALTBERICHT_RASTER_BLOCKS_PER_PAGE * 100 + 99
