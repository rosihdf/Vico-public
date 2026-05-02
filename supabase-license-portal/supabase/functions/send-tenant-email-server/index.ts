/**
 * POST /functions/v1/send-tenant-email-server
 * Interner Server-zu-Server-Versand (ohne Endnutzer-JWT), z. B. Mandanten-Cron → Wartungs-Digest.
 *
 * Auth:
 * - Header `x-tenant-server-mail-secret` muss mit LP-Secret `TENANT_SERVER_MAIL_SECRET` übereinstimmen (min. 24 Zeichen).
 * - Header `x-mandant-supabase-url` muss exakt zu `tenants.supabase_url` des angegebenen tenantId passen (bindet Requests an den Mandanten).
 *
 * Erlaubte templateKeys (kein generisches Relay): `maintenance_reminder_digest`.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  deliverTenantEmail,
  looksLikeEmail,
  MAX_HTML_CHARS,
  parseAttachmentsInput,
  type AttachmentInput,
} from '../_shared/tenantMailDelivery.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, x-tenant-server-mail-secret, x-mandant-supabase-url',
}

type Body = {
  tenantId?: string
  to?: string
  templateKey?: string
  subject?: string
  html?: string
  text?: string
  context?: Record<string, unknown>
  locale?: string
  attachments?: AttachmentInput[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const normalizeSupabaseBaseUrl = (raw: string): string => raw.trim().replace(/\/$/, '')

const ALLOWED_TEMPLATE_KEYS = new Set(['maintenance_reminder_digest'])

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  try {
    const expectedSecret = (Deno.env.get('TENANT_SERVER_MAIL_SECRET') ?? '').trim()
    const hdrSecret = (req.headers.get('x-tenant-server-mail-secret') ?? '').trim()
    if (!expectedSecret || expectedSecret.length < 24 || hdrSecret !== expectedSecret) {
      return json(401, { error: 'Nicht autorisiert.' })
    }

    const mandantUrlHdr = (req.headers.get('x-mandant-supabase-url') ?? '').trim()
    if (!mandantUrlHdr) {
      return json(400, { error: 'x-mandant-supabase-url erforderlich.' })
    }

    let body: Body
    try {
      body = (await req.json()) as Body
    } catch {
      return json(400, { error: 'Ungültiger JSON-Body.' })
    }

    const tenantId = String(body.tenantId ?? '').trim()
    const to = String(body.to ?? '').trim()
    const templateKey = String(body.templateKey ?? '').trim()
    const locale = String(body.locale ?? 'de').trim() || 'de'

    if (!tenantId || !UUID_RE.test(tenantId)) {
      return json(400, { error: 'tenantId (UUID) ist erforderlich.' })
    }
    if (!looksLikeEmail(to)) {
      return json(400, { error: 'Gültiges Feld to (E-Mail) ist erforderlich.' })
    }
    if (!templateKey || !ALLOWED_TEMPLATE_KEYS.has(templateKey)) {
      return json(400, { error: 'Unzulässiger oder fehlender templateKey.' })
    }

    const parsedAtt = parseAttachmentsInput(body.attachments)
    if (!parsedAtt.ok) {
      return json(413, { error: parsedAtt.error })
    }

    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim()
    const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: 'Lizenzportal Supabase nicht konfiguriert.' })
    }

    const svc = createClient(supabaseUrl, serviceKey)

    const { data: tenantRow, error: tenantErr } = await svc
      .from('tenants')
      .select(
        'id, supabase_url, allowed_domains, name, mail_provider, mail_from_name, mail_from_email, mail_reply_to, smtp_host, smtp_port, smtp_implicit_tls, smtp_username'
      )
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantErr || !tenantRow) {
      return json(404, { error: 'Mandant nicht gefunden.' })
    }

    const tenant = tenantRow as Record<string, unknown>
    const tenantSupabaseRaw = tenant.supabase_url != null ? String(tenant.supabase_url).trim() : ''
    if (!tenantSupabaseRaw) {
      return json(503, { error: 'Mandanten-Supabase-URL fehlt.' })
    }
    if (normalizeSupabaseBaseUrl(mandantUrlHdr) !== normalizeSupabaseBaseUrl(tenantSupabaseRaw)) {
      return json(403, { error: 'Mandanten-URL-Stimmigkeit fehlgeschlagen.' })
    }

    const { data: secrets, error: secErr } = await svc
      .from('tenant_mail_secrets')
      .select('smtp_password, resend_api_key')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (secErr) {
      return json(500, { error: 'Geheimnisse konnten nicht gelesen werden.' })
    }

    const explicitSubject = String(body.subject ?? '').trim()
    const explicitHtml = typeof body.html === 'string' ? body.html : ''
    const explicitText = typeof body.text === 'string' ? body.text.trim() : ''
    const rawCtx =
      body.context && typeof body.context === 'object' && body.context !== null && !Array.isArray(body.context)
        ? (body.context as Record<string, unknown>)
        : {}

    const usesTemplate = true
    if (
      explicitHtml &&
      (explicitHtml.length > MAX_HTML_CHARS || explicitSubject.length > 500)
    ) {
      return json(400, { error: 'Explizite Mailfelder unzulässig oder zu lang.' })
    }

    const result = await deliverTenantEmail({
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
      rawContext: rawCtx,
      bodyTypeRaw: 'reminder',
      attachments: parsedAtt.attachments,
    })

    if (!result.ok) {
      return json(result.status, { error: result.error })
    }
    if (result.provider === 'resend') {
      return json(200, { success: true, provider: 'resend', messageId: result.messageId ?? null })
    }
    return json(200, { success: true, provider: 'smtp' })
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Unbekannter Fehler' })
  }
})
