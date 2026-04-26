import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
}

type PingUrlItem = { label: string; url: string }

type RequestBody = {
  supabase_url?: string
  supabase_anon_key?: string
  urls?: PingUrlItem[]
}

const MAX_URL_ITEMS = 12
const MAX_URL_LENGTH = 500
const MAX_LABEL_LENGTH = 120

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const normalizeBaseUrl = (raw: string): string => raw.trim().replace(/\/$/, '')

const isPlausibleSupabaseProjectUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' && /\.supabase\.co$/i.test(u.hostname)
  } catch {
    return false
  }
}

/** Kein offenes Relay zu offensichtlich privaten/lokalen Zielen. */
const isSafePublicPingUrl = (raw: string): { ok: true; href: string } | { ok: false; reason: string } => {
  const t = raw.trim()
  if (!t) return { ok: false, reason: 'Leer' }
  let u: URL
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`
    u = new URL(withProto)
  } catch {
    return { ok: false, reason: 'Ungültige URL' }
  }
  if (u.protocol !== 'https:') {
    return { ok: false, reason: 'Nur https-URLs erlaubt' }
  }
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return { ok: false, reason: 'Host nicht erlaubt' }
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const p = host.split('.').map((x) => parseInt(x, 10))
    const [a, b] = [p[0] ?? 0, p[1] ?? 0]
    if (a === 10 || a === 127 || a === 0) return { ok: false, reason: 'Host nicht erlaubt' }
    if (a === 192 && b === 168) return { ok: false, reason: 'Host nicht erlaubt' }
    if (a === 172 && b >= 16 && b <= 31) return { ok: false, reason: 'Host nicht erlaubt' }
    if (a === 169 && b === 254) return { ok: false, reason: 'Host nicht erlaubt' }
  }
  if (u.username || u.password) {
    return { ok: false, reason: 'URL mit Zugangsdaten nicht erlaubt' }
  }
  return { ok: true, href: u.toString() }
}

const pingSupabaseAuthHealth = async (baseUrl: string): Promise<{ ok: boolean; status: number; message: string }> => {
  const url = `${normalizeBaseUrl(baseUrl)}/auth/v1/health`
  try {
    const r = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(12_000) })
    if (r.ok) {
      return { ok: true, status: r.status, message: 'Supabase Auth-Health: erreichbar' }
    }
    return { ok: false, status: r.status, message: `Supabase Auth-Health: HTTP ${r.status}` }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : 'Netzwerkfehler (Supabase Auth-Health)',
    }
  }
}

const pingSupabaseRestWithAnon = async (
  baseUrl: string,
  anon: string
): Promise<{ ok: boolean; status: number; message: string; skipped?: boolean }> => {
  const key = anon.trim()
  if (!key) {
    return { ok: true, status: 0, message: 'REST-Check übersprungen (kein Anon-Key)', skipped: true }
  }
  const url = `${normalizeBaseUrl(baseUrl)}/rest/v1/`
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (r.status >= 200 && r.status < 500) {
      return { ok: true, status: r.status, message: `Supabase REST-API antwortet (HTTP ${r.status})` }
    }
    return { ok: false, status: r.status, message: `Supabase REST-API: HTTP ${r.status}` }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : 'Netzwerkfehler (Supabase REST)',
    }
  }
}

const pingPublicUrl = async (
  label: string,
  href: string
): Promise<{ label: string; ok: boolean; status: number; message: string; skipped?: boolean }> => {
  try {
    let r = await fetch(href, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(12_000) })
    if (r.ok || r.status === 304 || r.status === 403) {
      return { label, ok: true, status: r.status, message: `HTTP ${r.status} (HEAD)` }
    }
    r = await fetch(href, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(12_000) })
    if (r.ok || r.status === 304) {
      return { label, ok: true, status: r.status, message: `HTTP ${r.status} (GET)` }
    }
    return { label, ok: false, status: r.status, message: `HTTP ${r.status}` }
  } catch (e) {
    return {
      label,
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : 'Netzwerkfehler',
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: 'License portal not configured' })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json(401, { error: 'Unauthorized' })
    }
    const jwt = authHeader.slice(7).trim()
    if (!jwt) {
      return json(401, { error: 'Unauthorized' })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData.user) {
      return json(401, { error: 'Ungültige oder abgelaufene Session.' })
    }

    const { data: prof, error: profErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profErr || prof?.role !== 'admin') {
      return json(403, { error: 'Nur Lizenzportal-Administratoren dürfen die Infrastruktur-Prüfung ausführen.' })
    }

    let body: RequestBody
    try {
      body = (await req.json()) as RequestBody
    } catch {
      return json(400, { error: 'Ungültiger JSON-Body' })
    }

    const supabaseProjectUrl = (body.supabase_url ?? '').trim()
    const anon = body.supabase_anon_key ?? ''
    const urlsRaw = Array.isArray(body.urls) ? body.urls : []
    const urls = urlsRaw.slice(0, MAX_URL_ITEMS)

    let supabase_auth_health: { ok: boolean; status: number; message: string } | null = null
    let supabase_rest: { ok: boolean; status: number; message: string; skipped?: boolean } | null = null

    if (supabaseProjectUrl) {
      if (!isPlausibleSupabaseProjectUrl(supabaseProjectUrl)) {
        return json(400, {
          error: 'Ungültige Supabase-URL. Erwartet: https://<projekt-ref>.supabase.co',
        })
      }
      supabase_auth_health = await pingSupabaseAuthHealth(supabaseProjectUrl)
      supabase_rest = await pingSupabaseRestWithAnon(supabaseProjectUrl, anon)
    }

    const urlResults: Awaited<ReturnType<typeof pingPublicUrl>>[] = []
    for (const item of urls) {
      const labelRaw = String(item?.label ?? 'URL').trim() || 'URL'
      const label = labelRaw.length > MAX_LABEL_LENGTH ? labelRaw.slice(0, MAX_LABEL_LENGTH) : labelRaw
      const u = String(item?.url ?? '').trim()
      if (u.length > MAX_URL_LENGTH) {
        urlResults.push({
          label,
          ok: false,
          status: 0,
          message: 'URL zu lang',
        })
        continue
      }
      const safe = isSafePublicPingUrl(u)
      if (!safe.ok) {
        urlResults.push({
          label,
          ok: false,
          status: 0,
          message: safe.reason,
        })
        continue
      }
      urlResults.push(await pingPublicUrl(label, safe.href))
    }

    return new Response(
      JSON.stringify({
        success: true,
        supabase_auth_health,
        supabase_rest,
        urls: urlResults,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Unbekannter Fehler' })
  }
})
