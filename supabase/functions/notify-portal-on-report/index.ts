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

const toYearMonth = (value: Date): string => {
  const y = value.getUTCFullYear()
  const m = String(value.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const mirrorUsageToLicensePortal = async (status: 'ok' | 'failed'): Promise<void> => {
  const lpUrl = (Deno.env.get('LP_SUPABASE_URL') ?? '').trim()
  const lpServiceRole = (Deno.env.get('LP_SERVICE_ROLE_KEY') ?? '').trim()
  const lpTenantId = (Deno.env.get('LP_TENANT_ID') ?? '').trim()
  if (!lpUrl || !lpServiceRole || !lpTenantId) return

  await fetch(`${lpUrl}/rest/v1/rpc/increment_tenant_email_monthly_usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: lpServiceRole,
      Authorization: `Bearer ${lpServiceRole}`,
    },
    body: JSON.stringify({
      p_tenant_id: lpTenantId,
      p_status: status,
      p_year_month: toYearMonth(new Date()),
    }),
  })
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

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      return jsonResponse(500, { error: 'RESEND_API_KEY nicht konfiguriert.' })
    }

    const portalUrl = (Deno.env.get('PORTAL_URL') ?? '').trim()
    const fromEmail = Deno.env.get('RESEND_FROM') || 'Vico Türen & Tore <onboarding@resend.dev>'

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
        p_provider: 'resend',
        p_channel: 'portal_notify',
        p_status: status,
        p_recipient_email: recipientEmail,
        p_provider_message_id: providerMessageId ?? null,
        p_error_code: null,
        p_error_text: errorText ?? null,
      })
      await mirrorUsageToLicensePortal(status)
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
    const subject = `Neuer Wartungsbericht: ${objectLabel} – ${dateStr}`
    const loginUrl = portalUrl.endsWith('/') ? portalUrl : `${portalUrl}/`

    const html = `
      <p>Guten Tag,</p>
      <p>für Ihren Kunden wurde ein neuer Wartungsbericht erstellt:</p>
      <ul>
        <li><strong>Objekt:</strong> ${objectLabel}</li>
        <li><strong>BV:</strong> ${bvName}</li>
        <li><strong>Datum:</strong> ${dateStr}</li>
      </ul>
      <p>Sie können den Bericht im Kundenportal einsehen und das PDF herunterladen:</p>
      <p><a href="${loginUrl}" style="color: #5b7895;">Zum Vico Türen & Tore Kundenportal</a></p>
      <p>Mit freundlichen Grüßen<br>Vico Türen & Tore</p>
    `

    const emails = [...new Set(portalUsers.map((u) => u.email).filter(Boolean))]
    let sent = 0

    for (const email of emails) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject,
          html,
        }),
      })
      const resendResult = await res.json().catch(() => ({}))
      if (res.ok) {
        sent++
        await logEvent('ok', email, resendResult?.id)
      } else {
        await logEvent('failed', email, undefined, resendResult?.message || resendResult?.detail || `HTTP ${res.status}`)
      }
    }

    return jsonResponse(200, { success: true, notified: sent })
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'Unbekannter Fehler',
    })
  }
})
