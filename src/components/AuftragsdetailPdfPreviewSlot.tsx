import PdfPreviewOverlay, { type PdfPreviewState } from './PdfPreviewOverlay'

export type { PdfPreviewState }

export type AuftragsdetailPdfPreviewSlotProps = {
  state: PdfPreviewState
  onClose: () => void
}

/** Vollbild-PDF-Vorschau für die Auftragsdetail-Seite; State und Schließen-Logik bleiben im Parent. */
export function AuftragsdetailPdfPreviewSlot({ state, onClose }: AuftragsdetailPdfPreviewSlotProps) {
  return <PdfPreviewOverlay state={state} onClose={onClose} />
}
