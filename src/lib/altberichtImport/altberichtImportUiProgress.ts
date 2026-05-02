/**
 * Fortschritts-Updates für die Altbericht-Import-Oberfläche (Upload / Parse / Bildscan).
 */

/** Sechs sichtbare Hauptschritte (Mobile / Standard). */
export const ALTBERICHT_IMPORT_UI_PHASE_TOTAL = 6

export type AltberichtImportUiProgressPayload = {
  /** 0–100, vor Abschluss oft &lt; 100 */
  percent: number
  statusLine: string
  /** 1-basiert, max. ALTBERICHT_IMPORT_UI_PHASE_TOTAL */
  phaseIndex: number
  phaseTotal: typeof ALTBERICHT_IMPORT_UI_PHASE_TOTAL
  /** Nur Expertenmodus sinnvoll */
  expertDetailLines?: string[]
}

export type AltberichtImportUiProgressCallback = (update: AltberichtImportUiProgressPayload) => void

export type AltberichtImportParseStats = {
  positionCount: number
  embeddedImageScanCount: number
  /** Persistierte Block-/Raster-Fotos (`op_kind` block_crop), unabhängig vom PDF-Operator-Bildscan. */
  rasterPositionPhotoCount: number
  matchReusedCount: number
}

const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)))

/**
 * Fortschritt innerhalb eines Parse-Laufs einer Datei (6 Phasen), optional über mehrere Dateien gemittelt.
 */
export const buildParseProgressPayload = (args: {
  phaseIndex: number
  statusLine: string
  fileIndex: number
  fileTotal: number
  expertDetailLines?: string[]
}): AltberichtImportUiProgressPayload => {
  const { phaseIndex, statusLine, fileIndex, fileTotal, expertDetailLines } = args
  const t = ALTBERICHT_IMPORT_UI_PHASE_TOTAL
  const phaseFrac = (phaseIndex - 1) / t + 1 / (2 * t)
  let percent: number
  if (fileTotal <= 1) {
    percent = phaseFrac * 100
  } else {
    const fi = Math.min(fileIndex, fileTotal - 1)
    percent = (fi / fileTotal + phaseFrac / fileTotal) * 100
  }
  const line =
    fileTotal > 1 ? `Datei ${Math.min(fileIndex + 1, fileTotal)} von ${fileTotal}: ${statusLine}` : statusLine
  return {
    percent: clampPct(Math.min(99, percent)),
    statusLine: line,
    phaseIndex,
    phaseTotal: t,
    expertDetailLines,
  }
}

export const buildUploadProgressPayload = (args: {
  fileIndex: number
  fileTotal: number
  fileLabel: string
}): AltberichtImportUiProgressPayload => {
  const { fileIndex, fileTotal, fileLabel } = args
  const frac = fileTotal > 0 ? (fileIndex + 0.5) / fileTotal : 0.5
  return {
    percent: clampPct(8 + frac * 82),
    statusLine:
      fileTotal > 1
        ? `Datei wird hochgeladen (${fileIndex + 1} von ${fileTotal}): ${fileLabel}`
        : `Datei wird hochgeladen: ${fileLabel}`,
    phaseIndex: 1,
    phaseTotal: ALTBERICHT_IMPORT_UI_PHASE_TOTAL,
  }
}
