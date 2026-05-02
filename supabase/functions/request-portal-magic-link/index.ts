import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  email: string
}

/** Einheitliche Erfolgsantwort – kein Rückschluss auf Existenz der E-Mail oder Versandstatus. */
const UNIFIED_SUCCESS_MESSAGE =
  'Wenn diese E-Mail für das Kundenportal registriert ist, erhalten Sie in Kürze einen Anmeldelink.'

const RATE_WINDOW_MS = 15 * 60 * 1000
const MAX_PER_EMAIL = 8
const MAX_PER_IP = 40
const RESPONSE_DELAY_MIN_MS = 550
const RESPONSE_DELAY_JITTER_MS = 450

const rateBuckets = new Map<string, number[]>()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const responseDelay = async (): Promise<void> => {
  await sleep(RESPONSE_DELAY_MIN_MS + Math.floor(Math.random() * RESPONSE_DELAY_JITTER_MS))
}

const rateWindowCount = (key: string): number => {
  const now = Date.now()
  const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  rateBuckets.set(key, arr)
  return arr.length
}

const rateRecord = (key: string): void => {
  const now = Date.now()
  let arr = rateBuckets.get(key) ?? []
  arr = arr.filter((t) => now - t < RATE_WINDOW_MS)
  arr.push(now)
  rateBuckets.set(key, arr)
}

const clientIp = (req: Request): string => {
  const fwd = req.headers.get('x-forwarded-for')?.trim()
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('cf-connecting-ip')?.trim() || 'unknown'
}

const isPlausibleEmail = (raw: string): boolean => {
  if (raw.length > 320) return false
  // Keine Filter-Sonderzeichen; übliches Login-Format
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(raw)
}

/** PostgREST eq-Wert in doppelten Anführungszeichen */
const quoteEq = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

const json200 = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const portalUrl = Deno.env.get('PORTAL_URL') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    let body: RequestBody
    try {
      body = (await req.json()) as RequestBody
    } catch {
      return new Response(JSON.stringify({ error: 'Ungültiger JSON-Body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const email = body.email?.trim().toLowerCase()

    if (!email || !isPlausibleEmail(email)) {
      return new Response(JSON.stringify({ error: 'E-Mail ist erforderlich.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ip = clientIp(req)
    const emailKey = `e:${email}`
    const ipKey = `i:${ip}`
    if (rateWindowCount(emailKey) >= MAX_PER_EMAIL || rateWindowCount(ipKey) >= MAX_PER_IP) {
      await responseDelay()
      return json200({ success: true, message: UNIFIED_SUCCESS_MESSAGE })
    }
    rateRecord(emailKey)
    rateRecord(ipKey)

    const q = quoteEq(email)
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id')
      .or(`contact_email.eq.${q},maintenance_report_email_address.eq.${q},email.eq.${q}`)

    if (!customers || customers.length === 0) {
      await responseDelay()
      return json200({ success: true, message: UNIFIED_SUCCESS_MESSAGE })
    }

    for (const customer of customers) {
      await supabaseAdmin
        .from('customer_portal_users')
        .upsert({ customer_id: customer.id, email }, { onConflict: 'customer_id,email' })
    }

    const redirectTo = portalUrl ? `${portalUrl}/auth/callback` : `${supabaseUrl}/auth/v1/callback`

    const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (otpError) {
      console.warn('request-portal-magic-link signInWithOtp', otpError.message)
    }

    await responseDelay()
    return json200({ success: true, message: UNIFIED_SUCCESS_MESSAGE })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
