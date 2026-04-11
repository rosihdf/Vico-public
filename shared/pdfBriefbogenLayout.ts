/**
 * Inhaltsbereich für PDFs mit hochgeladenem Briefbogen (Kopf-/Fußgrafik).
 * Orientierung DIN 5008 (Form A, vereinfacht): Text nur im Brieffeld, Kopf- und Fußzone frei.
 * Kein Muss-Match zur Millimeter jedes individuellen Layouts – sinnvoller Standard für Überschneidungen zu vermeiden.
 */
export type BriefbogenDinMarginsMm = {
  /** Abstand oberer Blattrand bis erster Text (unterhalb Firmenkopf/Falzmarken-Bereich). */
  top: number
  /** Reserviert für Fußzeile (z. B. Bank, Seitenzahl). */
  bottom: number
  /** Linker Textanfang (DIN üblich ~25 mm). */
  left: number
  /** Rechter Rand bis Textende. */
  right: number
}

/** Typische Werte für A4 mit grafischem Briefbogen (nicht-absolut messerscharf). */
export const DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM: BriefbogenDinMarginsMm = {
  top: 50,
  bottom: 24,
  left: 25,
  right: 20,
}

/** Sichere, auf eine Dezimale gerundete Werte für Persistenz/UI (0–120 mm). */
export const clampBriefbogenPdfMargins = (m: BriefbogenDinMarginsMm): BriefbogenDinMarginsMm => {
  const c = (x: number) => Math.min(120, Math.max(0, Math.round(Number(x) * 10) / 10))
  return {
    top: c(m.top),
    bottom: c(m.bottom),
    left: c(m.left),
    right: c(m.right),
  }
}

/** Mindest-Breite/Höhe für sinnvollen PDF-Text (A4 bzw. Quer). */
export const briefbogenMarginsFitA4Portrait = (m: BriefbogenDinMarginsMm): boolean =>
  m.left + m.right < 200 && m.top + m.bottom < 280

export const briefbogenMarginsFitA4Landscape = (m: BriefbogenDinMarginsMm): boolean =>
  m.left + m.right < 285 && m.top + m.bottom < 195

export type PdfContentBox = {
  left: number
  top: number
  textWidth: number
  /** Erste Text-Baseline-Y (≈ margin top). */
  yStart: number
  /** Letzte sinnvolle Y-Position für Fließtext/Inhalt (oberhalb Fußbereich). */
  yMax: number
}

/**
 * @param pageW/pageH – jsPDF pageSize (Portrait: 210×297, Landscape: 297×210)
 */
export const layoutForBriefbogenDin = (
  pageW: number,
  pageH: number,
  m: BriefbogenDinMarginsMm = DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM
): PdfContentBox => ({
  left: m.left,
  top: m.top,
  textWidth: Math.max(20, pageW - m.left - m.right),
  yStart: m.top,
  yMax: pageH - m.bottom,
})

/**
 * Folgeseite mit Briefbogen-Vorlage ohne Briefkopf: nur kleiner oberer Abstand,
 * links/rechts/unten wie Erstseite (Fußzeile der Vorlage bleibt frei).
 */
export const DEFAULT_BRIEFBOGEN_FOLLOW_PAGE_TOP_MM = 15

export const layoutForBriefbogenDinFollowPage = (
  pageW: number,
  pageH: number,
  m: BriefbogenDinMarginsMm,
  topMm: number = DEFAULT_BRIEFBOGEN_FOLLOW_PAGE_TOP_MM
): PdfContentBox => {
  const t = Math.min(120, Math.max(0, Math.round(Number(topMm) * 10) / 10))
  return {
    left: m.left,
    top: t,
    textWidth: Math.max(20, pageW - m.left - m.right),
    yStart: t,
    yMax: pageH - m.bottom,
  }
}

/** Kompakte Ränder ohne Mandanten-Briefbogen (bisheriges Verhalten pro Generator). */
export const layoutPlain = (
  pageW: number,
  pageH: number,
  marginMm: number
): PdfContentBox => ({
  left: marginMm,
  top: marginMm,
  textWidth: Math.max(20, pageW - 2 * marginMm),
  yStart: marginMm,
  yMax: pageH - marginMm,
})
