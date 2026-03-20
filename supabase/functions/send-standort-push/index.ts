/**
 * POST /send-standort-push
 * Sendet Web-Push-Benachrichtigung an Mitarbeiter bei Standortanfrage.
 * Body: { user_id: string }
 * Authorization: Bearer <anon oder user token>
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Nicht angemeldet' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const vapidKeysJson = Deno.env.get('VAPID_KEYS_JSON')
    if (!vapidKeysJson) {
      return new Response(
        JSON.stringify({ error: 'VAPID_KEYS_JSON nicht konfiguriert. Supabase Secrets prüfen.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let body: { user_id?: string } = {}
    try {
      body = (await req.json()) as { user_id?: string }
    } catch {
      body = {}
    }
    const userId = body.user_id
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'user_id erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Berechtigung prüfen: nur Admin/Teamleiter mit request_employee_location dürfen aufrufen
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: role } = await userClient.rpc('get_my_role')
    if (role !== 'admin' && role !== 'teamleiter') {
      return new Response(
        JSON.stringify({ error: 'Keine Berechtigung' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (subsError || !subs?.length) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Keine Push-Subscriptions für diesen Nutzer' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const vapidKeys = await webpush.importVapidKeys(JSON.parse(vapidKeysJson))
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: 'mailto:support@example.com',
      vapidKeys,
    })

    const payload = JSON.stringify({
      title: 'Standortanfrage',
      body: 'Admin/Teamleiter hat Ihren aktuellen Standort angefordert. Öffnen Sie die App, um zu antworten.',
    })

    let sent = 0
    for (const row of subs) {
      const subscription: webpush.PushSubscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      }
      try {
        const sub = appServer.subscribe(subscription)
        await sub.pushTextMessage(payload, { urgency: 'high' })
        sent++
      } catch {
        // Subscription evtl. abgelaufen – ignorieren
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
