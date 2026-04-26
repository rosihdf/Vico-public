export type MandantFormEditMailSectionProps = {
  showEmailUsageBanner: boolean
  emailUsageMonth: string
  emailSentOk: number
  emailSentFailed: number
  mailMonthlyLimit: string
  mailProvider: string
  mailFromName: string
  mailFromEmail: string
  mailReplyTo: string
  onMailProviderChange: (value: string) => void
  onMailMonthlyLimitChange: (value: string) => void
  onMailFromNameChange: (value: string) => void
  onMailFromEmailChange: (value: string) => void
  onMailReplyToChange: (value: string) => void
}

export function MandantFormEditMailSection({
  showEmailUsageBanner,
  emailUsageMonth,
  emailSentOk,
  emailSentFailed,
  mailMonthlyLimit,
  mailProvider,
  mailFromName,
  mailFromEmail,
  mailReplyTo,
  onMailProviderChange,
  onMailMonthlyLimitChange,
  onMailFromNameChange,
  onMailFromEmailChange,
  onMailReplyToChange,
}: MandantFormEditMailSectionProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Mailversand (Resend / Provider-Vorbereitung)</h3>
      {showEmailUsageBanner ? (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p>
            Aktueller Monat ({emailUsageMonth}): <strong>{emailSentOk}</strong> erfolgreich /{' '}
            <strong>{emailSentFailed}</strong> fehlgeschlagen / Limit{' '}
            <strong>{Math.max(1, parseInt(mailMonthlyLimit, 10) || 3000)}</strong>
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="mail_provider" className="block text-sm font-medium text-slate-700 mb-1">
            Provider
          </label>
          <select
            id="mail_provider"
            value={mailProvider}
            onChange={(e) => onMailProviderChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          >
            <option value="resend">Resend</option>
            <option value="custom">Eigener Provider (vorbereitet)</option>
          </select>
        </div>
        <div>
          <label htmlFor="mail_monthly_limit" className="block text-sm font-medium text-slate-700 mb-1">
            Monatslimit
          </label>
          <input
            id="mail_monthly_limit"
            type="number"
            min={1}
            value={mailMonthlyLimit}
            onChange={(e) => onMailMonthlyLimitChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
        </div>
        <div>
          <label htmlFor="mail_from_name" className="block text-sm font-medium text-slate-700 mb-1">
            Absendername
          </label>
          <input
            id="mail_from_name"
            type="text"
            value={mailFromName}
            onChange={(e) => onMailFromNameChange(e.target.value)}
            placeholder="Vico Türen & Tore"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
        </div>
        <div>
          <label htmlFor="mail_from_email" className="block text-sm font-medium text-slate-700 mb-1">
            Absender-E-Mail
          </label>
          <input
            id="mail_from_email"
            type="email"
            value={mailFromEmail}
            onChange={(e) => onMailFromEmailChange(e.target.value)}
            placeholder="noreply@firma.de"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="mail_reply_to" className="block text-sm font-medium text-slate-700 mb-1">
            Reply-To
          </label>
          <input
            id="mail_reply_to"
            type="email"
            value={mailReplyTo}
            onChange={(e) => onMailReplyToChange(e.target.value)}
            placeholder="service@firma.de"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
        </div>
      </div>
    </div>
  )
}
