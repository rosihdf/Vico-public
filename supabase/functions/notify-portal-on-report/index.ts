import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  report_id: string
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
      .select('id, name, internal_id, bv_id')
      .eq('id', report.object_id)
      .single()

    if (objError || !object) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'Objekt nicht gefunden.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: bv, error: bvError } = await supabase
      .from('bvs')
      .select('id, name, customer_id')
      .eq('id', object.bv_id)
      .single()

    if (bvError || !bv) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'BV nicht gefunden.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: portalUsers, error: puError } = await supabase
      .from('customer_portal_users')
      .select('email')
      .eq('customer_id', bv.customer_id)
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
        <li><strong>BV:</strong> ${bv.name}</li>
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
      if (res.ok) sent++
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
