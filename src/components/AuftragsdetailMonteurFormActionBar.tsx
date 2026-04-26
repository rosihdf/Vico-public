import { Fragment } from 'react'
import { AppButton } from './ui'

export type AuftragsdetailMonteurFormActionBarProps = {
  showSaveButton: boolean
  saveDisabled: boolean
  saveBusy: boolean
  showCompleteButton: boolean
  onOpenCompleteDialog: () => void
  showEmailToCustomerButton: boolean
  emailToCustomerSending: boolean
  onSendMonteurReportEmail: () => void
  showGenerateMonteurPdfButton: boolean
  onGenerateMonteurPdf: () => void
  showParkSection: boolean
  parkDisabled: boolean
  onPark: () => void
}

export function AuftragsdetailMonteurFormActionBar({
  showSaveButton,
  saveDisabled,
  saveBusy,
  showCompleteButton,
  onOpenCompleteDialog,
  showEmailToCustomerButton,
  emailToCustomerSending,
  onSendMonteurReportEmail,
  showGenerateMonteurPdfButton,
  onGenerateMonteurPdf,
  showParkSection,
  parkDisabled,
  onPark,
}: AuftragsdetailMonteurFormActionBarProps) {
  return (
    <Fragment>
      <div className="flex flex-wrap gap-2 pt-2 pb-1 items-center">
        {showSaveButton ? (
          <AppButton type="submit" variant="primary" disabled={saveDisabled}>
            {saveBusy ? 'Speichern…' : 'Bericht speichern'}
          </AppButton>
        ) : null}
        {showCompleteButton ? (
          <AppButton
            type="button"
            variant="success"
            disabled={saveBusy}
            onClick={onOpenCompleteDialog}
          >
            Auftrag abschließen
          </AppButton>
        ) : null}
        {showEmailToCustomerButton ? (
          <AppButton
            type="button"
            variant="neutralSolid"
            disabled={emailToCustomerSending}
            onClick={onSendMonteurReportEmail}
            aria-label="Monteursbericht per E-Mail an den Kunden senden"
          >
            {emailToCustomerSending ? 'Senden…' : 'E-Mail an Kunden'}
          </AppButton>
        ) : null}
        {showGenerateMonteurPdfButton ? (
          <AppButton
            type="button"
            variant="outline"
            onClick={onGenerateMonteurPdf}
            title="Monteursbericht aus den aktuellen Angaben als PDF erzeugen, anzeigen und am Auftrag speichern"
          >
            Monteursbericht
          </AppButton>
        ) : null}
      </div>
      {showParkSection ? (
        <div className="flex flex-wrap items-center gap-2 pt-1 mt-1 border-t border-slate-200 dark:border-slate-700">
          <AppButton
            type="button"
            variant="outline"
            disabled={parkDisabled}
            onClick={onPark}
            title="Bericht zwischenspeichern, Auftrag bleibt in Bearbeitung"
          >
            Parken
          </AppButton>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Zwischenstand sichern und zur Auftragsliste zurück
          </span>
        </div>
      ) : null}
    </Fragment>
  )
}
