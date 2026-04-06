/**
 * POST /functions/v1/submit-beta-feedback
 * Mandanten-Nutzer senden Beta-Feedback; JWT der Mandanten-Supabase per JWKS geprüft.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.2.0/index.ts'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
}

const DAILY_SUBMIT_MAX = 10
const DESC_MAX = 8000
const TITLE_MAX = 200
const PATH_MAX = 2048
const QUERY_MAX = 2048

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const extractHostnameFromOriginOrReferer = (originOrReferer: string): string => {
  const t = originOrReferer.trim()
  if (!t) return ''
  try {
    return new URL(t).hostname.toLowerCase()
  } catch {
    return ''
  }
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

const tenantMatchesRequestHost = (
  tenant: {
    portal_domain?: string | null
    arbeitszeitenportal_domain?: string | null
    app_domain?: string | null
    allowed_domains?: unknown
  },
  requestHost: string
): boolean => {
  const h = requestHost.trim().toLowerCase()
  if (!h) return false
  const pf = normalizeTenantDomainField(tenant.portal_domain ?? null)
  if (pf && pf === h) return true
  const az = normalizeTenantDomainField(tenant.arbeitszeitenportal_domain ?? null)
  if (az && az === h) return true
  const ad = normalizeTenantDomainField(tenant.app_domain ?? null)
  if (ad && ad === h) return true
  const allowed = tenant.allowed_domains
  if (Array.isArray(allowed)) {
    return allowed.some((rule) => typeof rule === 'string' && hostMatchesAllowedRule(h, rule))
  }
  return false
}

const assertOriginAllowedForTenantRequest = (req: Request, tenant: Record<string, unknown> | null): boolean => {
  const allowedDomains = tenant?.allowed_domains as string[] | null | undefined
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) return true
  const origin = req.headers.get('origin') ?? req.headers.get('referer') ?? ''
  let requestHostFromHeader = ''
  try {
    // Hostname ohne Port, damit localhost:5173 mit allowed_domains "localhost" matcht.
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

const LICENSE_SELECT = `
  id,
  tenant_id,
  license_number,
  features,
  license_models ( features ),
  tenants (
    id,
    name,
    supabase_url,
    allowed_domains,
    app_domain,
    portal_domain,
    arbeitszeitenportal_domain
  )
`

type SourceApp = 'main' | 'kundenportal' | 'arbeitszeit_portal'

const mergeFeatures = (licenseRow: Record<string, unknown>): Record<string, boolean> => {
  const licenseFeatures = (licenseRow.features as Record<string, boolean>) ?? {}
  const modelFeatures =
    (licenseRow.license_models as { features?: Record<string, boolean> } | null)?.features ?? {}
  return { ...modelFeatures, ...licenseFeatures }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) {
    return json(500, { ok: false, error: 'License portal not configured' })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { ok: false, error: 'Unauthorized' })
  }
  const jwt = authHeader.slice(7).trim()
  if (!jwt) {
    return json(401, { ok: false, error: 'Unauthorized' })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return json(400, { ok: false, error: 'Ungültiger JSON-Body' })
  }
  const body = raw as Record<string, unknown>

  const licenseNumberParam =
    typeof body.license_number === 'string' ? body.license_number.trim() : ''
  const sourceApp = body.source_app as string
  const routePath = typeof body.route_path === 'string' ? body.route_path.trim() : ''
  const routeQuery = typeof body.route_query === 'string' ? body.route_query.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const severityRaw = typeof body.severity === 'string' ? body.severity.trim() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const appVersion = typeof body.app_version === 'string' ? body.app_version.trim() : ''
  const releaseLabel = typeof body.release_label === 'string' ? body.release_label.trim() : ''

  const validApps: SourceApp[] = ['main', 'kundenportal', 'arbeitszeit_portal']
  if (!validApps.includes(sourceApp as SourceApp)) {
    return json(400, { ok: false, error: 'source_app ungültig' })
  }

  const validCategories = [
    'ui_layout',
    'flow_logic',
    'missing_feature',
    'remove_feature',
    'bug',
    'other',
  ] as const
  if (!validCategories.includes(category as (typeof validCategories)[number])) {
    return json(400, { ok: false, error: 'category ungültig' })
  }

  let severity: string | null = null
  if (severityRaw) {
    if (!['blocker', 'annoyance', 'wish'].includes(severityRaw)) {
      return json(400, { ok: false, error: 'severity ungültig' })
    }
    severity = severityRaw
  }

  if (!routePath || routePath.length > PATH_MAX) {
    return json(400, { ok: false, error: 'route_path fehlt oder zu lang' })
  }
  if (routeQuery.length > QUERY_MAX) {
    return json(400, { ok: false, error: 'route_query zu lang' })
  }
  if (!description || description.length > DESC_MAX) {
    return json(400, { ok: false, error: 'description fehlt oder zu lang' })
  }
  if (title.length > TITLE_MAX) {
    return json(400, { ok: false, error: 'title zu lang' })
  }

  const requestHost = extractHostnameFromOriginOrReferer(
    (req.headers.get('origin') ?? '').trim() || (req.headers.get('referer') ?? '').trim()
  )

  let licenseRow: Record<string, unknown>

  if (licenseNumberParam) {
    const { data: lr, error: licErr } = await admin
      .from('licenses')
      .select(LICENSE_SELECT)
      .eq('license_number', licenseNumberParam)
      .maybeSingle()
    if (licErr || !lr) {
      return json(404, { ok: false, error: 'Lizenz nicht gefunden' })
    }
    licenseRow = lr as Record<string, unknown>
  } else {
    if (!requestHost) {
      return json(400, {
        ok: false,
        error: 'license_number oder Browser-Origin/Referer (Host-Lookup) erforderlich',
      })
    }
    const { data: tenantRows, error: tenantErr } = await admin
      .from('tenants')
      .select('id, portal_domain, arbeitszeitenportal_domain, app_domain, allowed_domains')
    if (tenantErr) {
      return json(500, { ok: false, error: 'Host-Lookup fehlgeschlagen' })
    }
    const matches = (tenantRows ?? []).filter((t) => tenantMatchesRequestHost(t, requestHost))
    if (matches.length > 1) {
      return json(409, { ok: false, error: 'Mehrere Mandanten für diesen Host' })
    }
    if (matches.length === 0) {
      return json(404, { ok: false, error: 'Lizenz nicht gefunden' })
    }
    const tenantId = matches[0].id as string
    const { data: lr, error: licErr } = await admin
      .from('licenses')
      .select(LICENSE_SELECT)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (licErr || !lr) {
      return json(404, { ok: false, error: 'Lizenz nicht gefunden' })
    }
    licenseRow = lr as Record<string, unknown>
  }

  const tenant = licenseRow.tenants as Record<string, unknown> | null
  if (!assertOriginAllowedForTenantRequest(req, tenant)) {
    return json(403, { ok: false, error: 'Domain nicht freigegeben' })
  }

  const features = mergeFeatures(licenseRow)
  if (features.beta_feedback !== true) {
    return json(403, { ok: false, error: 'Modul Beta-Feedback für diese Lizenz nicht aktiv' })
  }

  const mandantSupabaseUrl = tenant?.supabase_url != null ? String(tenant.supabase_url).trim() : ''
  if (!mandantSupabaseUrl) {
    return json(503, { ok: false, error: 'Mandanten-Supabase-URL nicht konfiguriert' })
  }

  const baseUrl = mandantSupabaseUrl.replace(/\/$/, '')
  let mandantUserId: string
  try {
    const JWKS = createRemoteJWKSet(new URL(`${baseUrl}/auth/v1/.well-known/jwks.json`))
    const { payload } = await jwtVerify(jwt, JWKS, {
      issuer: `${baseUrl}/auth/v1`,
    })
    const sub = payload.sub
    if (!sub || typeof sub !== 'string') {
      return json(401, { ok: false, error: 'Ungültiges Token' })
    }
    mandantUserId = sub
  } catch (e) {
    console.warn('jwtVerify', e instanceof Error ? e.message : e)
    return json(401, { ok: false, error: 'Ungültige oder abgelaufene Session' })
  }

  const tenantId = String(licenseRow.tenant_id)
  const licenseNumberStored =
    licenseRow.license_number != null ? String(licenseRow.license_number).trim() : licenseNumberParam

  const startUtc = new Date()
  startUtc.setUTCHours(0, 0, 0, 0)
  const { count, error: cntErr } = await admin
    .from('beta_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('mandant_user_id', mandantUserId)
    .gte('created_at', startUtc.toISOString())

  if (cntErr) {
    console.warn('beta_feedback count', cntErr.message)
  } else if ((count ?? 0) >= DAILY_SUBMIT_MAX) {
    return json(429, {
      ok: false,
      error: `Maximal ${DAILY_SUBMIT_MAX} Feedbacks pro Nutzer und Tag.`,
    })
  }

  const { data: inserted, error: insErr } = await admin
    .from('beta_feedback')
    .insert({
      tenant_id: tenantId,
      license_number: licenseNumberStored || null,
      mandant_user_id: mandantUserId,
      source_app: sourceApp,
      route_path: routePath,
      route_query: routeQuery || null,
      category,
      severity,
      title: title || null,
      description,
      app_version: appVersion || null,
      release_label: releaseLabel || null,
    })
    .select('id')
    .maybeSingle()

  if (insErr) {
    console.warn('beta_feedback insert', insErr.message)
    return json(500, { ok: false, error: 'Speichern fehlgeschlagen' })
  }

  return json(200, {
    ok: true,
    id: inserted?.id ?? null,
    message: 'Vielen Dank, Ihr Feedback wurde übermittelt.',
  })
})
