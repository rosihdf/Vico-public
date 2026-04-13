import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  report_id: string
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY nicht konfiguriert.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const portalUrl = (Deno.env.get('PORTAL_URL') ?? '').trim()
    const fromEmail = Deno.env.get('RESEND_FROM') || 'Vico Türen & Tore <onboarding@resend.dev>'

    if (!portalUrl) {
      return new Response(
        JSON.stringify({
          error:
            'PORTAL_URL ist nicht gesetzt. In Supabase → Edge Functions → Secrets die öffentliche Kundenportal-Basis-URL eintragen (z. B. https://….pages.dev oder Custom Domain, ohne trailing slash).',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const logEvent = async (status: 'ok' | 'failed', recipientEmail: string, providerMessageId?: string, errorText?: string) => {
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

    const body = (await req.json()) as RequestBody
    const { report_id } = body

    if (!report_id) {
      return new Response(
        JSON.stringify({ error: 'report_id ist erforderlich.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: report, error: reportError } = await supabase
      .from('maintenance_reports')
      .select('id, maintenance_date, object_id')
      .eq('id', report_id)
      .single()

    if (reportError || !report) {
      return new Response(
        JSON.stringify({ error: 'Bericht nicht gefunden.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: object, error: objError } = await supabase
      .from('objects')
      .select('id, name, internal_id, bv_id, customer_id')
      .eq('id', report.object_id)
      .single()

    if (objError || !object) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'Objekt nicht gefunden.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let customerId: string | null = null
    let bvName = ''
    let bvDeliveryRow: {
      uses_customer_report_delivery?: boolean | null
      maintenance_report_portal?: boolean | null
    } | null = null

    if (object.bv_id) {
      const { data: bv, error: bvError } = await supabase
        .from('bvs')
        .select('id, name, customer_id, uses_customer_report_delivery, maintenance_report_portal')
        .eq('id', object.bv_id)
        .single()
      if (bvError || !bv) {
        return new Response(
          JSON.stringify({ success: true, notified: 0, message: 'BV nicht gefunden.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      customerId = bv.customer_id
      bvName = bv.name ?? ''
      bvDeliveryRow = bv as typeof bvDeliveryRow
    } else {
      customerId = object.customer_id
      bvName = '—'
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'Kein Kunde am Objekt.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: customerRow, error: custError } = await supabase
      .from('customers')
      .select('maintenance_report_portal')
      .eq('id', customerId)
      .maybeSingle()

    if (custError) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'Kunde nicht lesbar.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const custPortal = (customerRow as { maintenance_report_portal?: boolean } | null)?.maintenance_report_portal !==
      false
    const useBvPortal =
      bvDeliveryRow != null && bvDeliveryRow.uses_customer_report_delivery === false
    const maintenancePortalAllowed = useBvPortal
      ? bvDeliveryRow!.maintenance_report_portal !== false
      : custPortal

    if (!maintenancePortalAllowed) {
      return new Response(
        JSON.stringify({
          success: true,
          notified: 0,
          message: 'Wartungsbericht ins Portal für diesen Kunden deaktiviert.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: portalUsers, error: puError } = await supabase
      .from('customer_portal_users')
      .select('email')
      .eq('customer_id', customerId)
      .not('email', 'is', null)

    if (puError || !portalUsers || portalUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'Keine Portal-Benutzer für diesen Kunden.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
          'Authorization': `Bearer ${apiKey}`,
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

    return new Response(
      JSON.stringify({ success: true, notified: sent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
