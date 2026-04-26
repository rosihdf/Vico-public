import type { Dispatch, SetStateAction } from 'react'
import type { QrBatchPreset } from '../../lib/generateQrBatchA4Pdf'

export type KundenQrBatchPdfBarProps = {
  visible: boolean
  selectionCount: number
  preset: QrBatchPreset
  onPresetChange: Dispatch<SetStateAction<QrBatchPreset>>
  onClearSelection: () => void
  pdfLoading: boolean
  onDownloadPdf: () => void
}

export const KundenQrBatchPdfBar = ({
  visible,
  selectionCount,
  preset,
  onPresetChange,
  onClearSelection,
  pdfLoading,
  onDownloadPdf,
}: KundenQrBatchPdfBarProps) => {
  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 border-t border-slate-200 dark:border-slate-600 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="A4 QR-Sammel-PDF"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          <strong>{selectionCount}</strong> Objekt(e) für PDF ausgewählt
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <span className="whitespace-nowrap">Etikettgröße</span>
            <select
              value={preset}
              onChange={(e) => onPresetChange(e.target.value as QrBatchPreset)}
              className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm min-h-[40px]"
              aria-label="Etikettgröße für A4"
            >
              <option value="mini">Mini (ca. HERMA 48×25 mm)</option>
              <option value="mid">Mittel (ca. HERMA 52×30 mm)</option>
              <option value="max">Groß (ca. 63×38 mm)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={onClearSelection}
            className="px-3 py-2 min-h-[40px] text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-transparent"
            disabled={pdfLoading}
          >
            Auswahl leeren
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={pdfLoading}
            className="px-4 py-2 min-h-[40px] rounded-lg bg-vico-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pdfLoading ? 'PDF wird erzeugt…' : 'PDF herunterladen'}
          </button>
        </div>
      </div>
    </div>
  )
}
