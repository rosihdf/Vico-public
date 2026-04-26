import { createClient } from 'npm:@supabase/supabase-js@2'
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.2.0/index.ts'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, x-mandant-anon-key',
}

type LimitExceededBody = {
  licenseNumber: string
  limit_type: 'users' | 'customers'
  current_value: number
  max_value: number
  reported_from?: string
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

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

    let body: LimitExceededBody
    try {
      body = (await req.json()) as LimitExceededBody
    } catch {
      return json(400, { error: 'Ungültiger JSON-Body' })
    }

    const { licenseNumber, limit_type, current_value, max_value, reported_from } = body

    if (!licenseNumber?.trim() || !limit_type || typeof current_value !== 'number' || typeof max_value !== 'number') {
      return json(400, { error: 'licenseNumber, limit_type, current_value, max_value erforderlich' })
    }

    if (!['users', 'customers'].includes(limit_type)) {
      return json(400, { error: 'limit_type muss users oder customers sein' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: 'Nicht konfiguriert' })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: licenseRow, error: licenseError } = await supabase
      .from('licenses')
      .select(LICENSE_ROW_SELECT)
      .eq('license_number', licenseNumber.trim())
      .maybeSingle()

    if (licenseError || !licenseRow) {
      return json(404, { error: 'Lizenz nicht gefunden' })
    }

    const tenant = licenseRow.tenants as Record<string, unknown> | null
    if (!assertOriginAllowedForTenantRequest(req, tenant)) {
      return json(403, { error: 'Domain nicht für diese Lizenz freigegeben' })
    }

    const mandantSupabaseUrlRaw = tenant?.supabase_url != null ? String(tenant.supabase_url).trim() : ''
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
      console.warn('limit-exceeded jwtVerify', e instanceof Error ? e.message : e)
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
      return json(403, { error: 'Keine Berechtigung für diese Meldung.' })
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
      return json(500, { error: insertError.message })
    }

    return json(200, { success: true })
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Unbekannter Fehler' })
  }
})
