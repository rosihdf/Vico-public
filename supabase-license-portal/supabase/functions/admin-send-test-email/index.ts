/**
 * POST /functions/v1/admin-send-test-email
 * Lizenzportal: nur eingeloggte LP-Admins; Versand per Mandanten-Mailkonfiguration (Resend oder SMTP).
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.15'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  deepMerge,
  MAIL_PREVIEW_SAMPLE_CONTEXT,
  resolveRenderedMail,
} from '../_shared/mailTemplateRender.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
}

type Body = {
  tenantId?: string
  toEmail?: string
  /** Optional: Vorlage mit Beispieldaten testen (Sonst klassische Kurz-Testmail). */
  templateKey?: string
  locale?: string
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const toYearMonth = (d: Date): string => {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const normalizeProvider = (raw: string | null | undefined): 'resend' | 'smtp' => {
  const s = String(raw ?? 'resend').trim().toLowerCase()
  if (s === 'smtp' || s === 'custom') return 'smtp'
  return 'resend'
}

const buildFromHeader = (name: string | null | undefined, email: string | null | undefined): string => {
  const em = String(email ?? '').trim()
  const nm = String(name ?? '').trim()
  if (em && nm) return `${nm} <${em}>`
  if (em) return em
  return 'Lizenzportal <onboarding@resend.dev>'
}

const looksLikeEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s]+$/.test(s.trim())

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim()
  const anonKey = (Deno.env.get('SUPABASE_ANON_KEY') ?? '').trim()
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { error: 'Supabase-Umgebungsvariablen fehlen.' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { error: 'Nicht autorisiert.' })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json(400, { error: 'Ungültiger JSON-Body.' })
  }

  const tenantId = String(body.tenantId ?? '').trim()
  const toEmail = String(body.toEmail ?? '').trim()
  const templateKey = String(body.templateKey ?? '').trim()
  const locale = String(body.locale ?? 'de').trim() || 'de'
  if (!tenantId || !looksLikeEmail(toEmail)) {
    return json(400, { error: 'tenantId und gültige toEmail sind erforderlich.' })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return json(401, { error: 'Nicht autorisiert.' })
  }

  const { data: prof, error: profErr } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profErr || (prof as { role?: string } | null)?.role !== 'admin') {
    return json(403, { error: 'Nur Lizenzportal-Admins dürfen Testmails senden.' })
  }

  const svc = createClient(supabaseUrl, serviceKey)

  const { data: tenant, error: tenantErr } = await svc
    .from('tenants')
    .select(
      'id, name, mail_provider, mail_from_name, mail_from_email, mail_reply_to, smtp_host, smtp_port, smtp_implicit_tls, smtp_username'
    )
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantErr || !tenant) {
    return json(404, { error: 'Mandant nicht gefunden.' })
  }

  const { data: secrets, error: secErr } = await svc
    .from('tenant_mail_secrets')
    .select('smtp_password, resend_api_key')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (secErr) {
    return json(500, { error: 'Geheimnisse konnten nicht gelesen werden.' })
  }

  const row = tenant as Record<string, unknown>
  const sec = (secrets ?? {}) as { smtp_password?: string | null; resend_api_key?: string | null }

  let subjectOut = 'Testmail (Lizenzportal – Mandanten-Mail)'
  let htmlOut = `<p>Testmail für Mandant <strong>${String(row.name ?? '')}</strong>.</p>`
  let textOut = `Testmail für Mandant ${String(row.name ?? '')}.`

  if (templateKey) {
    const sampleMerged = deepMerge(MAIL_PREVIEW_SAMPLE_CONTEXT as Record<string, unknown>, {
      mandant: { name: String(row.name ?? '') },
    })
    const rendered = await resolveRenderedMail(svc, tenantId, templateKey, locale, sampleMerged, null)
    subjectOut = rendered.subject || subjectOut
    htmlOut = rendered.html || htmlOut
    textOut = rendered.text || textOut
  }

  const provider = normalizeProvider(row.mail_provider as string | undefined)
  const fromHeader = buildFromHeader(
    row.mail_from_name as string | undefined,
    row.mail_from_email as string | undefined
  )
  const replyToRaw = String(row.mail_reply_to ?? '').trim()
  const ym = toYearMonth(new Date())

  const logSvc = async (
    status: 'ok' | 'failed',
    errorText?: string
  ): Promise<void> => {
    await svc.rpc('log_tenant_mail_delivery', {
      p_tenant_id: tenantId,
      p_channel: 'admin_test',
      p_provider: provider,
      p_status: status,
      p_recipient_email: toEmail,
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
        await logSvc('failed', 'Kein Resend-API-Key hinterlegt (Lizenzportal Mandanten-Geheimnisse).')
        return json(400, {
          error:
            'Kein Resend-API-Key für diesen Mandanten gespeichert. Bitte unter „Resend API-Key“ eintragen und speichern.',
        })
      }

      const payload: Record<string, unknown> = {
        from: fromHeader,
        to: [toEmail],
        subject: subjectOut,
        html: htmlOut,
        text: textOut,
      }
      if (replyToRaw && looksLikeEmail(replyToRaw)) {
        payload.reply_to = replyToRaw
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
        return json(res.status >= 400 && res.status < 600 ? res.status : 502, { error: msg })
      }
      await logSvc('ok')
      const mid =
        typeof result === 'object' && result && 'id' in result ? String((result as { id?: unknown }).id) : undefined
      return json(200, { success: true, provider: 'resend', messageId: mid ?? null })
    }

    const host = String(row.smtp_host ?? '').trim()
    const port = typeof row.smtp_port === 'number' ? row.smtp_port : parseInt(String(row.smtp_port ?? '587'), 10) || 587
    const implicitTls = Boolean(row.smtp_implicit_tls)
    const smtpUser = String(row.smtp_username ?? '').trim()
    const smtpPass = String(sec.smtp_password ?? '').trim()

    if (!host) {
      await logSvc('failed', 'SMTP-Host fehlt.')
      return json(400, { error: 'SMTP-Host ist nicht konfiguriert.' })
    }
    if (!smtpUser || !smtpPass) {
      await logSvc('failed', 'SMTP-Zugangsdaten unvollständig.')
      return json(400, {
        error: 'SMTP-Benutzername oder Passwort fehlt (Passwort nur im Lizenzportal als Geheimnis gespeichert).',
      })
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: implicitTls,
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: fromHeader,
      to: toEmail,
      subject: subjectOut,
      text: textOut,
      html: htmlOut,
      replyTo: replyToRaw && looksLikeEmail(replyToRaw) ? replyToRaw : undefined,
    })

    await logSvc('ok')
    return json(200, { success: true, provider: 'smtp' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await logSvc('failed', msg.slice(0, 2000))
    return json(502, { error: msg })
  }
})
