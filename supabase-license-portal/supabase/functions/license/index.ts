import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

type LicenseResponse = {
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
  }
  design: {
    app_name: string
    logo_url: string | null
    primary_color: string
    secondary_color?: string | null
    favicon_url?: string | null
  }
  impressum?: Record<string, string | null>
  datenschutz?: Record<string, string | null>
  /** Mandantenweise gepflegte Version/Release Notes pro Frontend (optional). */
  appVersions?: Record<string, AppVersionEntry>
}

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
    const url = new URL(req.url)
    const licenseNumber = url.searchParams.get('licenseNumber')?.trim()
    if (!licenseNumber) {
      return new Response(
        JSON.stringify({ error: 'licenseNumber required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'License portal not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const [{ data: licenseRow, error: licenseError }, { data: globalAppCfg }] = await Promise.all([
      supabase
        .from('licenses')
        .select(`
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
        license_model_id,
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
          app_versions
        ),
        license_models (features)
      `)
        .eq('license_number', licenseNumber)
        .maybeSingle(),
      supabase.from('platform_config').select('value').eq('key', 'default_app_versions').maybeSingle(),
    ])

    if (licenseError || !licenseRow) {
      return new Response(
        JSON.stringify({ error: 'License not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenant = licenseRow.tenants as Record<string, unknown> | null
    const allowedDomains = tenant?.allowed_domains as string[] | null | undefined
    if (Array.isArray(allowedDomains) && allowedDomains.length > 0) {
      const origin = req.headers.get('origin') ?? req.headers.get('referer') ?? ''
      let requestHost = ''
      try {
        requestHost = origin ? new URL(origin).host : ''
      } catch {
        requestHost = ''
      }
      const isAllowed = requestHost && allowedDomains.some((d) => {
        const domain = String(d).trim().toLowerCase()
        if (!domain) return false
        if (domain.startsWith('*.')) {
          const suffix = domain.slice(1)
          return requestHost === suffix || requestHost.endsWith(suffix)
        }
        return requestHost === domain
      })
      if (!isAllowed) {
        return new Response(
          JSON.stringify({ error: 'Domain nicht für diese Lizenz freigegeben' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const validUntil = licenseRow.valid_until ? new Date(licenseRow.valid_until) : null
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

    const response: LicenseResponse = {
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
      },
      design: {
        app_name: (tenant?.app_name as string) ?? 'AMRtech',
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

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
