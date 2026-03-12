import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type LimitExceededBody = {
  licenseNumber: string
  limit_type: 'users' | 'customers'
  current_value: number
  max_value: number
}

serve(async (req) => {
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
    const body = (await req.json()) as LimitExceededBody
    const { licenseNumber, limit_type, current_value, max_value } = body

    if (!licenseNumber?.trim() || !limit_type || typeof current_value !== 'number' || typeof max_value !== 'number') {
      return new Response(
        JSON.stringify({ error: 'licenseNumber, limit_type, current_value, max_value erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['users', 'customers'].includes(limit_type)) {
      return new Response(
        JSON.stringify({ error: 'limit_type muss users oder customers sein' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: licenseRow, error: licenseError } = await supabase
      .from('licenses')
      .select('id, tenant_id')
      .eq('license_number', licenseNumber.trim())
      .maybeSingle()

    if (licenseError || !licenseRow) {
      return new Response(
        JSON.stringify({ error: 'Lizenz nicht gefunden' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: insertError } = await supabase.from('limit_exceeded_log').insert({
      tenant_id: licenseRow.tenant_id,
      license_id: licenseRow.id,
      limit_type,
      current_value,
      max_value,
      license_number: licenseNumber.trim(),
    })

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
