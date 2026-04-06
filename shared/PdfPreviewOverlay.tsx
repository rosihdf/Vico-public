import { useEffect } from 'react'

export type PdfPreviewState = { url: string; title: string; revokeOnClose: boolean } | null

type PdfPreviewOverlayProps = {
  state: PdfPreviewState
  onClose: () => void
}

const PdfPreviewOverlay = ({ state, onClose }: PdfPreviewOverlayProps) => {
  useEffect(() => {
    if (!state) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state, onClose])

  if (!state) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/60"
      role="dialog"
      aria-modal
      aria-labelledby="pdf-preview-overlay-title"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 text-white shrink-0">
        <h2 id="pdf-preview-overlay-title" className="text-sm font-medium truncate min-w-0">
          {state.title}
        </h2>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={state.url}
            download
            className="text-sm text-sky-300 hover:text-sky-200 underline"
            aria-label="PDF herunterladen"
          >
            Herunterladen
          </a>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-medium bg-white text-slate-900 hover:bg-slate-100"
            onClick={onClose}
            aria-label="PDF-Vorschau schließen"
          >
            Schließen
          </button>
        </div>
      </div>
      <iframe title={state.title} src={state.url} className="flex-1 min-h-0 w-full bg-white border-0" />
    </div>
  )
}

export default PdfPreviewOverlay
