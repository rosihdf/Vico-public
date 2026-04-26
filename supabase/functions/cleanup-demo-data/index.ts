import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'npm:https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cleanup-demo-secret',
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
    const cronSecret = (Deno.env.get('CLEANUP_DEMO_DATA_SECRET') ?? '').trim()
    if (!cronSecret) {
      return new Response(
        JSON.stringify({
          error:
            'CLEANUP_DEMO_DATA_SECRET ist nicht gesetzt. Function absichtlich deaktiviert (fail-closed).',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization')?.trim() ?? ''
    const headerSecret = req.headers.get('x-cleanup-demo-secret')?.trim() ?? ''
    const bearerOk = authHeader === `Bearer ${cronSecret}`
    const headerOk = headerSecret === cronSecret && headerSecret.length > 0
    if (!bearerOk && !headerOk) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await supabase.rpc('cleanup_demo_customers_older_than_24h')

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = data as { deleted_count?: number; deleted_ids?: string[] } | null
    const deletedCount = result?.deleted_count ?? 0
    const deletedIds = result?.deleted_ids ?? []

    return new Response(
      JSON.stringify({ deleted: deletedCount, ids: deletedIds }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
