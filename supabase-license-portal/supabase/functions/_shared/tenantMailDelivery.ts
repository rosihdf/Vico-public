/**
 * Gemeinsame Versand-Pipeline für Mandanten-Mail (Resend/SMTP + LP-Zähler/Logs).
 * Genutzt von send-tenant-email (JWT) und send-tenant-email-server (Cron-Secret).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.15'
import {
  channelForMailType,
  enrichTenantMailContext,
  mailTypeFromTemplateKey,
  resolveRenderedMail,
  roughHtmlToText,
} from './mailTemplateRender.ts'

export type MailType = 'maintenance_report' | 'reminder' | 'generic' | 'portal_report_notification'

export type ParsedAttachment = { filename: string; content: string }

export const MAX_HTML_CHARS = 480_000
export const MAX_ATTACHMENT_TOTAL_BASE64 = 14 * 1024 * 1024

export const looksLikeEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s]+$/.test(s.trim())

export const normalizeProvider = (raw: string | null | undefined): 'resend' | 'smtp' => {
  const s = String(raw ?? 'resend').trim().toLowerCase()
  if (s === 'smtp' || s === 'custom') return 'smtp'
  return 'resend'
}

export const buildFromHeader = (name: string | null | undefined, email: string | null | undefined): string => {
  const em = String(email ?? '').trim()
  const nm = String(name ?? '').trim()
  if (em && nm) return `${nm} <${em}>`
  if (em) return em
  return 'ArioVan <onboarding@resend.dev>'
}

export const base64ToUint8Array = (b64: string): Uint8Array => {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export const parseMailTypeFromBody = (raw: string): MailType => {
  const t = raw.trim().toLowerCase()
  if (t === 'maintenance_report') return 'maintenance_report'
  if (t === 'reminder') return 'reminder'
  if (t === 'portal_report_notification') return 'portal_report_notification'
  return 'generic'
}

export const toYearMonth = (d: Date): string => {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export type AttachmentInput = { filename?: string; contentBase64?: string }

export const parseAttachmentsInput = (
  attachmentsIn: AttachmentInput[] | undefined
): { ok: true; attachments: ParsedAttachment[] } | { ok: false; error: string } => {
  const list = Array.isArray(attachmentsIn) ? attachmentsIn : []
  let totalB64 = 0
  const attachments: ParsedAttachment[] = []
  for (const a of list.slice(0, 8)) {
    const fn = String(a?.filename ?? '').trim()
    const b64 = String(a?.contentBase64 ?? '').trim()
    if (!fn || fn.length > 240 || !b64) continue
    totalB64 += b64.length
    if (totalB64 > MAX_ATTACHMENT_TOTAL_BASE64) {
      return { ok: false, error: 'Anhänge zu groß (Gesamt Base64-Limit überschritten).' }
    }
    attachments.push({ filename: fn, content: b64 })
  }
  return { ok: true, attachments }
}

export type DeliverTenantEmailParams = {
  svc: SupabaseClient
  tenantId: string
  tenant: Record<string, unknown>
  secrets: { smtp_password?: string | null; resend_api_key?: string | null } | null
  to: string
  usesTemplate: boolean
  templateKey: string
  locale: string
  explicitSubject: string
  explicitHtml: string
  explicitText: string
  rawContext: Record<string, unknown>
  bodyTypeRaw: string
  attachments: ParsedAttachment[]
}

export type DeliverTenantEmailResult =
  | { ok: true; provider: 'resend' | 'smtp'; messageId?: string | null }
  | { ok: false; status: number; error: string }

export const deliverTenantEmail = async (inp: DeliverTenantEmailParams): Promise<DeliverTenantEmailResult> => {
  const {
    svc,
    tenantId,
    tenant,
    secrets,
    to,
    usesTemplate,
    templateKey,
    locale,
    explicitSubject,
    explicitHtml,
    explicitText,
    rawContext,
    bodyTypeRaw,
    attachments,
  } = inp

  const tenantDisplayName = String(tenant.name ?? '')
  let subjectFinal = explicitSubject
  let htmlFinal = explicitHtml
  let textFinal = explicitText
  let mailType: MailType = parseMailTypeFromBody(bodyTypeRaw)

  if (usesTemplate) {
    const merged = enrichTenantMailContext(tenantDisplayName, rawContext)
    const rendered = await resolveRenderedMail(svc, tenantId, templateKey, locale, merged, null)
    subjectFinal = rendered.subject || explicitSubject
    htmlFinal = rendered.html || explicitHtml
    textFinal = rendered.text || explicitText || roughHtmlToText(htmlFinal)
    mailType = mailTypeFromTemplateKey(templateKey)
  } else if (!textFinal && htmlFinal) {
    textFinal = roughHtmlToText(htmlFinal)
  }

  if (!subjectFinal || subjectFinal.length > 500) {
    return { ok: false, status: 400, error: 'subject ist erforderlich (max. 500 Zeichen).' }
  }
  if (!htmlFinal || htmlFinal.length > MAX_HTML_CHARS) {
    return { ok: false, status: 400, error: `html ist erforderlich (max. ${MAX_HTML_CHARS} Zeichen).` }
  }

  const sec = (secrets ?? {}) as { smtp_password?: string | null; resend_api_key?: string | null }
  const provider = normalizeProvider(tenant.mail_provider as string | undefined)
  const fromHeader = buildFromHeader(
    tenant.mail_from_name as string | undefined,
    tenant.mail_from_email as string | undefined
  )
  const replyToRaw = String(tenant.mail_reply_to ?? '').trim()
  const ym = toYearMonth(new Date())
  const channel = channelForMailType(mailType)

  const logSvc = async (status: 'ok' | 'failed', errorText?: string): Promise<void> => {
    await svc.rpc('log_tenant_mail_delivery', {
      p_tenant_id: tenantId,
      p_channel: channel,
      p_provider: provider,
      p_status: status,
      p_recipient_email: to,
      p_error_text: errorText ?? null,
    })
    await svc.rpc('increment_tenant_email_monthly_usage', {
      p_tenant_id: tenantId,
      p_status: status,
      p_year_month: ym,
    })
  }

  try {
    if (provider === 'resend') {
      const apiKey = String(sec.resend_api_key ?? '').trim()
      if (!apiKey) {
        await logSvc('failed', 'Kein Resend-API-Key für diesen Mandanten (Lizenzportal).')
        return {
          ok: false,
          status: 400,
          error:
            'Mail nicht konfiguriert: Resend-API-Key im Lizenzportal für diesen Mandanten hinterlegen.',
        }
      }

      const payload: Record<string, unknown> = {
        from: fromHeader,
        to: [to],
        subject: subjectFinal,
        html: htmlFinal,
      }
      if (textFinal) payload.text = textFinal
      if (replyToRaw && looksLikeEmail(replyToRaw)) {
        payload.reply_to = replyToRaw
      }
      if (attachments.length > 0) {
        payload.attachments = attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
        }))
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof result === 'object' && result && 'message' in result
            ? String((result as { message?: unknown }).message)
            : typeof result === 'object' && result && 'detail' in result
              ? String((result as { detail?: unknown }).detail)
              : `HTTP ${res.status}`
        await logSvc('failed', msg.slice(0, 2000))
        return { ok: false, status: res.status >= 400 && res.status < 600 ? res.status : 502, error: msg }
      }
      await logSvc('ok')
      const mid =
        typeof result === 'object' && result && 'id' in result ? String((result as { id?: unknown }).id) : undefined
      return { ok: true, provider: 'resend', messageId: mid ?? null }
    }

    const host = String(tenant.smtp_host ?? '').trim()
    const port =
      typeof tenant.smtp_port === 'number' ? tenant.smtp_port : parseInt(String(tenant.smtp_port ?? '587'), 10) || 587
    const implicitTls = Boolean(tenant.smtp_implicit_tls)
    const smtpUser = String(tenant.smtp_username ?? '').trim()
    const smtpPass = String(sec.smtp_password ?? '').trim()

    if (!host) {
      await logSvc('failed', 'SMTP-Host fehlt.')
      return { ok: false, status: 400, error: 'SMTP-Host ist nicht konfiguriert (Lizenzportal).' }
    }
    if (!smtpUser || !smtpPass) {
      await logSvc('failed', 'SMTP-Zugangsdaten unvollständig.')
      return {
        ok: false,
        status: 400,
        error: 'SMTP-Benutzername oder Passwort fehlt (Lizenzportal Mandanten-Geheimnisse).',
      }
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: implicitTls,
      auth: { user: smtpUser, pass: smtpPass },
    })

    const nodemailerAttachments =
      attachments.length > 0
        ? attachments.map((a) => ({
            filename: a.filename,
            content: base64ToUint8Array(a.content),
          }))
        : undefined

    await transporter.sendMail({
      from: fromHeader,
      to,
      subject: subjectFinal,
      html: htmlFinal,
      ...(textFinal ? { text: textFinal } : {}),
      replyTo: replyToRaw && looksLikeEmail(replyToRaw) ? replyToRaw : undefined,
      attachments: nodemailerAttachments,
    })

    await logSvc('ok')
    return { ok: true, provider: 'smtp' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await logSvc('failed', msg.slice(0, 2000))
    return { ok: false, status: 502, error: msg }
  }
}
