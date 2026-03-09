import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'npm:https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
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

    const body = (await req.json()) as RequestBody
    const email = body.email?.trim().toLowerCase()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'E-Mail ist erforderlich.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id')
      .or(`contact_email.eq.${email},maintenance_report_email_address.eq.${email},email.eq.${email}`)

    if (!customers || customers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Falls ein Konto existiert, wurde ein Magic Link gesendet.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    for (const customer of customers) {
      await supabaseAdmin
        .from('customer_portal_users')
        .upsert(
          { customer_id: customer.id, email },
          { onConflict: 'customer_id,email' }
        )
    }

    const redirectTo = portalUrl ? `${portalUrl}/auth/callback` : `${supabaseUrl}/auth/v1/callback`

    const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (otpError) {
      return new Response(
        JSON.stringify({ error: `Magic Link konnte nicht gesendet werden: ${otpError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Magic Link wurde gesendet.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
