export type MandantFormWizardStep4MailversandProps = {
  mailProvider: string
  mailMonthlyLimit: string
  mailFromName: string
  mailFromEmail: string
  mailReplyTo: string
  onMailProviderChange: (value: string) => void
  onMailMonthlyLimitChange: (value: string) => void
  onMailFromNameChange: (value: string) => void
  onMailFromEmailChange: (value: string) => void
  onMailReplyToChange: (value: string) => void
}

export const MandantFormWizardStep4Mailversand = ({
  mailProvider,
  mailMonthlyLimit,
  mailFromName,
  mailFromEmail,
  mailReplyTo,
  onMailProviderChange,
  onMailMonthlyLimitChange,
  onMailFromNameChange,
  onMailFromEmailChange,
  onMailReplyToChange,
}: MandantFormWizardStep4MailversandProps) => {
  return (
    <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Schritt 4: Mailversand</h3>
      <p className="text-xs text-slate-600" id="wizard-step4-hint">
        Monatslimit mindestens <strong>1</strong>. Absender- und Reply-To-E-Mail nur ausfüllen, wenn sie gültig sind
        (sonst leer lassen).
      </p>
      <select
        value={mailProvider}
        onChange={(e) => onMailProviderChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
        aria-label="Mail-Provider"
      >
        <option value="resend">Resend</option>
        <option value="smtp">SMTP</option>
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
        autoComplete="organization"
      />
      <input
        type="email"
        value={mailFromEmail}
        onChange={(e) => onMailFromEmailChange(e.target.value)}
        placeholder="Absender-E-Mail"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
        aria-describedby="wizard-step4-hint"
        autoComplete="email"
      />
      <div>
        <label htmlFor="wizard-mail-reply-to" className="block text-xs font-medium text-slate-700 mb-1">
          Reply-To E-Mail
        </label>
        <input
          id="wizard-mail-reply-to"
          type="email"
          value={mailReplyTo}
          onChange={(e) => onMailReplyToChange(e.target.value)}
          placeholder="Optional"
          className="w-full px-3 py-2 rounded-lg border border-slate-300"
          aria-describedby="wizard-step4-hint wizard-step4-followup"
          autoComplete="email"
        />
      </div>
      <p id="wizard-step4-followup" className="text-[11px] text-slate-600 leading-relaxed">
        API-Key/SMTP-Passwort, Testmail und Mailvorlagen werden nach dem Anlegen im Bereich Mandant bearbeiten →
        Mailversand gepflegt.
      </p>
    </div>
  )
}
