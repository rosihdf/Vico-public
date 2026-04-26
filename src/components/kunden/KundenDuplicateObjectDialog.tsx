import type { Dispatch, SetStateAction } from 'react'
import type { Object as Obj } from '../../types'

export type KundenDuplicateObjectDialogState = {
  open: boolean
  source: Obj | null
  copyPhotos: boolean
  copyProfilePhoto: boolean
  copyDocuments: boolean
  busy: boolean
}

export type KundenDuplicateObjectDialogProps = {
  dialog: KundenDuplicateObjectDialogState
  setDialog: Dispatch<SetStateAction<KundenDuplicateObjectDialogState>>
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

export const KundenDuplicateObjectDialog = ({
  dialog,
  setDialog,
  onClose,
  onConfirm,
}: KundenDuplicateObjectDialogProps) => {
  if (!dialog.open || !dialog.source) return null

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4"
      role="button"
      tabIndex={0}
      onClick={() => onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClose()
        }
      }}
      aria-label="Dialog schließen"
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="dup-object-title"
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full min-w-0 p-4 border border-slate-200 dark:border-slate-600"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="dup-object-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Tür/Tor kopieren
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Es wird eine neue Tür/Tor mit eigener ID angelegt; die Stammdaten werden übernommen. Die Bezeichnung
          erhält den Zusatz „(Duplikat)“, die interne ID einen eindeutigen Suffix. Wählen Sie unten, was zusätzlich
          kopiert werden soll (jeweils eigene Dateien im Speicher).
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-400 text-vico-primary focus:ring-vico-primary"
              checked={dialog.copyProfilePhoto}
              disabled={dialog.busy}
              onChange={(e) =>
                setDialog((d) => (d.source ? { ...d, copyProfilePhoto: e.target.checked } : d))
              }
              aria-describedby="dup-profile-hint"
            />
            <span>
              Profilfoto übernehmen
              <span id="dup-profile-hint" className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Nur sinnvoll, wenn an der Quelle ein Profilbild hinterlegt ist.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-400 text-vico-primary focus:ring-vico-primary"
              checked={dialog.copyPhotos}
              disabled={dialog.busy}
              onChange={(e) =>
                setDialog((d) => (d.source ? { ...d, copyPhotos: e.target.checked } : d))
              }
              aria-describedby="dup-gallery-hint"
            />
            <span>
              Galerie-Fotos übernehmen
              <span id="dup-gallery-hint" className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Normale Objekt-Fotos (Galerie), nicht Profilfoto und nicht Dokumente.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-400 text-vico-primary focus:ring-vico-primary"
              checked={dialog.copyDocuments}
              disabled={dialog.busy}
              onChange={(e) =>
                setDialog((d) => (d.source ? { ...d, copyDocuments: e.target.checked } : d))
              }
              aria-describedby="dup-docs-hint"
            />
            <span>
              Dokumente übernehmen (Zeichnungen, Zertifikate, …)
              <span id="dup-docs-hint" className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Einträge unter „Dokumente zur Tür“ inkl. Datei im Dokumenten-Speicher.
              </span>
            </span>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => onClose()}
            disabled={dialog.busy}
            className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={dialog.busy}
            className="px-4 py-2 min-h-[40px] rounded-lg bg-vico-button dark:bg-vico-primary text-slate-800 dark:text-white font-medium border border-slate-300 dark:border-slate-600 hover:bg-vico-button-hover dark:hover:opacity-90 disabled:opacity-50"
          >
            {dialog.busy ? 'Wird angelegt…' : 'Kopie anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}
