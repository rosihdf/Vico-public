/**
 * Referenz-Implementierung / Parität zur Supabase-Edge-Function `supabase-license-portal/supabase/functions/license`.
 * Bei ausschließlich Cloudflare Pages ist der produktive Endpunkt die Edge Function (`VITE_LICENSE_API_URL` → …/functions/v1).
 */
import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  extractHostnameFromOriginOrReferer,
  tenantMatchesRequestHost,
} from '../../../shared/licenseHostLookup'

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

/** CORS: Haupt-App (andere Origin) ruft /api/license per fetch – Browser braucht diese Header + OPTIONS. */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type',
}

const jsonHeaders = (extra?: Record<string, string>) => ({
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
  ...CORS_HEADERS,
  ...extra,
})

type LicenseResponse = {
  /** Pro Mandant; u. a. für neue Geräte nach Login (Host-Lookup ohne gespeicherte Nummer) */
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
    /** Erhöht im Lizenzportal-Admin → Mandanten-Apps erkennen Änderung per Polling */
    client_config_version: number
  }
  design: {
    app_name: string
    tenant_name?: string | null
    logo_url: string | null
    primary_color: string
    secondary_color?: string | null
    favicon_url?: string | null
  }
  impressum?: Record<string, string | null>
  datenschutz?: Record<string, string | null>
  appVersions?: Record<string, AppVersionEntry>
  /** §11.20: aktiver Release + Incoming-Liste pro erkanntem Kanal */
  mandantenReleases?: {
    channel: 'main' | 'kundenportal' | 'arbeitszeit_portal'
    active: {
      id: string
      version: string
      releaseType: string
      title: string | null
      notes: string | null
      moduleTags: string[]
      affectsLine: string | null
      forceHardReload: boolean
    } | null
    incoming: Array<{
      id: string
      version: string
      releaseType: string
      title: string | null
      notes: string | null
      moduleTags: string[]
      affectsLine: string | null
      forceHardReload: boolean
    }>
    /** `tenant_release_assignments.updated_at` – Signal für Mandanten-Apps (Go-Live/Rollback) */
    releaseAssignmentUpdatedAt: string | null
  }
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
}

const LICENSE_WITH_TENANT_SELECT = `
  id,
  tenant_id,
  license_number,
  tier,
  valid_until,
  is_trial,
  grace_period_days,
  max_users,
  max_customers,
  max_storage_mb,
  check_interval,
  features,
  client_config_version,
  tenants (
    id,
    name,
    app_name,
    logo_url,
    primary_color,
    secondary_color,
    favicon_url,
    allowed_domains,
    impressum_company_name,
    impressum_address,
    impressum_contact,
    impressum_represented_by,
    impressum_register,
    impressum_vat_id,
    datenschutz_responsible,
    datenschutz_contact_email,
    datenschutz_dsb_email,
    app_domain,
    portal_domain,
    arbeitszeitenportal_domain,
    app_versions,
    maintenance_mode_enabled,
    maintenance_mode_message,
    maintenance_mode_started_at,
    maintenance_mode_ends_at,
    maintenance_mode_duration_min,
    maintenance_mode_auto_end,
    maintenance_mode_apply_main_app,
    maintenance_mode_apply_arbeitszeit_portal,
    maintenance_mode_apply_customer_portal,
    maintenance_announcement_enabled,
    maintenance_announcement_message,
    maintenance_announcement_from,
    maintenance_announcement_until
  )
`

const getRequestHostFromEvent = (event: HandlerEvent): string => {
  const origin = event.headers?.origin ?? event.headers?.Origin ?? ''
  const referer = event.headers?.referer ?? event.headers?.Referer ?? ''
  const headerForHost = origin.trim() || referer.trim()
  return extractHostnameFromOriginOrReferer(headerForHost)
}

const MANDANTEN_RELEASE_INCOMING_MAX = 3

type ReleaseChannel = 'main' | 'kundenportal' | 'arbeitszeit_portal'

const hostOnly = (urlish: string | null | undefined): string => {
  if (urlish == null || !String(urlish).trim()) return ''
  const s = String(urlish).trim()
  try {
    if (/^https?:\/\//i.test(s)) return new URL(s).host.toLowerCase()
  } catch {
    /* ignore */
  }
  return s.replace(/^https?:\/\//i, '').split('/')[0]?.toLowerCase().trim() ?? ''
}

/** Kanal aus Host vs. Mandanten-Domains (§11.20 Kanalzuordnung). */
const detectReleaseChannel = (tenant: Record<string, unknown>, requestHost: string): ReleaseChannel => {
  const h = requestHost.trim().toLowerCase()
  if (!h) return 'main'
  const pd = hostOnly(tenant.portal_domain as string)
  const az = hostOnly(tenant.arbeitszeitenportal_domain as string)
  const ad = hostOnly(tenant.app_domain as string)
  if (pd && h === pd) return 'kundenportal'
  if (az && h === az) return 'arbeitszeit_portal'
  if (ad && h === ad) return 'main'
  return 'main'
}

const splitNotesLines = (notes: string | null | undefined): string[] => {
  if (!notes) return []
  return notes
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
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

const assertOriginAllowedForTenant = (event: HandlerEvent, tenant: Record<string, unknown> | null): boolean => {
  const allowedDomains = tenant?.allowed_domains as string[] | null | undefined
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) return true

  const origin = event.headers?.origin ?? event.headers?.Origin ?? event.headers?.referer ?? event.headers?.Referer ?? ''
  let requestHost = ''
  try {
    requestHost = origin ? new URL(origin.trim()).host : ''
  } catch {
    requestHost = ''
  }
  if (!requestHost) return false

  const isAllowed = allowedDomains.some((d) => {
    const domain = String(d).trim().toLowerCase()
    if (!domain) return false
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(1)
      return requestHost === suffix || requestHost.endsWith(suffix)
    }
    return requestHost === domain
  })
  return Boolean(isAllowed)
}

const buildLicenseJson = (licenseRow: Record<string, unknown>, globalAppCfg: { value?: unknown } | null): LicenseResponse => {
  const tenant = licenseRow.tenants as Record<string, unknown> | null

  const validUntil = licenseRow.valid_until ? new Date(String(licenseRow.valid_until)) : null
  const isExpired = validUntil !== null && validUntil < new Date()
  const graceDays = Math.max(0, Number(licenseRow.grace_period_days) || 0)
  const graceEnd = validUntil && graceDays > 0 ? new Date(validUntil.getTime()) : null
  if (graceEnd) graceEnd.setDate(graceEnd.getDate() + graceDays)
  const withinGrace = isExpired && graceEnd !== null && graceEnd >= new Date()
  const readOnly = withinGrace

  const clientConfigVersion = Math.max(0, Math.floor(Number(licenseRow.client_config_version) || 0))
  const licenseNumberRaw =
    licenseRow.license_number != null ? String(licenseRow.license_number).trim() : ''

  const response: LicenseResponse = {
    ...(licenseNumberRaw ? { license_number: licenseNumberRaw } : {}),
    license: {
      tier: (licenseRow.tier as string) ?? 'professional',
      valid_until: licenseRow.valid_until as string | null,
      grace_period_days: graceDays,
      max_users: licenseRow.max_users as number | null,
      max_customers: licenseRow.max_customers as number | null,
      max_storage_mb: (licenseRow.max_storage_mb as number | null) ?? null,
      check_interval: (licenseRow.check_interval as 'on_start' | 'daily' | 'weekly') ?? 'daily',
      features: (licenseRow.features as Record<string, boolean>) ?? {},
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
  }

  const globalRaw = globalAppCfg?.value ?? {}
  const mergedRaw = mergeGlobalAndTenantAppVersions(globalRaw, tenant?.app_versions)
  const appVersions = parseAppVersionsForResponse(mergedRaw)
  if (appVersions) {
    response.appVersions = appVersions
  }

  response.maintenance = {
    mode_enabled: Boolean(tenant?.maintenance_mode_enabled),
    mode_message: (tenant?.maintenance_mode_message as string | null) ?? null,
    mode_starts_at: (tenant?.maintenance_mode_started_at as string | null) ?? null,
    mode_ends_at: (tenant?.maintenance_mode_ends_at as string | null) ?? null,
    mode_duration_min:
      tenant?.maintenance_mode_duration_min != null
        ? Math.max(1, Number(tenant.maintenance_mode_duration_min) || 0)
        : null,
    mode_auto_end: Boolean(tenant?.maintenance_mode_auto_end),
    mode_apply_main_app: tenant?.maintenance_mode_apply_main_app !== false,
    mode_apply_arbeitszeit_portal: tenant?.maintenance_mode_apply_arbeitszeit_portal !== false,
    mode_apply_customer_portal: tenant?.maintenance_mode_apply_customer_portal !== false,
    announcement_enabled: Boolean(tenant?.maintenance_announcement_enabled),
    announcement_message: (tenant?.maintenance_announcement_message as string | null) ?? null,
    announcement_from: (tenant?.maintenance_announcement_from as string | null) ?? null,
    announcement_until: (tenant?.maintenance_announcement_until as string | null) ?? null,
  }

  return response
}

const handler: Handler = async (event: HandlerEvent): Promise<{ statusCode: number; body: string; headers?: Record<string, string> }> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '', headers: { ...CORS_HEADERS, 'Cache-Control': 'private, no-store' } }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: jsonHeaders(),
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const licenseNumber = event.queryStringParameters?.licenseNumber?.trim()

  const url = process.env.SUPABASE_LICENSE_PORTAL_URL
  const key = process.env.SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY
  if (!url || !key) {
    return {
      statusCode: 500,
      headers: jsonHeaders(),
      body: JSON.stringify({ error: 'License portal not configured' }),
    }
  }

  const supabase = createClient(url, key)

  const requestHost = getRequestHostFromEvent(event)

  let licenseRow: Record<string, unknown> | null
  let globalAppCfg: { value?: unknown } | null

  if (licenseNumber) {
    const [{ data: licRow, error: licenseError }, { data: gac }] = await Promise.all([
      supabase.from('licenses').select(LICENSE_WITH_TENANT_SELECT).eq('license_number', licenseNumber).maybeSingle(),
      supabase.from('platform_config').select('value').eq('key', 'default_app_versions').maybeSingle(),
    ])
    globalAppCfg = gac
    if (licenseError || !licRow) {
      return {
        statusCode: 404,
        headers: jsonHeaders(),
        body: JSON.stringify({ error: 'License not found' }),
      }
    }
    licenseRow = licRow as Record<string, unknown>
  } else {
    if (!requestHost) {
      return {
        statusCode: 400,
        headers: jsonHeaders(),
        body: JSON.stringify({
          error:
            'licenseNumber fehlt: Host-Lookup erfordert einen Browser-Request mit Origin/Referer (oder ?licenseNumber= für Tests)',
        }),
      }
    }

    const { data: tenantRows, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, portal_domain, arbeitszeitenportal_domain, app_domain, allowed_domains')

    if (tenantErr) {
      console.error('license host lookup tenants', tenantErr)
      return {
        statusCode: 500,
        headers: jsonHeaders(),
        body: JSON.stringify({ error: 'Host-Lookup fehlgeschlagen' }),
      }
    }

    const matches = (tenantRows ?? []).filter((t) => tenantMatchesRequestHost(t, requestHost))
    if (matches.length > 1) {
      return {
        statusCode: 409,
        headers: jsonHeaders(),
        body: JSON.stringify({
          error: 'Mehrere Mandanten für diesen Host – Domains in portal_domain / allowed_domains prüfen',
        }),
      }
    }
    if (matches.length === 0) {
      return {
        statusCode: 404,
        headers: jsonHeaders(),
        body: JSON.stringify({ error: 'License not found' }),
      }
    }

    const tenantId = matches[0].id as string

    const [{ data: licRow, error: licErr }, { data: gac }] = await Promise.all([
      supabase
        .from('licenses')
        .select(LICENSE_WITH_TENANT_SELECT)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('platform_config').select('value').eq('key', 'default_app_versions').maybeSingle(),
    ])
    globalAppCfg = gac
    if (licErr || !licRow) {
      return {
        statusCode: 404,
        headers: jsonHeaders(),
        body: JSON.stringify({ error: 'License not found' }),
      }
    }
    licenseRow = licRow as Record<string, unknown>
  }

  if (!licenseRow) {
    return {
      statusCode: 404,
      headers: jsonHeaders(),
      body: JSON.stringify({ error: 'License not found' }),
    }
  }
  const tenant = licenseRow.tenants as Record<string, unknown> | null

  if (!assertOriginAllowedForTenant(event, tenant)) {
    return {
      statusCode: 403,
      headers: jsonHeaders(),
      body: JSON.stringify({ error: 'Domain nicht für diese Lizenz freigegeben' }),
    }
  }

  const body = buildLicenseJson(licenseRow, globalAppCfg)

  const tenantForRelease = licenseRow.tenants as Record<string, unknown> | null
  const tenantIdForRelease = tenantForRelease?.id != null ? String(tenantForRelease.id) : ''
  if (tenantIdForRelease) {
    try {
      const ch = detectReleaseChannel(tenantForRelease, requestHost)
      await mergeMandantenReleasesIntoResponse(supabase, tenantIdForRelease, ch, body)
    } catch (e) {
      console.warn('mandantenReleases skipped (Schema oder Fehler):', e)
    }
  }

  return {
    statusCode: 200,
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  }
}

export { handler }
