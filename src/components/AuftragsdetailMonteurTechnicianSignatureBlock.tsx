import SignatureField from '../SignatureField'

export type AuftragsdetailMonteurTechnicianSignatureBlockProps = {
  showSavedPreview: boolean
  previewUrl: string
  savedAtDisplay: string | null
  onReplaceSavedClick: () => void
  showSignaturePad: boolean
  onSigTechChange: (dataUrl: string | null) => void
  printedTech: string
  onPrintedTechChange: (name: string) => void
}

export function AuftragsdetailMonteurTechnicianSignatureBlock({
  showSavedPreview,
  previewUrl,
  savedAtDisplay,
  onReplaceSavedClick,
  showSignaturePad,
  onSigTechChange,
  printedTech,
  onPrintedTechChange,
}: AuftragsdetailMonteurTechnicianSignatureBlockProps) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4 space-y-4 min-w-0">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Monteur-Unterschrift</p>
      {showSavedPreview ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 dark:text-slate-400">Aktuell gespeicherte Unterschrift</p>
          <img
            src={previewUrl}
            alt="Unterschrift Monteur"
            className="max-h-28 border border-slate-200 dark:border-slate-600 rounded-lg bg-white object-contain"
          />
          {savedAtDisplay ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{savedAtDisplay}</p>
          ) : null}
          <button
            type="button"
            onClick={onReplaceSavedClick}
            className="text-sm font-medium text-vico-primary hover:underline dark:text-sky-400"
            aria-label="Unterschrift ersetzen"
          >
            Unterschrift ersetzen
          </button>
        </div>
      ) : null}
      {showSignaturePad ? (
        <div className="min-w-0">
          <SignatureField
            label="Unterschrift Monteur"
            value={null}
            onChange={onSigTechChange}
            printedName={printedTech}
            onPrintedNameChange={onPrintedTechChange}
          />
        </div>
      ) : null}
    </div>
  )
}
