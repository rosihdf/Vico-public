import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

type DigestRow = {
  object_id: string
  customer_name: string
  bv_name: string
  internal_id: string | null
  object_name: string | null
  status: string
  next_maintenance_date: string | null
  days_until_due: number | null
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

const isDueForSend = (
  frequency: string,
  lastSent: string | null,
  now: Date
): boolean => {
  if (!lastSent) return true
  const last = new Date(lastSent)
  if (Number.isNaN(last.getTime())) return true
  if (frequency === 'daily') {
    return last.toDateString() !== now.toDateString()
  }
  const weekMs = 7 * 24 * 60 * 60 * 1000
  return now.getTime() - last.getTime() >= weekMs
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const cronSecret = (Deno.env.get('MAINTENANCE_DIGEST_CRON_SECRET') ?? '').trim()
    const headerSecret = (req.headers.get('x-cron-secret') ?? '').trim()

    if (!cronSecret) {
      return new Response(
        JSON.stringify({ error: 'MAINTENANCE_DIGEST_CRON_SECRET nicht konfiguriert.' }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (headerSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY nicht konfiguriert.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Supabase-Umgebung unvollständig.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const logEvent = async (status: 'ok' | 'failed', recipientEmail: string, providerMessageId?: string, errorText?: string) => {
      await supabase.rpc('log_email_delivery_event', {
        p_provider: 'resend',
        p_channel: 'maintenance_digest',
        p_status: status,
        p_recipient_email: recipientEmail,
        p_provider_message_id: providerMessageId ?? null,
        p_error_code: null,
        p_error_text: errorText ?? null,
      })
      await mirrorUsageToLicensePortal(status)
    }
    const fromEmail = Deno.env.get('RESEND_FROM') || 'Vico Türen & Tore <onboarding@resend.dev>'

    const { data: orgRow } = await supabase
      .from('monteur_report_settings')
      .select('maintenance_digest_local_time, maintenance_digest_timezone, app_public_url')
      .eq('id', 1)
      .maybeSingle()

    const tz = String(orgRow?.maintenance_digest_timezone ?? 'Europe/Berlin')
    const timeStr = String(orgRow?.maintenance_digest_local_time ?? '07:00')
    const tp = timeStr.split(':')
    const wantHour = Math.min(23, Math.max(0, parseInt(tp[0] ?? '7', 10) || 7))

    const now = new Date()
    const hourFmt = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: tz,
    })
    const curHour = parseInt(hourFmt.format(now), 10)
    if (curHour !== wantHour) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: `Außerhalb des Versandfensters (lokal ${tz}: Stunde ${curHour}, konfiguriert ${wantHour}).`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const configuredAppUrl = (orgRow?.app_public_url as string | null)?.trim()
    const appUrl = configuredAppUrl || Deno.env.get('APP_URL') || 'https://app.example.com'
    const base = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl

    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select(
        'id, email, maintenance_reminder_email_enabled, maintenance_reminder_email_frequency, maintenance_reminder_email_last_sent_at, maintenance_reminder_email_consent_at'
      )
      .eq('maintenance_reminder_email_enabled', true)
      .not('email', 'is', null)
      .not('maintenance_reminder_email_consent_at', 'is', null)
      .in('role', ['admin', 'teamleiter', 'mitarbeiter', 'operator', 'leser'])

    if (profErr || !profiles) {
      return new Response(JSON.stringify({ error: profErr?.message ?? 'Profil-Ladefehler' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let emailsSent = 0
    let usersProcessed = 0

    for (const p of profiles) {
      const frequency = (p.maintenance_reminder_email_frequency as string) === 'daily' ? 'daily' : 'weekly'
      const lastSent = p.maintenance_reminder_email_last_sent_at as string | null
      if (!isDueForSend(frequency, lastSent, now)) continue

      const { data: rows, error: rpcErr } = await supabase.rpc('get_maintenance_reminders_for_user_digest', {
        p_user_id: p.id,
      })
      if (rpcErr) continue
      usersProcessed++
      const list = (rows ?? []) as DigestRow[]
      const relevant = list.filter((r) => r.status === 'overdue' || r.status === 'due_soon')
      if (relevant.length === 0) continue

      const email = String(p.email ?? '').trim()
      if (!email) continue

      const rowsHtml = relevant
        .slice(0, 50)
        .map((r) => {
          const label = r.internal_id ?? r.object_name ?? 'Objekt'
          const due =
            r.next_maintenance_date != null ? String(r.next_maintenance_date).slice(0, 10) : '—'
          const st = r.status === 'overdue' ? 'überfällig' : 'bald fällig'
          return `<tr><td style="padding:6px;border:1px solid #e2e8f0;">${escapeHtml(label)}</td><td style="padding:6px;border:1px solid #e2e8f0;">${escapeHtml(r.customer_name ?? '')}</td><td style="padding:6px;border:1px solid #e2e8f0;">${escapeHtml(r.bv_name ?? '')}</td><td style="padding:6px;border:1px solid #e2e8f0;">${due}</td><td style="padding:6px;border:1px solid #e2e8f0;">${st}</td></tr>`
        })
        .join('')

      const subject = `Wartungserinnerung: ${relevant.length} Objekt(e) fällig oder bald fällig`
      const html = `
        <p>Guten Tag,</p>
        <p>folgende Wartungen sind <strong>überfällig</strong> oder stehen in den <strong>nächsten 30 Tagen</strong> an:</p>
        <table style="border-collapse:collapse;font-size:14px;max-width:640px;">
          <thead><tr>
            <th align="left" style="padding:6px;border:1px solid #cbd5e1;">Objekt</th>
            <th align="left" style="padding:6px;border:1px solid #cbd5e1;">Kunde</th>
            <th align="left" style="padding:6px;border:1px solid #cbd5e1;">BV</th>
            <th align="left" style="padding:6px;border:1px solid #cbd5e1;">Nächste Wartung</th>
            <th align="left" style="padding:6px;border:1px solid #cbd5e1;">Status</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        ${relevant.length > 50 ? `<p>… und weitere Einträge (max. 50 in dieser E-Mail).</p>` : ''}
        <p><a href="${base}" style="color:#5b7895;">Zur Vico-App</a></p>
        <p class="text-xs" style="color:#64748b;font-size:12px;">Sie erhalten diese Nachricht, weil Sie in den Einstellungen E-Mail-Erinnerungen zur Wartungsplanung aktiviert haben. Die Verarbeitung erfolgt gemäß den geltenden Datenschutzregeln Ihres Betriebs.</p>
      `

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
      if (!res.ok) {
        await logEvent('failed', email, undefined, resendResult?.message || resendResult?.detail || `HTTP ${res.status}`)
        continue
      }

      emailsSent++
      await logEvent('ok', email, resendResult?.id)
      await supabase
        .from('profiles')
        .update({ maintenance_reminder_email_last_sent_at: new Date().toISOString() })
        .eq('id', p.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        users_considered: profiles.length,
        users_with_rpc: usersProcessed,
        emails_sent: emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
