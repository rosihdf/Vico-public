export type MandantFormWizardStep3RechtlichesProps = {
  impressumCompanyName: string
  impressumAddress: string
  datenschutzContactEmail: string
  onImpressumCompanyNameChange: (value: string) => void
  onImpressumAddressChange: (value: string) => void
  onDatenschutzContactEmailChange: (value: string) => void
}

export function MandantFormWizardStep3Rechtliches({
  impressumCompanyName,
  impressumAddress,
  datenschutzContactEmail,
  onImpressumCompanyNameChange,
  onImpressumAddressChange,
  onDatenschutzContactEmailChange,
}: MandantFormWizardStep3RechtlichesProps) {
  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Schritt 3: Rechtliches</h3>
      <p className="text-xs text-slate-600" id="wizard-step3-hint">
        Alles optional. Wenn Sie eine Datenschutz-E-Mail eintragen, muss sie gültig sein.
      </p>
      <input
        type="text"
        value={impressumCompanyName}
        onChange={(e) => onImpressumCompanyNameChange(e.target.value)}
        placeholder="Impressum: Firmenname"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
      />
      <textarea
        value={impressumAddress}
        onChange={(e) => onImpressumAddressChange(e.target.value)}
        placeholder="Impressum: Adresse"
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
      />
      <input
        type="email"
        value={datenschutzContactEmail}
        onChange={(e) => onDatenschutzContactEmailChange(e.target.value)}
        placeholder="Datenschutz Kontakt-E-Mail"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
        aria-describedby="wizard-step3-hint"
      />
    </div>
  )
}
