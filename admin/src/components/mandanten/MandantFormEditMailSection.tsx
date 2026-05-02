import type { TenantMailSecretFlags, TenantMailTemplateKeyPresence } from '../../lib/licensePortalService'
import { computeMailSetupStatusLines } from '../../lib/mandantMailSetupStatus'
import { tenantMailProviderLabelDe } from '../../lib/mailProviderUtils'
import { MandantMailSetupStatus } from './MandantMailSetupStatus'

export type MandantFormEditMailSectionProps = {
  tenantId: string | null
  supabaseUrl: string
  licenseLinked: boolean
  mailTemplatePresence: TenantMailTemplateKeyPresence | null
  mailTemplatesFetchFailed: boolean
  onRefreshMailSetup?: () => void | Promise<void>
  mailSetupRefreshLoading?: boolean
  showEmailUsageBanner: boolean
  emailUsageMonth: string
  emailSentOk: number
  emailSentFailed: number
  mailMonthlyLimit: string
  mailProvider: 'resend' | 'smtp'
  mailFromName: string
  mailFromEmail: string
  mailReplyTo: string
  smtpHost: string
  smtpPort: string
  smtpImplicitTls: boolean
  smtpUsername: string
  smtpPasswordDraft: string
  resendApiKeyDraft: string
  mailSecretFlags: TenantMailSecretFlags | null
  mailSmtpPasswordDirty: boolean
  mailResendKeyDirty: boolean
  testMailTo: string
  testMailLoading: boolean
  testMailOk: string | null
  testMailErr: string | null
  onMailProviderChange: (value: 'resend' | 'smtp') => void
  onMailMonthlyLimitChange: (value: string) => void
  onMailFromNameChange: (value: string) => void
  onMailFromEmailChange: (value: string) => void
  onMailReplyToChange: (value: string) => void
  onSmtpHostChange: (value: string) => void
  onSmtpPortChange: (value: string) => void
  onSmtpImplicitTlsChange: (value: boolean) => void
  onSmtpUsernameChange: (value: string) => void
  onSmtpPasswordDraftChange: (value: string) => void
  onResendApiKeyDraftChange: (value: string) => void
  onTestMailToChange: (value: string) => void
  onSendTestMail: () => void
}

export function MandantFormEditMailSection({
  tenantId,
  supabaseUrl,
  licenseLinked,
  mailTemplatePresence,
  mailTemplatesFetchFailed,
  onRefreshMailSetup,
  mailSetupRefreshLoading = false,
  showEmailUsageBanner,
  emailUsageMonth,
  emailSentOk,
  emailSentFailed,
  mailMonthlyLimit,
  mailProvider,
  mailFromName,
  mailFromEmail,
  mailReplyTo,
  smtpHost,
  smtpPort,
  smtpImplicitTls,
  smtpUsername,
  smtpPasswordDraft,
  resendApiKeyDraft,
  mailSecretFlags,
  mailSmtpPasswordDirty,
  mailResendKeyDirty,
  testMailTo,
  testMailLoading,
  testMailOk,
  testMailErr,
  onMailProviderChange,
  onMailMonthlyLimitChange,
  onMailFromNameChange,
  onMailFromEmailChange,
  onMailReplyToChange,
  onSmtpHostChange,
  onSmtpPortChange,
  onSmtpImplicitTlsChange,
  onSmtpUsernameChange,
  onSmtpPasswordDraftChange,
  onResendApiKeyDraftChange,
  onTestMailToChange,
  onSendTestMail,
}: MandantFormEditMailSectionProps) {
  const mailSetupLines = computeMailSetupStatusLines({
    tenantId,
    mailProvider,
    mailFromEmail,
    smtpHost,
    smtpUsername,
    mailSecretFlags,
    mailResendKeyDirty,
    resendApiKeyDraft,
    mailSmtpPasswordDirty,
    smtpPasswordDraft,
    supabaseUrl,
    licenseLinked,
    mailTemplatePresence,
    mailTemplatesFetchFailed,
    testMailTo,
    testMailOk,
    testMailErr,
  })

  const smtpPwHint =
    mailSecretFlags?.smtp_password_set && !mailSmtpPasswordDirty
      ? 'Gespeichert — nur bei Änderung neu eintragen.'
      : mailSecretFlags?.smtp_password_set
        ? 'Neues Passwort ersetzt das gespeicherte.'
        : 'SMTP-Passwort (wird verschlüsselt serverseitig gespeichert, nie wieder angezeigt).'
  const resendHint =
    mailSecretFlags?.resend_api_key_set && !mailResendKeyDirty
      ? 'API-Key gespeichert — nur bei Änderung neu eintragen.'
      : mailSecretFlags?.resend_api_key_set
        ? 'Neuer Key ersetzt den gespeicherten.'
        : 'Resend API-Key (re_…), nicht im Klartext aus der Datenbank lesbar.'

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Mailversand (Resend / SMTP)</h3>
      <p className="text-xs text-slate-600">
        Produktiver Versand in den Mandanten-Apps nutzt weiterhin die dortigen Edge Functions; Absender und Provider
        können hier pro Mandant vorbereitet werden. Geheimnisse sind nur für Admins schreibbar und werden nicht an das
        Frontend zurückgegeben.
      </p>
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
            onChange={(e) => onMailProviderChange(e.target.value as 'resend' | 'smtp')}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          >
            <option value="resend">Resend</option>
            <option value="smtp">SMTP</option>
          </select>
        </div>
        <div>
          <label htmlFor="mail_monthly_limit" className="block text-sm font-medium text-slate-700 mb-1">
            Monatslimit (Zähler Lizenzportal)
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
            placeholder="Kunde GmbH"
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
            placeholder="noreply@mail.example.de"
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
            placeholder="kontakt@mail.example.de"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
        </div>
      </div>

      {mailProvider === 'smtp' ? (
        <div className="rounded-md border border-slate-200 bg-white p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <p className="sm:col-span-2 text-xs font-medium text-slate-700">SMTP-Server</p>
          <div className="sm:col-span-2">
            <label htmlFor="smtp_host" className="block text-sm font-medium text-slate-700 mb-1">
              Host
            </label>
            <input
              id="smtp_host"
              type="text"
              value={smtpHost}
              onChange={(e) => onSmtpHostChange(e.target.value)}
              placeholder="smtp.example.com"
              autoComplete="off"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
            />
          </div>
          <div>
            <label htmlFor="smtp_port" className="block text-sm font-medium text-slate-700 mb-1">
              Port
            </label>
            <input
              id="smtp_port"
              type="number"
              min={1}
              max={65535}
              value={smtpPort}
              onChange={(e) => onSmtpPortChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={smtpImplicitTls}
                onChange={(e) => onSmtpImplicitTlsChange(e.target.checked)}
                className="rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
              />
              <span>Implicit TLS (typisch Port 465)</span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="smtp_username" className="block text-sm font-medium text-slate-700 mb-1">
              SMTP-Benutzername
            </label>
            <input
              id="smtp_username"
              type="text"
              value={smtpUsername}
              onChange={(e) => onSmtpUsernameChange(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="smtp_password_draft" className="block text-sm font-medium text-slate-700 mb-1">
              SMTP-Passwort
            </label>
            <input
              id="smtp_password_draft"
              type="password"
              value={smtpPasswordDraft}
              onChange={(e) => onSmtpPasswordDraftChange(e.target.value)}
              placeholder={mailSecretFlags?.smtp_password_set ? '••••••••' : ''}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
              aria-describedby="smtp_pw_hint"
            />
            <p id="smtp_pw_hint" className="mt-1 text-xs text-slate-500">
              {smtpPwHint}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <label htmlFor="resend_api_key_draft" className="block text-sm font-medium text-slate-700 mb-1">
            Resend API-Key
          </label>
          <input
            id="resend_api_key_draft"
            type="password"
            value={resendApiKeyDraft}
            onChange={(e) => onResendApiKeyDraftChange(e.target.value)}
            placeholder={mailSecretFlags?.resend_api_key_set ? '••••••••' : 're_…'}
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
            aria-describedby="resend_key_hint"
          />
          <p id="resend_key_hint" className="mt-1 text-xs text-slate-500">
            {resendHint}
          </p>
        </div>
      )}

      <MandantMailSetupStatus
        lines={mailSetupLines}
        onRefresh={onRefreshMailSetup}
        refreshLoading={mailSetupRefreshLoading}
      />

      <div className="rounded-md border border-dashed border-slate-300 bg-white p-3 space-y-2">
        <p className="text-sm font-medium text-slate-800">Testmail</p>
        <p className="text-xs text-slate-600">
          Versand über <strong>{tenantMailProviderLabelDe(mailProvider)}</strong> mit der gespeicherten Konfiguration.
          Zuerst Mandant speichern, wenn Sie Geheimnisse geändert haben.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <label className="flex-1 block text-sm">
            <span className="block text-slate-600 mb-1">Empfänger</span>
            <input
              type="email"
              value={testMailTo}
              onChange={(e) => onTestMailToChange(e.target.value)}
              disabled={!tenantId}
              placeholder="empfaenger@mail.example.de"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            disabled={!tenantId || testMailLoading || !testMailTo.trim()}
            onClick={onSendTestMail}
            className="rounded-lg bg-slate-800 text-white px-4 py-2 text-sm font-medium hover:bg-slate-900 disabled:opacity-50 shrink-0"
          >
            {testMailLoading ? 'Senden…' : 'Testmail senden'}
          </button>
        </div>
        {testMailOk ? <p className="text-sm text-emerald-700 dark:text-emerald-400 m-0">{testMailOk}</p> : null}
        {testMailErr ? <p className="text-sm text-red-700 dark:text-red-400 m-0">{testMailErr}</p> : null}
      </div>
    </div>
  )
}
