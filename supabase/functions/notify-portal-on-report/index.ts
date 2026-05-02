import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  report_id: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

type ObjectRow = {
  id: string
  name: string | null
  internal_id: string | null
  bv_id: string | null
  customer_id: string | null
}

type ReportWithObject = {
  id: string
  maintenance_date: string
  object_id: string
  objects: ObjectRow | ObjectRow[] | null
}

const normalizeLpSupabaseBase = (raw: string): string => raw.trim().replace(/\/$/, '')

/**
 * Zentraler Versand über Lizenzportal `send-tenant-email` (SMTP/Resend dort konfiguriert).
 * Nutzungszähler und LP-Mail-Logs erfolgen in der Function — kein `increment_tenant_email_monthly_usage` hier.
 *
 * Optional `MANDANT_APP_ORIGIN`: öffentliche Basis-URL der Monteur-App (z. B. https://….pages.dev),
 * wenn im LP für den Mandanten `allowed_domains` gesetzt ist (Origin-/Referer-Prüfung).
 */
const sendTenantEmailViaLicensePortal = async (opts: {
  lpSupabaseUrl: string
  mandantJwt: string
  mandantAnonKey: string
  tenantId: string
  to: string
  callerOrigin: string
  templateKey: string
  context: Record<string, unknown>
  locale?: string
  /** Nur Fallback, wenn die Vorlage leer bleibt. */
  fallbackSubject?: string
  fallbackHtml?: string
}): Promise<{ ok: true; messageId?: string | null } | { ok: false; error: string }> => {
  const base = normalizeLpSupabaseBase(opts.lpSupabaseUrl)
  const url = `${base}/functions/v1/send-tenant-email`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${opts.mandantJwt}`,
    'x-mandant-anon-key': opts.mandantAnonKey,
  }
  const origin = opts.callerOrigin.trim()
  if (origin) {
    try {
      const u = new URL(origin.includes('://') ? origin : `https://${origin}`)
      const o = `${u.protocol}//${u.host}`
      headers.Origin = o
      headers.Referer = `${o}/`
    } catch {
      /* ohne Origin: bei gesetztem allowed_domains liefert LP ggf. 403 */
    }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenantId: opts.tenantId,
        to: opts.to,
        templateKey: opts.templateKey,
        context: opts.context,
        locale: opts.locale ?? 'de',
        ...(opts.fallbackSubject ? { subject: opts.fallbackSubject } : {}),
        ...(opts.fallbackHtml ? { html: opts.fallbackHtml } : {}),
      }),
    })
    const bodyJson = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const err =
        typeof bodyJson.error === 'string' && bodyJson.error.trim()
          ? bodyJson.error.trim()
          : `Lizenzportal Mail HTTP ${res.status}`
      return { ok: false, error: err }
    }
    const mid = bodyJson.messageId
    return {
      ok: true,
      messageId: mid === null || typeof mid === 'string' ? (mid as string | null) : null,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

const normalizeObjectEmbed = (raw: ObjectRow | ObjectRow[] | null): ObjectRow | null => {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
}

/** RLS: maintenance_reports + objects!inner → nur sichtbare Objekte/Kundenkontext. */
const assertCallerMayNotifyForReport = async (
  userClient: SupabaseClient,
  reportId: string
): Promise<
  | { ok: true; report: ReportWithObject; object: ObjectRow }
  | { ok: false; status: number; body: Record<string, unknown> }
> => {
  const { data: row, error } = await userClient
    .from('maintenance_reports')
    .select(
      `
      id,
      maintenance_date,
      object_id,
      objects!inner (
        id,
        name,
        internal_id,
        bv_id,
        customer_id
      )
    `
    )
    .eq('id', reportId)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 403, body: { error: 'Keine Berechtigung für diesen Bericht.' } }
  }
  const report = row as ReportWithObject | null
  const object = normalizeObjectEmbed(report?.objects ?? null)
  if (!report?.id || !object?.id) {
    return { ok: false, status: 403, body: { error: 'Keine Berechtigung für diesen Bericht.' } }
  }
  return { ok: true, report, object }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'Nicht autorisiert.' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse(500, { error: 'Supabase nicht konfiguriert (URL, Service Role oder Anon Key).' })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !caller) {
      return jsonResponse(401, { error: 'Nicht autorisiert.' })
    }

    const { data: role, error: roleErr } = await userClient.rpc('get_my_role')
    if (roleErr || role === 'leser') {
      return jsonResponse(403, { error: 'Keine Berechtigung für diese Aktion.' })
    }

    const lpSupabaseUrl = (Deno.env.get('LP_SUPABASE_URL') ?? '').trim()
    const lpTenantId = (Deno.env.get('LP_TENANT_ID') ?? '').trim()
    if (!lpSupabaseUrl || !lpTenantId) {
      return jsonResponse(500, {
        error:
          'Zentraler Mailversand: LP_SUPABASE_URL und LP_TENANT_ID müssen in den Edge-Function-Secrets gesetzt sein (Lizenzportal-Projekt).',
      })
    }
    if (!UUID_RE.test(lpTenantId)) {
      return jsonResponse(500, { error: 'LP_TENANT_ID ist keine gültige UUID.' })
    }

    const portalUrl = (Deno.env.get('PORTAL_URL') ?? '').trim()
    /** Für send-tenant-email Origin-Check (allowed_domains); oft gleiche Hostfamilie wie die Monteur-App. */
    const mandantAppOrigin = (Deno.env.get('MANDANT_APP_ORIGIN') ?? '').trim()

    if (!portalUrl) {
      return jsonResponse(500, {
        error:
          'PORTAL_URL ist nicht gesetzt. In Supabase → Edge Functions → Secrets die öffentliche Kundenportal-Basis-URL eintragen (z. B. https://….pages.dev oder Custom Domain, ohne trailing slash).',
      })
    }

    let body: RequestBody
    try {
      body = (await req.json()) as RequestBody
    } catch {
      return jsonResponse(400, { error: 'Ungültiger JSON-Body.' })
    }

    const reportId = typeof body.report_id === 'string' ? body.report_id.trim() : ''
    if (!reportId) {
      return jsonResponse(400, { error: 'report_id ist erforderlich.' })
    }
    if (!UUID_RE.test(reportId)) {
      return jsonResponse(400, { error: 'report_id ungültig.' })
    }

    const authz = await assertCallerMayNotifyForReport(userClient, reportId)
    if (!authz.ok) {
      return jsonResponse(authz.status, authz.body)
    }

    const { report, object } = authz

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const logEvent = async (
      status: 'ok' | 'failed',
      recipientEmail: string,
      providerMessageId?: string,
      errorText?: string
    ) => {
      await supabase.rpc('log_email_delivery_event', {
        p_provider: 'license_portal',
        p_channel: 'portal_notify',
        p_status: status,
        p_recipient_email: recipientEmail,
        p_provider_message_id: providerMessageId ?? null,
        p_error_code: null,
        p_error_text: errorText ?? null,
      })
    }

    let customerId: string | null = null
    let bvName = ''
    let bvDeliveryRow: {
      uses_customer_report_delivery?: boolean | null
      maintenance_report_portal?: boolean | null
    } | null = null

    if (object.bv_id) {
      const { data: bv, error: bvError } = await userClient
        .from('bvs')
        .select('id, name, customer_id, uses_customer_report_delivery, maintenance_report_portal')
        .eq('id', object.bv_id)
        .maybeSingle()
      if (bvError || !bv) {
        return jsonResponse(200, { success: true, notified: 0, message: 'BV nicht gefunden.' })
      }
      customerId = bv.customer_id as string
      bvName = (bv.name as string) ?? ''
      bvDeliveryRow = bv as typeof bvDeliveryRow
    } else {
      customerId = object.customer_id
      bvName = '—'
    }

    if (!customerId) {
      return jsonResponse(200, { success: true, notified: 0, message: 'Kein Kunde am Objekt.' })
    }

    const { data: customerRow, error: custError } = await userClient
      .from('customers')
      .select('maintenance_report_portal')
      .eq('id', customerId)
      .maybeSingle()

    if (custError) {
      return jsonResponse(200, { success: true, notified: 0, message: 'Kunde nicht lesbar.' })
    }

    const custPortal = (customerRow as { maintenance_report_portal?: boolean } | null)?.maintenance_report_portal !==
      false
    const useBvPortal =
      bvDeliveryRow != null && bvDeliveryRow.uses_customer_report_delivery === false
    const maintenancePortalAllowed = useBvPortal
      ? bvDeliveryRow!.maintenance_report_portal !== false
      : custPortal

    if (!maintenancePortalAllowed) {
      return jsonResponse(200, {
        success: true,
        notified: 0,
        message: 'Wartungsbericht ins Portal für diesen Kunden deaktiviert.',
      })
    }

    const { data: portalUsers, error: puError } = await supabase
      .from('customer_portal_users')
      .select('email')
      .eq('customer_id', customerId)
      .not('email', 'is', null)

    if (puError || !portalUsers || portalUsers.length === 0) {
      return jsonResponse(200, {
        success: true,
        notified: 0,
        message: 'Keine Portal-Benutzer für diesen Kunden.',
      })
    }

    const objectLabel = object.internal_id ?? object.name ?? 'Objekt'
    const dateStr = String(report.maintenance_date).slice(0, 10)
    const loginUrlRaw = portalUrl.endsWith('/') ? portalUrl.slice(0, -1) : portalUrl
    const fallbackSubject = `Neuer Wartungsbericht: ${objectLabel} – ${dateStr}`
    const fallbackHtml = `
      <p>Guten Tag,</p>
      <p>für Ihren Kunden wurde ein neuer Wartungsbericht erstellt:</p>
      <ul>
        <li><strong>Objekt:</strong> ${objectLabel}</li>
        <li><strong>BV:</strong> ${bvName}</li>
        <li><strong>Datum:</strong> ${dateStr}</li>
      </ul>
      <p>Sie können den Bericht im Kundenportal einsehen und das PDF herunterladen:</p>
      <p><a href="${loginUrlRaw}/" style="color: #5b7895;">Zum Kundenportal</a></p>
      <p>Mit freundlichen Grüßen<br>ArioVan</p>
    `

    const emails = [...new Set(portalUsers.map((u) => u.email).filter(Boolean))]
    let sent = 0
    const mandantJwt = authHeader.slice(7).trim()

    for (const email of emails) {
      const mailResult = await sendTenantEmailViaLicensePortal({
        lpSupabaseUrl,
        mandantJwt,
        mandantAnonKey: anonKey,
        tenantId: lpTenantId,
        to: email,
        callerOrigin: mandantAppOrigin,
        templateKey: 'portal_report_notification',
        locale: 'de',
        context: {
          objekt: { name: objectLabel },
          bauvorhaben: { name: bvName },
          bericht: { datum: dateStr, link: '' },
          portal: { link: `${loginUrlRaw}/` },
        },
        fallbackSubject,
        fallbackHtml,
      })
      if (mailResult.ok) {
        sent++
        await logEvent('ok', email, mailResult.messageId ?? undefined)
      } else {
        await logEvent('failed', email, undefined, mailResult.error)
      }
    }

    return jsonResponse(200, { success: true, notified: sent })
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'Unbekannter Fehler',
    })
  }
})
