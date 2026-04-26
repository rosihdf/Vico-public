import type { Dispatch, SetStateAction } from 'react'
import type {
  MonteurReportCustomerDeliveryMode,
  PruefprotokollAddressMode,
  WartungChecklisteModus,
} from '../../lib/dataService'

export type MonteurReportPortalChecklistSettingsSectionProps = {
  visible: boolean
  showMonteurPortalOption: boolean
  monteurDeliveryLoaded: boolean
  monteurDeliveryMode: MonteurReportCustomerDeliveryMode
  setMonteurDeliveryMode: Dispatch<SetStateAction<MonteurReportCustomerDeliveryMode>>
  monteurDeliveryError: string | null
  monteurDeliverySaving: boolean
  onSaveMonteurDelivery: () => void | Promise<void>
  portalShareMonteurPdf: boolean
  setPortalShareMonteurPdf: Dispatch<SetStateAction<boolean>>
  portalSharePruefPdf: boolean
  setPortalSharePruefPdf: Dispatch<SetStateAction<boolean>>
  portalTimelineShowPlanned: boolean
  setPortalTimelineShowPlanned: Dispatch<SetStateAction<boolean>>
  portalTimelineShowTermin: boolean
  setPortalTimelineShowTermin: Dispatch<SetStateAction<boolean>>
  portalTimelineShowInProgress: boolean
  setPortalTimelineShowInProgress: Dispatch<SetStateAction<boolean>>
  portalPdfShareError: string | null
  portalPdfShareSaving: boolean
  onSavePortalPdfShare: () => void | Promise<void>
  wartungChecklisteModus: WartungChecklisteModus
  setWartungChecklisteModus: Dispatch<SetStateAction<WartungChecklisteModus>>
  pruefprotokollAddressMode: PruefprotokollAddressMode
  setPruefprotokollAddressMode: Dispatch<SetStateAction<PruefprotokollAddressMode>>
  mangelNeuerAuftragDefault: boolean
  setMangelNeuerAuftragDefault: Dispatch<SetStateAction<boolean>>
  wartungChecklisteError: string | null
  wartungChecklisteSaving: boolean
  onSaveWartungChecklisteSettings: () => void | Promise<void>
}

export const MonteurReportPortalChecklistSettingsSection = ({
  visible,
  showMonteurPortalOption,
  monteurDeliveryLoaded,
  monteurDeliveryMode,
  setMonteurDeliveryMode,
  monteurDeliveryError,
  monteurDeliverySaving,
  onSaveMonteurDelivery,
  portalShareMonteurPdf,
  setPortalShareMonteurPdf,
  portalSharePruefPdf,
  setPortalSharePruefPdf,
  portalTimelineShowPlanned,
  setPortalTimelineShowPlanned,
  portalTimelineShowTermin,
  setPortalTimelineShowTermin,
  portalTimelineShowInProgress,
  setPortalTimelineShowInProgress,
  portalPdfShareError,
  portalPdfShareSaving,
  onSavePortalPdfShare,
  wartungChecklisteModus,
  setWartungChecklisteModus,
  pruefprotokollAddressMode,
  setPruefprotokollAddressMode,
  mangelNeuerAuftragDefault,
  setMangelNeuerAuftragDefault,
  wartungChecklisteError,
  wartungChecklisteSaving,
  onSaveWartungChecklisteSettings,
}: MonteurReportPortalChecklistSettingsSectionProps) => {
  if (!visible) return null

  return (
    <section
      className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
      aria-labelledby="monteur-zustellung-heading"
    >
      <h3
        id="monteur-zustellung-heading"
        className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"
      >
        Monteurbericht an Kunden (nach Auftrags-Abschluss)
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Gilt firmenweit für den Abschluss aus dem Auftrags-Monteursbericht (Tür/Tor-QR). Die Option „Kundenportal“
        steht nur zur Verfügung, wenn das Kundenportal lizenziert ist und am jeweiligen Objekt mindestens ein
        Portal-Zugang mit Sichtbarkeit für Firma/BV existiert; sonst wird beim Abschließen eine Hinweismeldung
        angezeigt und kein Portal-Eintrag erzeugt.
      </p>
      {!monteurDeliveryLoaded ? (
        <p className="text-sm text-slate-500">Lade Einstellung…</p>
      ) : (
        <div className="space-y-3 mb-4">
          {(
            [
              {
                value: 'none' as const,
                label: 'Keine automatische Zustellung',
                hint: 'Nur PDF-Download und Speicherung; der Kunde erhält nichts automatisch.',
              },
              {
                value: 'email_auto' as const,
                label: 'Sofort per E-Mail (PDF im Anhang)',
                hint: 'Nach „Auftrag abschließen“ wird automatisch an die unter Kunde oder BV hinterlegte Prüfbericht-Adresse gesendet (BV hat Vorrang).',
              },
              {
                value: 'email_manual' as const,
                label: 'Manuell per E-Mail (PDF im Anhang)',
                hint: 'Nach dem Abschluss erscheint ein Button „An Kunde senden“ mit gleicher Adresslogik.',
              },
              ...(showMonteurPortalOption
                ? [
                    {
                      value: 'portal_notify' as const,
                      label: 'Kundenportal + Benachrichtigung',
                      hint: 'PDF als Prüfbericht im Portal; Portal-Nutzer werden per E-Mail informiert.',
                    },
                  ]
                : []),
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-600 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <input
                type="radio"
                name="monteur-delivery-mode"
                value={opt.value}
                checked={monteurDeliveryMode === opt.value}
                onChange={() => setMonteurDeliveryMode(opt.value)}
                className="mt-1 w-4 h-4 border-slate-300 text-vico-primary focus:ring-vico-primary"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{opt.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.hint}</span>
              </span>
            </label>
          ))}
          {!showMonteurPortalOption &&
          monteurDeliveryMode === 'portal_notify' ? (
            <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
              In der Datenbank ist „Kundenportal“ gewählt, die Lizenz enthält das Kundenportal derzeit nicht. Bitte
              wählen Sie eine andere Option und speichern Sie.
            </p>
          ) : null}
        </div>
      )}
      {monteurDeliveryError ? (
        <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
          {monteurDeliveryError}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onSaveMonteurDelivery}
        disabled={monteurDeliverySaving || !monteurDeliveryLoaded}
        className="inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
      >
        {monteurDeliverySaving ? 'Speichern…' : 'Monteurbericht-Zustellung speichern'}
      </button>
      {showMonteurPortalOption ? (
        <div className="mt-4 border-t border-slate-200 dark:border-slate-600 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Kundenportal: PDF-Freigaben &amp; Auftrags-Fortschritt
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Unabhängig von der Zustell-Option oben steuern Sie hier PDFs (Monteurbericht vs. Prüfprotokoll) sowie
            Hinweise und eine einfache Zeitleiste zu Aufträgen an sichtbaren Türen im Kundenportal (Seite Berichte).
          </p>
          {!monteurDeliveryLoaded ? (
            <p className="text-sm text-slate-500">Lade Einstellung…</p>
          ) : (
            <>
              <label className="flex items-start gap-3 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={portalShareMonteurPdf}
                  onChange={(e) => setPortalShareMonteurPdf(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                />
                <span className="text-sm text-slate-800 dark:text-slate-100">
                  Monteurbericht-PDF im Portal anzeigen
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={portalSharePruefPdf}
                  onChange={(e) => setPortalSharePruefPdf(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                />
                <span className="text-sm text-slate-800 dark:text-slate-100">
                  Prüfprotokoll-PDF im Portal anzeigen
                </span>
              </label>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-3 mb-2">
                Auftrags-Fortschritt (Banner &amp; Zeitleiste)
              </p>
              <label className="flex items-start gap-3 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={portalTimelineShowPlanned}
                  onChange={(e) => setPortalTimelineShowPlanned(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                />
                <span className="text-sm text-slate-800 dark:text-slate-100">
                  Phase „geplant“ (Status offen) im Portal anzeigen
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={portalTimelineShowTermin}
                  onChange={(e) => setPortalTimelineShowTermin(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                />
                <span className="text-sm text-slate-800 dark:text-slate-100">
                  Geplanten Wartungstermin in der Zeitleiste anzeigen
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={portalTimelineShowInProgress}
                  onChange={(e) => setPortalTimelineShowInProgress(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                />
                <span className="text-sm text-slate-800 dark:text-slate-100">
                  Phase „in Bearbeitung“ / abgeschlossen in der Zeitleiste anzeigen
                </span>
              </label>
              {portalPdfShareError ? (
                <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
                  {portalPdfShareError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={onSavePortalPdfShare}
                disabled={portalPdfShareSaving || !monteurDeliveryLoaded}
                className="inline-flex px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {portalPdfShareSaving ? 'Speichern…' : 'Kundenportal speichern'}
              </button>
            </>
          )}
        </div>
      ) : null}
      <div className="mt-4 border-t border-slate-200 dark:border-slate-600 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          Prüfbericht-Checkliste
        </h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="radio"
              name="checklist-modus"
              checked={wartungChecklisteModus === 'detail'}
              onChange={() => setWartungChecklisteModus('detail')}
              className="w-4 h-4 border-slate-300 text-vico-primary focus:ring-vico-primary"
            />
            Detailmodus
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="radio"
              name="checklist-modus"
              checked={wartungChecklisteModus === 'compact'}
              onChange={() => setWartungChecklisteModus('compact')}
              className="w-4 h-4 border-slate-300 text-vico-primary focus:ring-vico-primary"
            />
            Kompaktmodus
          </label>
        </div>
        <div className="mt-3">
          <label
            htmlFor="pruefprotokoll-address-mode"
            className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
          >
            Prüfprotokoll: Adressblöcke
          </label>
          <select
            id="pruefprotokoll-address-mode"
            value={pruefprotokollAddressMode}
            onChange={(e) => setPruefprotokollAddressMode(e.target.value as PruefprotokollAddressMode)}
            className="w-full max-w-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
          >
            <option value="both">Kunde + Objekt/BV anzeigen (Standard)</option>
            <option value="bv_only">Nur Objekt/BV anzeigen</option>
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Bei Türen direkt unter dem Kunden wird Objekt/BV automatisch ausgeblendet.
          </p>
        </div>
        <label className="mt-3 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={mangelNeuerAuftragDefault}
            onChange={(e) => setMangelNeuerAuftragDefault(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
          />
          <span className="text-sm text-slate-800 dark:text-slate-100">
            Nach Abschluss bei offenem Mangel standardmäßig Folgeauftrag empfehlen
          </span>
        </label>
        {wartungChecklisteError ? (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">{wartungChecklisteError}</p>
        ) : null}
        <button
          type="button"
          onClick={onSaveWartungChecklisteSettings}
          disabled={wartungChecklisteSaving || !monteurDeliveryLoaded}
          className="mt-3 inline-flex px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          {wartungChecklisteSaving ? 'Speichern…' : 'Checkliste-Einstellungen speichern'}
        </button>
      </div>
    </section>
  )
}
