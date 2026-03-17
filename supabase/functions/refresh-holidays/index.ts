/**
 * POST /refresh-holidays
 * Lädt Feiertage von feiertage-api.de und schreibt in public_holidays.
 * Body: { bundesland?: string, years?: number[] }
 * Default: BE, [2024,2025,2026,2027]
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUNDESLAENDER = ['BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH']

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: role } = await userClient.rpc('get_my_role')
    if (role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Nur Admins dürfen Feiertage aktualisieren' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let body: { bundesland?: string; years?: number[] } = {}
    try {
      body = (await req.json()) as { bundesland?: string; years?: number[] }
    } catch {
      body = {}
    }
    const bundesland = (body.bundesland ?? 'BE').toUpperCase()
    const years = body.years ?? [2024, 2025, 2026, 2027]

    if (!BUNDESLAENDER.includes(bundesland)) {
      return new Response(
        JSON.stringify({ error: `Ungültiges Bundesland. Erlaubt: ${BUNDESLAENDER.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const rows: { bundesland: string; date: string; name: string }[] = []

    for (const year of years) {
      const url = `https://feiertage-api.de/api/?jahr=${year}&nur_land=${bundesland}`
      const res = await fetch(url)
      if (!res.ok) continue
      const data = (await res.json()) as Record<string, { datum: string; hinweis?: string }>
      for (const [name, obj] of Object.entries(data)) {
        if (!obj?.datum) continue
        rows.push({ bundesland, date: obj.datum, name })
      }
    }

    const { error } = await supabase
      .from('public_holidays')
      .upsert(rows, { onConflict: 'bundesland,date' })
    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, count: rows.length, bundesland, years }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
