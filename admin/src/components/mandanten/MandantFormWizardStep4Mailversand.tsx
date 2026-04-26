export type MandantFormWizardStep4MailversandProps = {
  mailProvider: string
  mailMonthlyLimit: string
  mailFromName: string
  mailFromEmail: string
  onMailProviderChange: (value: string) => void
  onMailMonthlyLimitChange: (value: string) => void
  onMailFromNameChange: (value: string) => void
  onMailFromEmailChange: (value: string) => void
}

export function MandantFormWizardStep4Mailversand({
  mailProvider,
  mailMonthlyLimit,
  mailFromName,
  mailFromEmail,
  onMailProviderChange,
  onMailMonthlyLimitChange,
  onMailFromNameChange,
  onMailFromEmailChange,
}: MandantFormWizardStep4MailversandProps) {
  return (
    <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Schritt 4: Mailversand</h3>
      <p className="text-xs text-slate-600" id="wizard-step4-hint">
        Monatslimit mindestens <strong>1</strong>. Absender-E-Mail nur ausfüllen, wenn sie gültig ist (sonst leer lassen).
      </p>
      <select
        value={mailProvider}
        onChange={(e) => onMailProviderChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
      >
        <option value="resend">Resend</option>
        <option value="custom">Eigener Provider (vorbereitet)</option>
      </select>
      <input
        type="number"
        min={1}
        value={mailMonthlyLimit}
        onChange={(e) => onMailMonthlyLimitChange(e.target.value)}
        placeholder="Monatslimit"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
        aria-describedby="wizard-step4-hint"
      />
      <input
        type="text"
        value={mailFromName}
        onChange={(e) => onMailFromNameChange(e.target.value)}
        placeholder="Absendername"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
      />
      <input
        type="email"
        value={mailFromEmail}
        onChange={(e) => onMailFromEmailChange(e.target.value)}
        placeholder="Absender-E-Mail"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
      />
    </div>
  )
}
