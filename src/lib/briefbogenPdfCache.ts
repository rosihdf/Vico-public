import {
  fetchBriefbogenLetterheadPagesForPdf,
  fetchBriefbogenPdfTextLayout,
  type BriefbogenLetterheadPages,
  type BriefbogenPdfTextLayout,
} from './briefbogenService'

export type BriefbogenPdfAssets = {
  letterheadPages: BriefbogenLetterheadPages | null
  pdfTextLayout: BriefbogenPdfTextLayout
}

let cached: BriefbogenPdfAssets | null = null
let inFlight: Promise<BriefbogenPdfAssets> | null = null

/**
 * Lädt Briefbogen für PDFs einmal und hält das Ergebnis im Speicher (bis Invalidate).
 * Reduziert Wartezeit bei Monteursbericht / Prüfprotokoll nach erstem Laden deutlich.
 */
export const getBriefbogenPdfAssetsCached = async (): Promise<BriefbogenPdfAssets> => {
  if (cached) return cached
  if (!inFlight) {
    inFlight = Promise.all([
      fetchBriefbogenLetterheadPagesForPdf(),
      fetchBriefbogenPdfTextLayout(),
    ]).then(([letterheadPages, pdfTextLayout]) => {
      const assets: BriefbogenPdfAssets = { letterheadPages, pdfTextLayout }
      cached = assets
      return assets
    })
  }
  try {
    return await inFlight
  } catch (e) {
    inFlight = null
    throw e
  }
}

/** Früh beim Auftrag öffnen aufrufen, damit der erste PDF-Klick nicht auf Briefbogen-IO wartet. */
export const prefetchBriefbogenPdfAssets = (): void => {
  void getBriefbogenPdfAssetsCached().catch(() => {})
}

/** Nach Änderung Briefbogen-Datei oder PDF-Textlayout (Einstellungen). */
export const invalidateBriefbogenPdfAssetsCache = (): void => {
  cached = null
  inFlight = null
}
