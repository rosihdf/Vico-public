/**
 * POST /functions/v1/send-tenant-email
 * Zentraler Mailversand für Mandanten-Apps: Mandanten-Session-JWT + Anon-Key,
 * Versand über im Lizenzportal konfigurierte Mandanten-Mail (Resend/SMTP).
 * Betreff/HTML/Text können über Vorlagen tenant_mail_templates (LP-Admin) oder explizit im Body gesetzt werden.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { jwtVerify, createRemoteJWKSet } from 'https://deno.land/x/jose@v5.2.0/index.ts'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  deliverTenantEmail,
  looksLikeEmail,
  MAX_HTML_CHARS,
  parseAttachmentsInput,
  type AttachmentInput,
  type MailType,
} from '../_shared/tenantMailDelivery.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, x-mandant-anon-key',
}

type Body = {
  tenantId?: string
  to?: string
  subject?: string
  html?: string
  text?: string
  type?: MailType | string
  templateKey?: string
  context?: Record<string, unknown>
  locale?: string
  attachments?: AttachmentInput[]
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const decodeJwtPayload = (jwt: string): Record<string, unknown> | null => {
  const parts = jwt.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    const decoded = atob(payload)
    const parsed = JSON.parse(decoded) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const getIssuerFromJwt = (jwt: string): string => {
  const payload = decodeJwtPayload(jwt)
  const iss = payload?.iss
  return typeof iss === 'string' ? iss.trim() : ''
}

const assertOriginAllowedForTenantRequest = (req: Request, tenant: Record<string, unknown> | null): boolean => {
  const allowedDomains = tenant?.allowed_domains as string[] | null | undefined
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) return true
  const origin = req.headers.get('origin') ?? req.headers.get('referer') ?? ''
  let requestHostFromHeader = ''
  try {
    requestHostFromHeader = origin ? new URL(origin.trim()).hostname.toLowerCase() : ''
  } catch {
    requestHostFromHeader = ''
  }
  if (!requestHostFromHeader) return false
  return allowedDomains.some((d) => {
    const domain = String(d).trim().toLowerCase()
    if (!domain) return false
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(1)
      return requestHostFromHeader === suffix || requestHostFromHeader.endsWith(suffix)
    }
    return requestHostFromHeader === domain
  })
}

const normalizeSupabaseBaseUrl = (raw: string): string => raw.trim().replace(/\/$/, '')

const fetchMandantRole = async (
  baseUrl: string,
  mandantJwt: string,
  mandantAnonKey: string
): Promise<string | null> => {
  const r = await fetch(`${baseUrl}/rest/v1/rpc/get_my_role`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mandantJwt}`,
      apikey: mandantAnonKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(12_000),
  })
  if (!r.ok) return null
  try {
    const parsed = JSON.parse(await r.text()) as unknown
    return typeof parsed === 'string' ? parsed : null
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json(401, { error: 'Authorization: Bearer <Mandanten-Session-JWT> erforderlich.' })
    }
    const mandantJwt = authHeader.slice(7).trim()
    if (!mandantJwt) {
      return json(401, { error: 'Authorization: Bearer <Mandanten-Session-JWT> erforderlich.' })
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
    const explicitSubject = String(body.subject ?? '').trim()
    const explicitHtml = typeof body.html === 'string' ? body.html : ''
    const explicitText = typeof body.text === 'string' ? body.text.trim() : ''
    const usesTemplate = Boolean(templateKey)

    if (!tenantId || !UUID_RE.test(tenantId)) {
      return json(400, { error: 'tenantId (UUID) ist erforderlich.' })
    }
    if (!looksLikeEmail(to)) {
      return json(400, { error: 'Gültiges Feld to (E-Mail) ist erforderlich.' })
    }
    if (
      !usesTemplate &&
      (!explicitSubject || explicitSubject.length > 500 || !explicitHtml || explicitHtml.length > MAX_HTML_CHARS)
    ) {
      return json(400, {
        error: `Ohne templateKey sind subject und html erforderlich (html max. ${MAX_HTML_CHARS} Zeichen).`,
      })
    }
    if (!usesTemplate && explicitSubject.length > 500) {
      return json(400, { error: 'subject ist zu lang (max. 500 Zeichen).' })
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
    if (!assertOriginAllowedForTenantRequest(req, tenant)) {
      return json(403, { error: 'Domain nicht für diesen Mandanten freigegeben.' })
    }

    const mandantSupabaseUrlRaw = tenant.supabase_url != null ? String(tenant.supabase_url).trim() : ''
    if (!mandantSupabaseUrlRaw) {
      return json(503, {
        error:
          'Mandanten-Supabase-URL fehlt (tenants.supabase_url). Pflicht für sichere Authentisierung.',
      })
    }

    const baseUrl = normalizeSupabaseBaseUrl(mandantSupabaseUrlRaw)
    const expectedIssuer = `${baseUrl}/auth/v1`
    const issuerFromJwt = getIssuerFromJwt(mandantJwt)
    if (!issuerFromJwt || issuerFromJwt !== expectedIssuer) {
      return json(403, { error: 'Token gehört nicht zu diesem Mandanten.' })
    }

    try {
      const JWKS = createRemoteJWKSet(new URL(`${baseUrl}/auth/v1/.well-known/jwks.json`))
      await jwtVerify(mandantJwt, JWKS, { issuer: expectedIssuer })
    } catch (e) {
      console.warn('send-tenant-email jwtVerify', e instanceof Error ? e.message : e)
      return json(401, { error: 'Ungültige oder abgelaufene Session.' })
    }

    const mandantAnon = req.headers.get('x-mandant-anon-key')?.trim() ?? ''
    if (!mandantAnon) {
      return json(400, {
        error: 'x-mandant-anon-key erforderlich (öffentlicher Anon-Key des Mandanten-Supabase-Projekts).',
      })
    }

    const role = await fetchMandantRole(baseUrl, mandantJwt, mandantAnon)
    if (role === null) {
      return json(503, { error: 'Rollenprüfung beim Mandanten fehlgeschlagen (get_my_role).' })
    }
    if (role === 'leser' || role === 'kunde') {
      return json(403, { error: 'Keine Berechtigung zum Mailversand.' })
    }

    const { data: secrets, error: secErr } = await svc
      .from('tenant_mail_secrets')
      .select('smtp_password, resend_api_key')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (secErr) {
      return json(500, { error: 'Geheimnisse konnten nicht gelesen werden.' })
    }

    const rawCtx =
      body.context && typeof body.context === 'object' && body.context !== null && !Array.isArray(body.context)
        ? (body.context as Record<string, unknown>)
        : {}

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
      bodyTypeRaw: String(body.type ?? 'generic'),
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
