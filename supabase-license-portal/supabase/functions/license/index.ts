import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

/** Parität zu admin/netlify/functions/license.ts (Preflight, fetch-Header, mandantenReleases). Mandanten-Apps: bevorzugt diese Edge-URL (Cloudflare Pages + Supabase). */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
}

const APP_VERSION_KEYS = ['main', 'kundenportal', 'arbeitszeit_portal', 'admin'] as const

type AppVersionEntry = {
  version?: string
  releaseNotes?: string[]
  releaseLabel?: string
}

const normalizeEntry = (raw: unknown): AppVersionEntry | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const version = typeof o.version === 'string' && o.version.trim() ? o.version.trim() : undefined
  const rl =
    typeof o.releaseLabel === 'string'
      ? o.releaseLabel.trim()
      : typeof o.release_label === 'string'
        ? o.release_label.trim()
        : ''
  const releaseLabel = rl || undefined
  const n1 = Array.isArray(o.releaseNotes) ? o.releaseNotes.filter((x) => typeof x === 'string') : []
  const n2 = Array.isArray(o.release_notes) ? o.release_notes.filter((x) => typeof x === 'string') : []
  const releaseNotes = n1.length > 0 ? n1 : n2.length > 0 ? n2 : undefined
  if (!version && !releaseLabel && (!releaseNotes || releaseNotes.length === 0)) return undefined
  return { version, releaseNotes, releaseLabel }
}

const parseAppVersionsForResponse = (raw: unknown): Record<string, AppVersionEntry> | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Record<string, unknown>
  const out: Record<string, AppVersionEntry> = {}
  for (const k of APP_VERSION_KEYS) {
    const e = normalizeEntry(src[k])
    if (e) out[k] = e
  }
  return Object.keys(out).length > 0 ? out : undefined
}

const notesFromObj = (o: Record<string, unknown>): string[] | undefined => {
  const n1 = Array.isArray(o.releaseNotes) ? o.releaseNotes.filter((x) => typeof x === 'string') : []
  const n2 = Array.isArray(o.release_notes) ? o.release_notes.filter((x) => typeof x === 'string') : []
  const n = n1.length > 0 ? n1 : n2.length > 0 ? n2 : undefined
  return n && n.length > 0 ? n : undefined
}

/** Gleiche Logik wie shared/appVersions mergeRawAppVersionsJson (Edge-Deploy ohne Monorepo-Import). */
const mergeGlobalAndTenantAppVersions = (globalJson: unknown, tenantJson: unknown): Record<string, unknown> => {
  const g = globalJson && typeof globalJson === 'object' ? (globalJson as Record<string, unknown>) : {}
  const t = tenantJson && typeof tenantJson === 'object' ? (tenantJson as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  for (const k of APP_VERSION_KEYS) {
    const gv = g[k]
    const tv = t[k]
    if (gv === undefined && tv === undefined) continue
    const go = gv && typeof gv === 'object' ? { ...(gv as Record<string, unknown>) } : {}
    const to = tv && typeof tv === 'object' ? (tv as Record<string, unknown>) : {}
    const merged: Record<string, unknown> = { ...go, ...to }
    const tNotes = notesFromObj(to)
    const gNotes = notesFromObj(go)
    if (tNotes && tNotes.length > 0) merged.releaseNotes = tNotes
    else if (gNotes && gNotes.length > 0) merged.releaseNotes = gNotes
    delete merged.release_notes
    out[k] = merged
  }
  return out
}

/** Phase B: Host-Lookup – gleiche Semantik wie shared/licenseHostLookup.ts (Edge-Deploy ohne Monorepo-Import). */
const extractHostnameFromOriginOrReferer = (originOrReferer: string): string => {
  const t = originOrReferer.trim()
  if (!t) return ''
  try {
    const u = new URL(t)
    return u.hostname.toLowerCase()
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

const MANDANTEN_RELEASE_INCOMING_MAX = 3

type ReleaseChannel = 'main' | 'kundenportal' | 'arbeitszeit_portal'

const splitNotesLines = (notes: string | null | undefined): string[] => {
  if (!notes) return []
  return notes
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const detectReleaseChannel = (tenant: Record<string, unknown>, requestHost: string): ReleaseChannel => {
  const h = requestHost.trim().toLowerCase()
  if (!h) return 'main'
  const pd = normalizeTenantDomainField(tenant.portal_domain as string)
  const az = normalizeTenantDomainField(tenant.arbeitszeitenportal_domain as string)
  const ad = normalizeTenantDomainField(tenant.app_domain as string)
  if (pd && h === pd) return 'kundenportal'
  if (az && h === az) return 'arbeitszeit_portal'
  if (ad && h === ad) return 'main'
  return 'main'
}

const mapAppReleaseRow = (r: Record<string, unknown>) => {
  const tags = Array.isArray(r.module_tags) ? r.module_tags.map((x) => String(x)) : []
  return {
    id: String(r.id),
    version: String(r.version_semver),
    releaseType: String(r.release_type),
    title: r.title != null ? String(r.title) : null,
    notes: r.notes != null ? String(r.notes) : null,
    moduleTags: tags,
    affectsLine: tags.length > 0 ? `Betrifft: ${tags.join(', ')}` : null,
    forceHardReload: Boolean(r.force_hard_reload),
  }
}

const appVersionKeyForChannel = (ch: ReleaseChannel): (typeof APP_VERSION_KEYS)[number] =>
  ch === 'kundenportal' ? 'kundenportal' : ch === 'arbeitszeit_portal' ? 'arbeitszeit_portal' : 'main'

type LicenseResponse = {
  license_number?: string
  license: {
    tier: string
    valid_until: string | null
    grace_period_days: number
    max_users: number | null
    max_customers: number | null
    max_storage_mb: number | null
    check_interval: 'on_start' | 'daily' | 'weekly'
    features: Record<string, boolean>
    valid: boolean
    expired: boolean
    read_only: boolean
    is_trial: boolean
    client_config_version: number
  }
  design: {
    app_name: string
    tenant_name?: string | null
    logo_url: string | null
    kundenportal_url?: string | null
    primary_color: string
    secondary_color?: string | null
    favicon_url?: string | null
  }
  impressum?: Record<string, string | null>
  datenschutz?: Record<string, string | null>
  maintenance?: {
    mode_enabled: boolean
    mode_message: string | null
    mode_starts_at: string | null
    mode_ends_at: string | null
    mode_duration_min: number | null
    mode_auto_end: boolean
    mode_apply_main_app: boolean
    mode_apply_arbeitszeit_portal: boolean
    mode_apply_customer_portal: boolean
    announcement_enabled: boolean
    announcement_message: string | null
    announcement_from: string | null
    announcement_until: string | null
  }
  appVersions?: Record<string, AppVersionEntry>
  mandantenReleases?: {
    channel: ReleaseChannel
    active: ReturnType<typeof mapAppReleaseRow> | null
    incoming: ReturnType<typeof mapAppReleaseRow>[]
    releaseAssignmentUpdatedAt: string | null
  }
}

const mergeMandantenReleasesIntoResponse = async (
  supabase: SupabaseClient,
  tenantId: string,
  channel: ReleaseChannel,
  response: LicenseResponse
): Promise<void> => {
  const vKey = appVersionKeyForChannel(channel)

  const { data: assign, error: assignErr } = await supabase
    .from('tenant_release_assignments')
    .select('active_release_id, previous_release_id, updated_at')
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .maybeSingle()

  if (assignErr) {
    console.warn('tenant_release_assignments', assignErr.message)
  }

  const releaseAssignmentUpdatedAt =
    !assignErr && assign?.updated_at != null && String(assign.updated_at).trim()
      ? String(assign.updated_at)
      : null

  let active: ReturnType<typeof mapAppReleaseRow> | null = null
  const activeId =
    !assignErr && assign?.active_release_id != null ? String(assign.active_release_id) : null
  if (activeId) {
    const { data: rel, error: relErr } = await supabase
      .from('app_releases')
      .select('*')
      .eq('id', activeId)
      .eq('status', 'published')
      .maybeSingle()
    if (!relErr && rel) {
      active = mapAppReleaseRow(rel as Record<string, unknown>)
      const lines = splitNotesLines(active.notes ?? undefined)
      response.appVersions = {
        ...(response.appVersions ?? {}),
        [vKey]: {
          version: active.version,
          releaseLabel: active.title || active.version,
          releaseNotes: lines.length > 0 ? lines : undefined,
        },
      }
    }
  }

  const { data: incRows, error: incErr } = await supabase
    .from('app_releases')
    .select('*')
    .eq('channel', channel)
    .eq('incoming_enabled', true)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(40)

  if (incErr) {
    console.warn('app_releases incoming', incErr.message)
    response.mandantenReleases = { channel, active, incoming: [], releaseAssignmentUpdatedAt }
    return
  }

  const { data: ritRows, error: ritErr } = await supabase
    .from('release_incoming_tenants')
    .select('release_id')
    .eq('tenant_id', tenantId)

  if (ritErr) {
    console.warn('release_incoming_tenants', ritErr.message)
    response.mandantenReleases = { channel, active, incoming: [], releaseAssignmentUpdatedAt }
    return
  }

  const explicit = new Set((ritRows ?? []).map((x) => String(x.release_id)))

  const { data: tMeta, error: tMetaErr } = await supabase
    .from('tenants')
    .select('is_test_mandant')
    .eq('id', tenantId)
    .maybeSingle()
  if (tMetaErr) {
    console.warn('tenants is_test_mandant', tMetaErr.message)
  }
  const isTestMandant = Boolean(tMeta?.is_test_mandant)

  /** Incoming nur für explizit gelistete Mandanten oder Testmandanten (`incoming_all_mandanten` wird ignoriert). */
  const incoming: ReturnType<typeof mapAppReleaseRow>[] = []
  for (const row of incRows ?? []) {
    const r = row as Record<string, unknown>
    const rid = String(r.id)
    if (activeId && rid === activeId) continue
    if (explicit.has(rid) || isTestMandant) {
      incoming.push(mapAppReleaseRow(r))
      if (incoming.length >= MANDANTEN_RELEASE_INCOMING_MAX) break
    }
  }

  response.mandantenReleases = {
    channel,
    active,
    incoming,
    releaseAssignmentUpdatedAt,
  }
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

  const isAllowed = allowedDomains.some((d) => {
    const domain = String(d).trim().toLowerCase()
    if (!domain) return false
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(1)
      return requestHostFromHeader === suffix || requestHostFromHeader.endsWith(suffix)
    }
    return requestHostFromHeader === domain
  })
  return Boolean(isAllowed)
}

const jsonLicenseHeaders = () => ({
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const licenseNumber = new URL(req.url).searchParams.get('licenseNumber')?.trim()

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'License portal not configured' }), {
        status: 500,
        headers: jsonLicenseHeaders(),
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const requestHost = extractHostnameFromOriginOrReferer(
      (req.headers.get('origin') ?? '').trim() || (req.headers.get('referer') ?? '').trim()
    )

    const LICENSE_SELECT = `
        id,
        tenant_id,
        tier,
        valid_until,
        is_trial,
        grace_period_days,
        max_users,
        max_customers,
        max_storage_mb,
        check_interval,
        features,
        license_number,
        client_config_version,
        license_model_id,
        tenants (
          id,
          name,
          app_name,
          logo_url,
          kundenportal_url,
          primary_color,
          secondary_color,
          favicon_url,
          maintenance_mode_enabled,
          maintenance_mode_message,
          maintenance_mode_duration_min,
          maintenance_mode_started_at,
          maintenance_mode_ends_at,
          maintenance_mode_auto_end,
          maintenance_mode_apply_main_app,
          maintenance_mode_apply_arbeitszeit_portal,
          maintenance_mode_apply_customer_portal,
          maintenance_announcement_enabled,
          maintenance_announcement_message,
          maintenance_announcement_from,
          maintenance_announcement_until,
          allowed_domains,
          app_domain,
          portal_domain,
          arbeitszeitenportal_domain,
          impressum_company_name,
          impressum_address,
          impressum_contact,
          impressum_represented_by,
          impressum_register,
          impressum_vat_id,
          datenschutz_responsible,
          datenschutz_contact_email,
          datenschutz_dsb_email,
          app_versions
        ),
        license_models (features)
      `

    let licenseRow: Record<string, unknown>
    let globalAppCfg: { value?: unknown } | null = null

    if (licenseNumber) {
      const [{ data: lr, error: licenseError }, { data: gac }] = await Promise.all([
        supabase.from('licenses').select(LICENSE_SELECT).eq('license_number', licenseNumber).maybeSingle(),
        supabase.from('platform_config').select('value').eq('key', 'default_app_versions').maybeSingle(),
      ])
      globalAppCfg = gac
      if (licenseError || !lr) {
        return new Response(JSON.stringify({ error: 'License not found' }), {
          status: 404,
          headers: jsonLicenseHeaders(),
        })
      }
      licenseRow = lr as Record<string, unknown>
    } else {
      if (!requestHost) {
        return new Response(
          JSON.stringify({
            error:
              'licenseNumber fehlt: Host-Lookup erfordert einen Browser-Request mit Origin/Referer (oder ?licenseNumber= für Tests)',
          }),
          { status: 400, headers: jsonLicenseHeaders() }
        )
      }

      const { data: tenantRows, error: tenantErr } = await supabase
        .from('tenants')
        .select('id, portal_domain, arbeitszeitenportal_domain, app_domain, allowed_domains')

      if (tenantErr) {
        return new Response(JSON.stringify({ error: 'Host-Lookup fehlgeschlagen' }), {
          status: 500,
          headers: jsonLicenseHeaders(),
        })
      }

      const matches = (tenantRows ?? []).filter((t) => tenantMatchesRequestHost(t, requestHost))
      if (matches.length > 1) {
        return new Response(
          JSON.stringify({
            error: 'Mehrere Mandanten für diesen Host – Domains in portal_domain / allowed_domains prüfen',
          }),
          { status: 409, headers: jsonLicenseHeaders() }
        )
      }
      if (matches.length === 0) {
        return new Response(JSON.stringify({ error: 'License not found' }), {
          status: 404,
          headers: jsonLicenseHeaders(),
        })
      }

      const tenantId = matches[0].id as string

      const [{ data: lr, error: licErr }, { data: gac }] = await Promise.all([
        supabase
          .from('licenses')
          .select(LICENSE_SELECT)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('platform_config').select('value').eq('key', 'default_app_versions').maybeSingle(),
      ])
      globalAppCfg = gac
      if (licErr || !lr) {
        return new Response(JSON.stringify({ error: 'License not found' }), {
          status: 404,
          headers: jsonLicenseHeaders(),
        })
      }
      licenseRow = lr as Record<string, unknown>
    }

    const tenant = licenseRow.tenants as Record<string, unknown> | null
    if (!assertOriginAllowedForTenantRequest(req, tenant)) {
      return new Response(JSON.stringify({ error: 'Domain nicht für diese Lizenz freigegeben' }), {
        status: 403,
        headers: jsonLicenseHeaders(),
      })
    }

    const validUntil = licenseRow.valid_until ? new Date(licenseRow.valid_until as string) : null
    const isExpired = validUntil !== null && validUntil < new Date()
    const graceDays = Math.max(0, Number(licenseRow.grace_period_days) || 0)
    const graceEnd = validUntil && graceDays > 0 ? new Date(validUntil) : null
    if (graceEnd) graceEnd.setDate(graceEnd.getDate() + graceDays)
    const withinGrace = isExpired && graceEnd !== null && graceEnd >= new Date()
    const readOnly = withinGrace

    const licenseFeatures = (licenseRow.features as Record<string, boolean>) ?? {}
    const modelFeatures = (licenseRow.license_models as { features?: Record<string, boolean> } | null)?.features ?? {}
    /** Keine Tier-Auto-Features: nur Lizenzmodell + Lizenz-Zeile (manuell gepflegt). */
    const features = { ...modelFeatures, ...licenseFeatures }

    const clientConfigVersion = Math.max(0, Math.floor(Number(licenseRow.client_config_version) || 0))
    const licenseNumberRaw =
      licenseRow.license_number != null ? String(licenseRow.license_number).trim() : ''

    const response: LicenseResponse = {
      ...(licenseNumberRaw ? { license_number: licenseNumberRaw } : {}),
      license: {
        tier: licenseRow.tier ?? 'professional',
        valid_until: licenseRow.valid_until,
        grace_period_days: graceDays,
        max_users: licenseRow.max_users,
        max_customers: licenseRow.max_customers,
        max_storage_mb: licenseRow.max_storage_mb,
        check_interval: (licenseRow.check_interval as 'on_start' | 'daily' | 'weekly') ?? 'daily',
        features,
        valid: !isExpired || withinGrace,
        expired: isExpired,
        read_only: readOnly,
        is_trial: Boolean(licenseRow.is_trial),
        client_config_version: clientConfigVersion,
      },
      design: {
        app_name: (tenant?.app_name as string) ?? 'AMRtech',
        tenant_name:
          tenant?.name != null && String(tenant.name).trim() ? String(tenant.name).trim() : null,
        logo_url: (tenant?.logo_url as string) ?? null,
        kundenportal_url: (tenant?.kundenportal_url as string) ?? null,
        primary_color: (tenant?.primary_color as string) ?? '#5b7895',
        secondary_color: (tenant?.secondary_color as string) ?? null,
        favicon_url: (tenant?.favicon_url as string) ?? null,
      },
      impressum: tenant
        ? {
            company_name: tenant.impressum_company_name as string | null,
            address: tenant.impressum_address as string | null,
            contact: tenant.impressum_contact as string | null,
            represented_by: tenant.impressum_represented_by as string | null,
            register: tenant.impressum_register as string | null,
            vat_id: tenant.impressum_vat_id as string | null,
          }
        : undefined,
      datenschutz: tenant
        ? {
            responsible: tenant.datenschutz_responsible as string | null,
            contact_email: tenant.datenschutz_contact_email as string | null,
            dsb_email: tenant.datenschutz_dsb_email as string | null,
          }
        : undefined,
      maintenance: tenant
        ? {
            mode_enabled: Boolean(tenant.maintenance_mode_enabled),
            mode_message: (tenant.maintenance_mode_message as string | null) ?? null,
            mode_starts_at: (tenant.maintenance_mode_started_at as string | null) ?? null,
            mode_ends_at: (tenant.maintenance_mode_ends_at as string | null) ?? null,
            mode_duration_min:
              tenant.maintenance_mode_duration_min != null
                ? Number(tenant.maintenance_mode_duration_min)
                : null,
            mode_auto_end: Boolean(tenant.maintenance_mode_auto_end),
            mode_apply_main_app: tenant.maintenance_mode_apply_main_app !== false,
            mode_apply_arbeitszeit_portal: tenant.maintenance_mode_apply_arbeitszeit_portal !== false,
            mode_apply_customer_portal: tenant.maintenance_mode_apply_customer_portal !== false,
            announcement_enabled: Boolean(tenant.maintenance_announcement_enabled),
            announcement_message: (tenant.maintenance_announcement_message as string | null) ?? null,
            announcement_from: (tenant.maintenance_announcement_from as string | null) ?? null,
            announcement_until: (tenant.maintenance_announcement_until as string | null) ?? null,
          }
        : undefined,
    }

    const globalRaw = globalAppCfg?.value ?? {}
    const mergedRaw = mergeGlobalAndTenantAppVersions(globalRaw, tenant?.app_versions)
    const appVersions = parseAppVersionsForResponse(mergedRaw)
    if (appVersions) {
      response.appVersions = appVersions
    }

    const tenantForRelease = licenseRow.tenants as Record<string, unknown> | null
    const tenantIdForRelease = tenantForRelease?.id != null ? String(tenantForRelease.id) : ''
    if (tenantIdForRelease) {
      try {
        const ch = detectReleaseChannel(tenantForRelease, requestHost)
        await mergeMandantenReleasesIntoResponse(supabase, tenantIdForRelease, ch, response)
      } catch (e) {
        console.warn('mandantenReleases skipped (Schema oder Fehler):', e)
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: jsonLicenseHeaders(),
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }), {
      status: 500,
      headers: jsonLicenseHeaders(),
    })
  }
})
