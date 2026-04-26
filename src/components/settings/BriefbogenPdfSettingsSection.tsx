import type { ChangeEvent } from 'react'
import type { BriefbogenDinMarginsMm } from '../../lib/briefbogenService'
import { DEFAULT_BRIEFBOGEN_FOLLOW_PAGE_TOP_MM } from '../../../shared/pdfBriefbogenLayout'

export type BriefbogenPdfSettingsSectionProps = {
  visible: boolean
  followPageCompactTop: boolean
  onFollowPageCompactTopChange: (checked: boolean) => void
  pdfMargins: BriefbogenDinMarginsMm
  onPdfMarginChange: (key: keyof BriefbogenDinMarginsMm) => (e: ChangeEvent<HTMLInputElement>) => void
  onSavePdfMargins: () => void | Promise<void>
  onResetPdfMargins: () => void | Promise<void>
  error: string | null
  loading: boolean
  marginsSaving: boolean
  previewUrl: string | null
  configured: boolean
  isPdfPreview: boolean
  uploading: boolean
  removing: boolean
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void | Promise<void>
  onRemove: () => void | Promise<void>
}

export const BriefbogenPdfSettingsSection = ({
  visible,
  followPageCompactTop,
  onFollowPageCompactTopChange,
  pdfMargins,
  onPdfMarginChange,
  onSavePdfMargins,
  onResetPdfMargins,
  error,
  loading,
  marginsSaving,
  previewUrl,
  configured,
  isPdfPreview,
  uploading,
  removing,
  onFileChange,
  onRemove,
}: BriefbogenPdfSettingsSectionProps) => {
  if (!visible) return null

  return (
    <section
      className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
      aria-labelledby="briefbogen-heading"
    >
      <h3 id="briefbogen-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
        PDF-Briefbogen (Prüfbericht)
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        <strong className="text-slate-700 dark:text-slate-300">PNG, JPEG</strong> oder{' '}
        <strong className="text-slate-700 dark:text-slate-300">PDF</strong> (ideal A4).{' '}
        <strong className="text-slate-700 dark:text-slate-300">PDF mit zwei Seiten:</strong> Seite 1 = Deckblatt
        (Logo/Kopf), Seite 2 = Folgeseiten (z. B. nur Fußzeile). Einseitiges PDF oder Bild: gleiche
        Vorlage auf allen Seiten.             PDF-Text wird im Brieffeld platziert. Standard sind DIN-5008-orientierte Ränder; darunter können Sie
        die Abstände in Millimetern korrigieren (gilt für Prüfberichte, Monteur-PDF, Arbeitszeit-Exporte mit
        Briefbogen).
      </p>
      <div
        className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600"
        aria-labelledby="briefbogen-margins-heading"
      >
        <h4
          id="briefbogen-margins-heading"
          className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2"
        >
          Textposition im PDF (mm)
        </h4>
        <p id="briefbogen-margins-hint" className="text-xs text-slate-600 dark:text-slate-400 mb-3">
          Oben, unten, links, rechts vom Blattrand bis zum Textbereich. Werte 0–120; Summe der Ränder muss auf
          A4 Hoch- und Querformat einen sichtbaren Bereich lassen.
        </p>
        <label className="flex items-start gap-2 mb-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={followPageCompactTop}
            onChange={(e) => onFollowPageCompactTopChange(e.target.checked)}
            disabled={loading || marginsSaving}
            className="mt-1 rounded border-slate-300 dark:border-slate-600 disabled:opacity-50"
            aria-describedby="briefbogen-follow-top-hint"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-medium">Folgeseiten ohne Briefkopf:</span>{' '}
            Ab Seite 2 den großen oberen Abstand nicht anwenden (Textrand oben{' '}
            {DEFAULT_BRIEFBOGEN_FOLLOW_PAGE_TOP_MM} mm). Aktivieren, wenn Ihre zweite Briefbogen-Seite keinen
            Kopfbereich zeigt.
          </span>
        </label>
        <p id="briefbogen-follow-top-hint" className="sr-only">
          Steuert den oberen Rand für PDF-Seiten ab der zweiten bei mehrseitigen Dokumenten mit Briefbogen.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <label htmlFor="briefbogen-margin-top" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              Oben
            </label>
            <input
              id="briefbogen-margin-top"
              type="number"
              min={0}
              max={120}
              step={0.1}
              value={pdfMargins.top}
              onChange={onPdfMarginChange('top')}
              disabled={loading || marginsSaving}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
              aria-describedby="briefbogen-margins-hint"
              autoComplete="off"
            />
          </div>
          <div>
            <label
              htmlFor="briefbogen-margin-bottom"
              className="block text-xs text-slate-600 dark:text-slate-400 mb-1"
            >
              Unten
            </label>
            <input
              id="briefbogen-margin-bottom"
              type="number"
              min={0}
              max={120}
              step={0.1}
              value={pdfMargins.bottom}
              onChange={onPdfMarginChange('bottom')}
              disabled={loading || marginsSaving}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
              aria-describedby="briefbogen-margins-hint"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="briefbogen-margin-left" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              Links
            </label>
            <input
              id="briefbogen-margin-left"
              type="number"
              min={0}
              max={120}
              step={0.1}
              value={pdfMargins.left}
              onChange={onPdfMarginChange('left')}
              disabled={loading || marginsSaving}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
              aria-describedby="briefbogen-margins-hint"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="briefbogen-margin-right" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              Rechts
            </label>
            <input
              id="briefbogen-margin-right"
              type="number"
              min={0}
              max={120}
              step={0.1}
              value={pdfMargins.right}
              onChange={onPdfMarginChange('right')}
              disabled={loading || marginsSaving}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
              aria-describedby="briefbogen-margins-hint"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onSavePdfMargins()}
            disabled={loading || marginsSaving}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
            aria-label="PDF-Textfeldränder speichern"
          >
            {marginsSaving ? 'Speichern…' : 'Ränder speichern'}
          </button>
          <button
            type="button"
            onClick={() => void onResetPdfMargins()}
            disabled={loading || marginsSaving}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            aria-label="PDF-Textfeldränder auf DIN-Standard zurücksetzen"
          >
            Standard wiederherstellen
          </button>
        </div>
      </div>
      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lade Status…</p>
      ) : (
        <div className="space-y-3">
          {previewUrl && configured && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Vorschau (Ausschnitt)</p>
              <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-900 max-h-48">
                {isPdfPreview ? (
                  <iframe
                    title="Vorschau Mandanten-Briefbogen PDF"
                    src={previewUrl}
                    className="w-full h-48 border-0 bg-white"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Aktueller PDF-Briefbogen"
                    className="w-full h-auto object-top object-contain max-h-48"
                  />
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex">
              <span className="sr-only">Briefbogen hochladen</span>
              <input
                type="file"
                accept="image/png,image/jpeg,application/pdf,.jpg,.jpeg,.png,.pdf"
                onChange={(e) => void onFileChange(e)}
                disabled={uploading}
                className="block text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-vico-primary file:text-white hover:file:bg-vico-primary-hover disabled:opacity-50"
                aria-label="Briefbogen hochladen (PNG, JPEG oder PDF)"
              />
            </label>
            {configured && (
              <button
                type="button"
                onClick={() => void onRemove()}
                disabled={removing || uploading}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                aria-label="Briefbogen entfernen"
              >
                {removing ? 'Entfernen…' : 'Briefbogen entfernen'}
              </button>
            )}
          </div>
          {uploading && (
            <p className="text-sm text-slate-500 dark:text-slate-400" role="status">
              Wird hochgeladen…
            </p>
          )}
        </div>
      )}
    </section>
  )
}
