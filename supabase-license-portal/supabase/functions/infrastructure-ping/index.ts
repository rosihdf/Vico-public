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

const normalizeBaseUrl = (raw: string): string => raw.trim().replace(/\/$/, '')

const isPlausibleSupabaseProjectUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' && /\.supabase\.co$/i.test(u.hostname)
  } catch {
    return false
  }
}

const normalizePublicUrl = (raw: string): string => {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
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
  raw: string
): Promise<{ label: string; ok: boolean; status: number; message: string; skipped?: boolean }> => {
  const full = normalizePublicUrl(raw)
  if (!full) {
    return { label, ok: true, status: 0, message: 'Leer – übersprungen', skipped: true }
  }
  try {
    let r = await fetch(full, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(12_000) })
    if (r.ok || r.status === 304 || r.status === 403) {
      return { label, ok: true, status: r.status, message: `HTTP ${r.status} (HEAD)` }
    }
    r = await fetch(full, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(12_000) })
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = (await req.json()) as RequestBody
    const supabaseUrl = (body.supabase_url ?? '').trim()
    const anon = body.supabase_anon_key ?? ''
    const urls = Array.isArray(body.urls) ? body.urls : []

    let supabase_auth_health: { ok: boolean; status: number; message: string } | null = null
    let supabase_rest: { ok: boolean; status: number; message: string; skipped?: boolean } | null = null

    if (supabaseUrl) {
      if (!isPlausibleSupabaseProjectUrl(supabaseUrl)) {
        return new Response(
          JSON.stringify({
            error: 'Ungültige Supabase-URL. Erwartet: https://<projekt-ref>.supabase.co',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      supabase_auth_health = await pingSupabaseAuthHealth(supabaseUrl)
      supabase_rest = await pingSupabaseRestWithAnon(supabaseUrl, anon)
    }

    const urlResults = []
    for (const item of urls) {
      const label = String(item?.label ?? 'URL').trim() || 'URL'
      const u = String(item?.url ?? '').trim()
      urlResults.push(await pingPublicUrl(label, u))
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
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
