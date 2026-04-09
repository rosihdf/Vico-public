import type { jsPDF } from 'jspdf'

/**
 * Zeichnet den Briefbogen als Vollflächen-Hintergrund auf der **aktuellen** Seite.
 * Muss vor dem eigentlichen Textinhalt aufgerufen werden (spätere Zeichnungen liegen oben).
 * Wird von Haupt-App, Arbeitszeit-Portal und ggf. weiteren PDF-Generatoren genutzt (Phase 2 / J10).
 */
export const paintLetterheadOnCurrentPage = (doc: jsPDF, dataUrl: string): void => {
  if (!dataUrl) return
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const fmt = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
  try {
    doc.addImage(dataUrl, fmt, 0, 0, pageW, pageH)
  } catch {
    /* Briefbogen optional – bei fehlerhaftem Bild einfach ohne Hintergrund weiter */
  }
}

/** Erstseite + optional Folgeseite (z. B. PDF-Vorlage: Seite 1 mit Logo, Seite 2 nur Fußzeile). */
export type LetterheadRasterPages = {
  firstPage: string | null
  /** Wenn null/leer: gleiche Rasterfläche wie firstPage (z. B. einseitiges PNG). */
  followPage: string | null
}

export const pickLetterheadDataUrlForPage = (
  pages: LetterheadRasterPages,
  isFirstPageOfDocument: boolean
): string | null => {
  if (isFirstPageOfDocument) {
    return pages.firstPage
  }
  return pages.followPage ?? pages.firstPage
}

/** Briefbogen auf aktueller jsPDF-Seite – `isFirstPageOfDocument` steuert Erst- vs. Folge-Vorlage. */
export const paintLetterheadRasterOnCurrentPage = (
  doc: jsPDF,
  pages: LetterheadRasterPages,
  isFirstPageOfDocument: boolean
): void => {
  const url = pickLetterheadDataUrlForPage(pages, isFirstPageOfDocument)
  if (url) {
    paintLetterheadOnCurrentPage(doc, url)
  }
}
