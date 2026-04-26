import SignatureField from '../SignatureField'
import { AppField, AppTextarea } from './ui'

export type AuftragsdetailMonteurCustomerSignatureBlockProps = {
  showSavedPreview: boolean
  previewUrl: string
  savedAtDisplay: string | null
  onReplaceSavedClick: () => void
  showSignaturePad: boolean
  onSigCustChange: (dataUrl: string | null) => void
  printedCust: string
  onPrintedCustChange: (name: string) => void
  showReasonSection: boolean
  customerSignatureReason: string
  onCustomerSignatureReasonChange: (value: string) => void
  showAssistantMissingReasonAlert: boolean
  showClassicMissingReasonAlert: boolean
}

export function AuftragsdetailMonteurCustomerSignatureBlock({
  showSavedPreview,
  previewUrl,
  savedAtDisplay,
  onReplaceSavedClick,
  showSignaturePad,
  onSigCustChange,
  printedCust,
  onPrintedCustChange,
  showReasonSection,
  customerSignatureReason,
  onCustomerSignatureReasonChange,
  showAssistantMissingReasonAlert,
  showClassicMissingReasonAlert,
}: AuftragsdetailMonteurCustomerSignatureBlockProps) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4 space-y-4 min-w-0">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Kunden-Unterschrift</p>
      {showSavedPreview ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 dark:text-slate-400">Aktuell gespeicherte Unterschrift</p>
          <img
            src={previewUrl}
            alt="Unterschrift Kunde"
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
            label="Unterschrift Kunde"
            value={null}
            onChange={onSigCustChange}
            printedName={printedCust}
            onPrintedNameChange={onPrintedCustChange}
          />
        </div>
      ) : null}
      {showReasonSection ? (
        <div className="min-w-0">
          <AppField label="Grund ohne Kundenunterschrift" htmlFor="cust-sign-reason">
            <AppTextarea
              id="cust-sign-reason"
              value={customerSignatureReason}
              onChange={(e) => onCustomerSignatureReasonChange(e.target.value)}
              placeholder="z. B. Kunde nicht anwesend oder Unterschrift abgelehnt"
              rows={2}
              className="text-base sm:text-sm max-w-full w-full min-w-0"
            />
          </AppField>
          {showAssistantMissingReasonAlert ? (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300" role="alert">
              Ohne Kundenunterschrift bitte einen Grund im Monteurbericht angeben.
            </p>
          ) : null}
          {showClassicMissingReasonAlert ? (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300" role="alert">
              Ohne Kundenunterschrift bitte einen Grund im Monteurbericht angeben.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
