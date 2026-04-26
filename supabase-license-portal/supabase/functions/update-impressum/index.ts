/**
 * PATCH /update-impressum
 * Impressum/Datenschutz des Mandanten; Mandanten-JWT (JWKS) + Lizenz-/Tenant-Zuordnung wie submit-beta-feedback.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.2.0/index.ts'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, x-mandant-anon-key',
}

type UpdatePayload = {
  licenseNumber: string
  impressum?: {
    company_name?: string | null
    address?: string | null
    contact?: string | null
    represented_by?: string | null
    register?: string | null
    vat_id?: string | null
  }
  datenschutz?: {
    responsible?: string | null
    contact_email?: string | null
    dsb_email?: string | null
  }
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

const normalizeTenantDomainField = (raw: string | null | undefined): string => {
  if (!raw || typeof raw !== 'string') return ''
  const s = raw.trim()
  if (!s) return ''
  try {
    if (s.includes('://')) return new URL(s).hostname.toLowerCase()
    const first = s.split('/')[0] ?? ''
    return first.split(':')[0].toLowerCase()
  } catch {
    return s.split('/')[0].split(':')[0].toLowerCase()
  }
}

const hostMatchesAllowedRule = (requestHost: string, rule: string): boolean => {
  const domain = String(rule).trim().toLowerCase()
  if (!domain) return false
  const h = requestHost.toLowerCase()
  if (domain.startsWith('*.')) {
    const suffix = domain.slice(1)
    return h === suffix || h.endsWith(suffix)
  }
  return h === domain
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

/** Mandanten-REST: security definer RPC, gleiche Semantik wie Haupt-App (profiles.role). */
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

  if (req.method !== 'PATCH' && req.method !== 'POST') {
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

    let payload: UpdatePayload
    try {
      payload = (await req.json()) as UpdatePayload
    } catch {
      return json(400, { error: 'Invalid JSON body' })
    }

    const licenseNumber = payload.licenseNumber?.trim()
    if (!licenseNumber) {
      return json(400, { error: 'licenseNumber required' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: 'License portal not configured' })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: licenseRow, error: licenseError } = await supabase
      .from('licenses')
      .select(LICENSE_ROW_SELECT)
      .eq('license_number', licenseNumber)
      .maybeSingle()

    if (licenseError || !licenseRow) {
      return json(404, { error: 'License not found' })
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
      console.warn('update-impressum jwtVerify', e instanceof Error ? e.message : e)
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
    if (role !== 'admin') {
      return json(403, { error: 'Nur Administratoren dürfen Impressum/Datenschutz ändern.' })
    }

    const tenantId = licenseRow.tenant_id as string
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (payload.impressum) {
      if (payload.impressum.company_name !== undefined) update.impressum_company_name = payload.impressum.company_name || null
      if (payload.impressum.address !== undefined) update.impressum_address = payload.impressum.address || null
      if (payload.impressum.contact !== undefined) update.impressum_contact = payload.impressum.contact || null
      if (payload.impressum.represented_by !== undefined) update.impressum_represented_by = payload.impressum.represented_by || null
      if (payload.impressum.register !== undefined) update.impressum_register = payload.impressum.register || null
      if (payload.impressum.vat_id !== undefined) update.impressum_vat_id = payload.impressum.vat_id || null
    }
    if (payload.datenschutz) {
      if (payload.datenschutz.responsible !== undefined) update.datenschutz_responsible = payload.datenschutz.responsible || null
      if (payload.datenschutz.contact_email !== undefined) update.datenschutz_contact_email = payload.datenschutz.contact_email || null
      if (payload.datenschutz.dsb_email !== undefined) update.datenschutz_dsb_email = payload.datenschutz.dsb_email || null
    }

    if (Object.keys(update).length <= 1) {
      return json(400, { error: 'No impressum or datenschutz fields to update' })
    }

    const { error: updateError } = await supabase.from('tenants').update(update).eq('id', tenantId)

    if (updateError) {
      return json(500, { error: updateError.message })
    }

    return json(200, { ok: true })
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Unbekannter Fehler' })
  }
})
