import type { TenantMailSecretFlags, TenantMailTemplateKeyPresence } from './licensePortalService'

export type MailSetupStatusKind = 'ok' | 'warning' | 'error'

export type MailSetupStatusLine = {
  key: string
  label: string
  status: MailSetupStatusKind
  explanation: string
}

const DOC_HINT = 'Doku im Repo: docs/Mailversand-Neuer-Mandant-Checkliste.md, docs/Mailversand-Legacy.md.'

const looksLikeEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s]+$/.test(s.trim())

/** Apex-Domain @amrtech.de ohne Subdomain mail. – Risiko bei Resend-Verifikation. */
const isApexAmrtechSenderRisk = (email: string): boolean => {
  const m = email.trim().toLowerCase().match(/^[^\s@]+@([^@\s]+)$/)
  if (!m) return false
  return m[1] === 'amrtech.de'
}

const isPlausibleSupabaseUrl = (raw: string): boolean => {
  const t = raw.trim()
  if (!t) return false
  try {
    return new URL(t).protocol === 'https:'
  } catch {
    return false
  }
}

export type MailSetupStatusInput = {
  tenantId: string | null
  mailProvider: 'resend' | 'smtp'
  mailFromEmail: string
  smtpHost: string
  smtpUsername: string
  mailSecretFlags: TenantMailSecretFlags | null
  mailResendKeyDirty: boolean
  resendApiKeyDraft: string
  mailSmtpPasswordDirty: boolean
  smtpPasswordDraft: string
  supabaseUrl: string
  /** Mindestens eine Lizenz mit diesem Mandanten */
  licenseLinked: boolean
  mailTemplatePresence: TenantMailTemplateKeyPresence | null
  mailTemplatesFetchFailed: boolean
  testMailTo: string
  testMailOk: string | null
  testMailErr: string | null
}

export const computeMailSetupStatusLines = (inp: MailSetupStatusInput): MailSetupStatusLine[] => {
  const lines: MailSetupStatusLine[] = []
  const hasTenant = Boolean(inp.tenantId)

  const resendSecretReady =
    inp.mailSecretFlags?.resend_api_key_set === true ||
    (inp.mailResendKeyDirty && inp.resendApiKeyDraft.trim().length > 0)

  const smtpSecretReady =
    inp.mailSecretFlags?.smtp_password_set === true ||
    (inp.mailSmtpPasswordDirty && inp.smtpPasswordDraft.trim().length > 0)

  // — Mail-Provider
  const providerOk = inp.mailProvider === 'resend' || inp.mailProvider === 'smtp'
  lines.push({
    key: 'provider',
    label: 'Mail-Provider konfiguriert',
    status: providerOk ? 'ok' : 'error',
    explanation: providerOk
      ? `Aktiv: ${inp.mailProvider === 'resend' ? 'Resend' : 'SMTP'}.`
      : 'Ungültiger Provider – nur „resend“ oder „smtp“ sind erlaubt.',
  })

  // — Absender
  const fromTrim = inp.mailFromEmail.trim()
  let senderStatus: MailSetupStatusKind = 'ok'
  let senderExpl = 'Absender-E-Mail ist gesetzt und formal gültig.'
  if (!fromTrim) {
    senderStatus = 'error'
    senderExpl = 'Absender-E-Mail fehlt – für zuverlässigen Versand ausfüllen.'
  } else if (!looksLikeEmail(fromTrim)) {
    senderStatus = 'error'
    senderExpl = 'Absender-E-Mail-Format ist ungültig.'
  } else if (isApexAmrtechSenderRisk(fromTrim)) {
    senderStatus = 'warning'
    senderExpl = `Die Absender-Domain wirkt wie eine Apex-Domain ohne übliche Versand-Subdomain – bei Resend die aus Verified Domain nutzen (z. B. mail.<IhreDomain>). ${DOC_HINT}`
  }
  lines.push({
    key: 'sender',
    label: 'Absender gültig',
    status: senderStatus,
    explanation: senderExpl,
  })

  // — Versand-Secret
  let secretStatus: MailSetupStatusKind = 'ok'
  let secretExpl = 'Geheimnis für den gewählten Provider ist gesetzt (oder neu im Formular eingetragen).'
  if (!hasTenant) {
    secretStatus = 'warning'
    secretExpl = 'Mandant speichern, dann API-Key bzw. SMTP-Passwort setzen.'
  } else if (inp.mailProvider === 'resend') {
    if (!resendSecretReady) {
      secretStatus = 'error'
      secretExpl = 'Resend-API-Key fehlt – eingeben und speichern.'
    }
  } else {
    if (!inp.smtpHost.trim() || !inp.smtpUsername.trim()) {
      secretStatus = 'error'
      secretExpl = 'SMTP-Host oder Benutzername fehlt.'
    } else if (!smtpSecretReady) {
      secretStatus = 'error'
      secretExpl = 'SMTP-Passwort fehlt – eingeben und speichern.'
    }
  }
  lines.push({
    key: 'secret',
    label: 'Versand-Secret vorhanden',
    status: secretStatus,
    explanation: secretExpl,
  })

  // — Testmail möglich
  const fromOk = looksLikeEmail(fromTrim)
  const canTryTest =
    hasTenant &&
    fromOk &&
    (inp.mailProvider === 'resend' ? resendSecretReady : smtpSecretReady && !!inp.smtpHost.trim() && !!inp.smtpUsername.trim())

  let testStatus: MailSetupStatusKind = 'ok'
  let testExpl = 'Voraussetzungen für „Testmail senden“ sind erfüllt.'
  if (!hasTenant) {
    testStatus = 'warning'
    testExpl = 'Nach dem ersten Speichern des Mandanten testbar.'
  } else if (!canTryTest) {
    testStatus = 'error'
    testExpl = 'Absender oder Provider-Secret unvollständig – Testmail nicht sinnvoll.'
  } else if (inp.testMailErr) {
    testStatus = 'warning'
    testExpl = `Letzter Versand meldete einen Fehler: ${inp.testMailErr.slice(0, 180)}${inp.testMailErr.length > 180 ? '…' : ''}`
  } else if (!inp.testMailTo.trim()) {
    testStatus = 'warning'
    testExpl = 'Empfänger-Adresse eintragen und Testmail auslösen.'
  } else if (inp.testMailOk) {
    testStatus = 'ok'
    testExpl = `${inp.testMailOk}`
  }
  lines.push({
    key: 'testmail',
    label: 'Testmail möglich',
    status: testStatus,
    explanation: testExpl,
  })

  // — Lizenz / tenant_id
  if (!hasTenant) {
    lines.push({
      key: 'license',
      label: 'Lizenz tenant_id gesetzt',
      status: 'warning',
      explanation: 'Lizenz-Zuordnung nicht geprüft – Mandant zuerst anlegen und speichern.',
    })
  } else if (!inp.licenseLinked) {
    lines.push({
      key: 'license',
      label: 'Lizenz tenant_id gesetzt',
      status: 'error',
      explanation:
        'Keine Lizenz zu diesem Mandanten – die Haupt-App erhält kein tenant_id aus der Lizenz-API (PDF-Mail über LP ausgeschaltet).',
    })
  } else {
    lines.push({
      key: 'license',
      label: 'Lizenz tenant_id gesetzt',
      status: 'ok',
      explanation: 'Mindestens eine Lizenz ist mit diesem Mandanten verknüpft.',
    })
  }

  // — Supabase-URL
  const supTrim = inp.supabaseUrl.trim()
  let supSt: MailSetupStatusKind = 'ok'
  let supExpl = 'Mandanten-Supabase-URL gesetzt (JWT-/Issuer-Check für send-tenant-email).'
  if (!supTrim) {
    supSt = 'error'
    supExpl = 'Pflichtfeld im Abschnitt „Hosting“ – ohne URL kein zentraler Versand aus der App.'
  } else if (!isPlausibleSupabaseUrl(supTrim)) {
    supSt = 'error'
    supExpl = 'URL muss mit https:// beginnen und gültig sein.'
  }
  lines.push({
    key: 'supabase_url',
    label: 'Supabase-URL gesetzt',
    status: supSt,
    explanation: supExpl,
  })

  // — Templates
  if (inp.mailTemplatesFetchFailed || inp.mailTemplatePresence === null) {
    lines.push({
      key: 'templates',
      label: 'Templates vorhanden',
      status: 'warning',
      explanation: 'Vorlagenstatus nicht geprüft – Daten konnten nicht geladen werden. „Setup prüfen“ oder Seite neu laden.',
    })
  } else {
    const { maintenance_report: mr, portal_report_notification: pr, maintenance_reminder_digest: dg } =
      inp.mailTemplatePresence
    let tplSt: MailSetupStatusKind = 'ok'
    let tplExpl = 'Pflichtvorlagen maintenance_report und portal_report_notification sind vorhanden (global oder Override).'
    if (!mr || !pr) {
      tplSt = 'error'
      tplExpl =
        'Es fehlen nutzbare Zeilen für maintenance_report und/oder portal_report_notification (Betreff+HTML, aktiv).'
    } else if (!dg) {
      tplSt = 'warning'
      tplExpl =
        'maintenance_reminder_digest fehlt oder ist unvollständig – optional für den Wartungs-Digest nachziehen.'
    }
    lines.push({
      key: 'templates',
      label: 'Templates vorhanden',
      status: tplSt,
      explanation: tplExpl,
    })
  }

  // — Reminder-Digest (nicht aus LP-Admin verifizierbar)
  lines.push({
    key: 'digest',
    label: 'Reminder-Digest vorbereitet',
    status: 'warning',
    explanation:
      'Reminder benötigt LP_* Secrets und Cron im Mandanten-Projekt – aus dem Lizenzadmin nicht vollständig prüfbar; nur Hinweis, kein harter Fehler.',
  })

  // — Legacy-Fallback
  const lpCoreOk =
    hasTenant &&
    inp.licenseLinked &&
    supSt === 'ok' &&
    secretStatus === 'ok' &&
    senderStatus !== 'error' &&
    providerOk

  lines.push({
    key: 'legacy',
    label: 'Legacy-Fallback abgesichert',
    status: 'warning',
    explanation: lpCoreOk
      ? `Zentraler LP-Pfad wirkt vorbereitet; Legacy-Functions auf dem Mandanten-Projekt sollten trotzdem RESEND_FROM mit verifizierter Domain nutzen (z. B. noreply@mail.example.de). ${DOC_HINT}`
      : `LP-Mail aus der App kann noch nicht zuverlässig greifen – Legacy-Fallback möglich. RESEND_FROM immer mit verifizierter Domain setzen. ${DOC_HINT}`,
  })

  return lines
}
