/**
 * POST /api/limit-exceeded
 * Empfängt Grenzüberschreitungs-Meldungen (Benutzer/Kunden-Limit) von Haupt-App und Arbeitszeit-Portal.
 * Schreibt in limit_exceeded_log des Lizenzportals.
 * Gleiche Authentisierung wie supabase-license-portal/supabase/functions/limit-exceeded (Mandanten-JWT + get_my_role, ohne leser/kunde).
 */
import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { createRemoteJWKSet, jwtVerify } from 'jose'

type LimitExceededBody = {
  licenseNumber: string
  limit_type: 'users' | 'customers'
  current_value: number
  max_value: number
  reported_from?: string
}

const decodeJwtPayload = (jwt: string): Record<string, unknown> | null => {
  const parts = jwt.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    const decoded = Buffer.from(payload, 'base64').toString('utf8')
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

const headerMap = (event: HandlerEvent): Record<string, string> => {
  const raw = event.headers ?? {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v) out[k.toLowerCase()] = v
  }
  return out
}

const assertOriginAllowedForTenant = (
  tenant: Record<string, unknown> | null,
  originOrReferer: string
): boolean => {
  const allowedDomains = tenant?.allowed_domains as string[] | null | undefined
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) return true
  let requestHostFromHeader = ''
  try {
    requestHostFromHeader = originOrReferer.trim()
      ? new URL(originOrReferer.trim()).hostname.toLowerCase()
      : ''
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

const LICENSE_ROW_SELECT = `
  id,
  tenant_id,
  license_number,
  tenants (
    id,
    supabase_url,
    allowed_domains,
    app_domain,
    portal_domain,
    arbeitszeitenportal_domain
  )
`

const handler: Handler = async (event: HandlerEvent): Promise<{ statusCode: number; body: string; headers?: Record<string, string> }> => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, accept, apikey, x-mandant-anon-key',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const h = headerMap(event)
  const authHeader = h['authorization'] ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Authorization: Bearer <Mandanten-Session-JWT> erforderlich.' }) }
  }
  const mandantJwt = authHeader.slice(7).trim()
  if (!mandantJwt) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Authorization: Bearer <Mandanten-Session-JWT> erforderlich.' }) }
  }

  let body: LimitExceededBody
  try {
    body = JSON.parse(event.body ?? '{}') as LimitExceededBody
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { licenseNumber, limit_type, current_value, max_value, reported_from } = body

  if (!licenseNumber?.trim() || !limit_type || typeof current_value !== 'number' || typeof max_value !== 'number') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'licenseNumber, limit_type, current_value, max_value erforderlich' }),
    }
  }

  if (!['users', 'customers'].includes(limit_type)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'limit_type muss users oder customers sein' }),
    }
  }

  const url = process.env.SUPABASE_LICENSE_PORTAL_URL
  const key = process.env.SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY
  if (!url || !key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'License portal not configured' }) }
  }

  const supabase = createClient(url, key)

  const { data: licenseRow, error: licenseError } = await supabase
    .from('licenses')
    .select(LICENSE_ROW_SELECT)
    .eq('license_number', licenseNumber.trim())
    .maybeSingle()

  if (licenseError || !licenseRow) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Lizenz nicht gefunden' }) }
  }

  const tenant = licenseRow.tenants as Record<string, unknown> | null
  const originHeader = (h['origin'] ?? h['referer'] ?? '').trim()
  if (!assertOriginAllowedForTenant(tenant, originHeader)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Domain nicht für diese Lizenz freigegeben' }) }
  }

  const mandantSupabaseUrlRaw = tenant?.supabase_url != null ? String(tenant.supabase_url).trim() : ''
  if (!mandantSupabaseUrlRaw) {
    return {
      statusCode: 503,
      body: JSON.stringify({
        error:
          'Mandanten-Supabase-URL fehlt (tenants.supabase_url). Pflicht für sichere Authentisierung.',
      }),
    }
  }

  const baseUrl = normalizeSupabaseBaseUrl(mandantSupabaseUrlRaw)
  const expectedIssuer = `${baseUrl}/auth/v1`
  const issuerFromJwt = getIssuerFromJwt(mandantJwt)
  if (!issuerFromJwt || issuerFromJwt !== expectedIssuer) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Token gehört nicht zu diesem Mandanten.' }) }
  }

  try {
    const JWKS = createRemoteJWKSet(new URL(`${baseUrl}/auth/v1/.well-known/jwks.json`))
    await jwtVerify(mandantJwt, JWKS, { issuer: expectedIssuer })
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Ungültige oder abgelaufene Session.' }) }
  }

  const mandantAnon = (h['x-mandant-anon-key'] ?? '').trim()
  if (!mandantAnon) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'x-mandant-anon-key erforderlich (öffentlicher Anon-Key des Mandanten-Supabase-Projekts).',
      }),
    }
  }

  const role = await fetchMandantRole(baseUrl, mandantJwt, mandantAnon)
  if (role === null) {
    return {
      statusCode: 503,
      body: JSON.stringify({ error: 'Rollenprüfung beim Mandanten fehlgeschlagen (get_my_role).' }),
    }
  }
  if (role === 'leser' || role === 'kunde') {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Keine Berechtigung für diese Meldung.' }),
    }
  }

  const { error: insertError } = await supabase.from('limit_exceeded_log').insert({
    tenant_id: licenseRow.tenant_id,
    license_id: licenseRow.id,
    limit_type,
    current_value,
    max_value,
    license_number: licenseNumber.trim(),
    reported_from: reported_from?.trim() || null,
  })

  if (insertError) {
    return { statusCode: 500, body: JSON.stringify({ error: insertError.message }) }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  }
}

export { handler }
