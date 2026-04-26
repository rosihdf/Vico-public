import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'npm:https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  customer_id: string
  email: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const portalUrl = Deno.env.get('PORTAL_URL') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Nicht autorisiert.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'Nicht autorisiert.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Nur Admins können Portal-Benutzer einladen.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = (await req.json()) as RequestBody
    const { customer_id, email } = body

    if (!customer_id || !email) {
      return new Response(
        JSON.stringify({ error: 'customer_id und email sind erforderlich.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: canAccess, error: accessErr } = await userClient.rpc('customer_visible_to_user', {
      cid: customer_id,
    })
    if (accessErr) {
      return new Response(
        JSON.stringify({ error: 'Ungültige customer_id.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (canAccess !== true) {
      return new Response(
        JSON.stringify({ error: 'Keine Berechtigung für diesen Kunden.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: existing } = await supabaseAdmin
      .from('customer_portal_users')
      .select('id')
      .eq('customer_id', customer_id)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Diese E-Mail ist bereits für diesen Kunden eingeladen.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const redirectTo = portalUrl ? `${portalUrl}/auth/callback` : `${supabaseUrl}/auth/v1/callback`

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      { redirectTo }
    )

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: `Einladung fehlgeschlagen: ${inviteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = inviteData.user?.id ?? null

    const { error: insertError } = await supabaseAdmin
      .from('customer_portal_users')
      .insert({
        customer_id,
        email: email.trim().toLowerCase(),
        user_id: userId,
        invited_by: caller.id,
      })

    if (insertError) {
      return new Response(
        JSON.stringify({ error: `Portal-Eintrag fehlgeschlagen: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (userId) {
      await supabaseAdmin
        .from('profiles')
        .update({ role: 'kunde' })
        .eq('id', userId)
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
