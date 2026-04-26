import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'npm:https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  pdfStoragePath: string
  toEmail: string
  subject?: string
  filename?: string
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const RE_PDF = new RegExp(`^pdf/(${UUID})\\.pdf$`, 'i')
const RE_PRUEF = new RegExp(`^pruefprotokolle/(${UUID})\\.pdf$`, 'i')
const RE_MONTEUR = new RegExp(`^monteur-berichte/(${UUID})\\.pdf$`, 'i')

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const normalizePdfStoragePath = (raw: string): string | null => {
  const t = raw.trim()
  if (!t || t.includes('..') || t.startsWith('/')) return null
  return t
}

const assertCallerMaySendPdf = async (
  userClient: SupabaseClient,
  normalizedPath: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> => {
  let m = normalizedPath.match(RE_PDF)
  if (m) {
    const id = m[1]
    const { data, error } = await userClient
      .from('maintenance_reports')
      .select('id')
      .eq('id', id)
      .eq('pdf_path', normalizedPath)
      .maybeSingle()
    if (error || !data) {
      return { ok: false, status: 403, message: 'Keine Berechtigung für diesen Anhang.' }
    }
    return { ok: true }
  }

  m = normalizedPath.match(RE_PRUEF)
  if (m) {
    const id = m[1]
    const { data, error } = await userClient
      .from('maintenance_reports')
      .select('id')
      .eq('id', id)
      .eq('pruefprotokoll_pdf_path', normalizedPath)
      .maybeSingle()
    if (error || !data) {
      return { ok: false, status: 403, message: 'Keine Berechtigung für diesen Anhang.' }
    }
    return { ok: true }
  }

  m = normalizedPath.match(RE_MONTEUR)
  if (m) {
    const id = m[1]
    const { data, error } = await userClient
      .from('order_completions')
      .select('id')
      .eq('id', id)
      .eq('monteur_pdf_path', normalizedPath)
      .maybeSingle()
    if (error || !data) {
      return { ok: false, status: 403, message: 'Keine Berechtigung für diesen Anhang.' }
    }
    return { ok: true }
  }

  return { ok: false, status: 400, message: 'Ungültiger pdfStoragePath.' }
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'Nicht autorisiert.' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse(500, { error: 'Supabase nicht konfiguriert (URL, Service Role oder Anon Key).' })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !caller) {
      return jsonResponse(401, { error: 'Nicht autorisiert.' })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      return jsonResponse(500, {
        error:
          'RESEND_API_KEY nicht konfiguriert. Bitte in Supabase unter Project Settings > Edge Functions > Secrets setzen.',
      })
    }

    let body: RequestBody
    try {
      body = (await req.json()) as RequestBody
    } catch {
      return jsonResponse(400, { error: 'Ungültiger JSON-Body.' })
    }

    const { pdfStoragePath, toEmail, subject, filename } = body

    if (!pdfStoragePath || !toEmail) {
      return jsonResponse(400, { error: 'pdfStoragePath und toEmail sind erforderlich.' })
    }

    const normalizedPath = normalizePdfStoragePath(pdfStoragePath)
    if (!normalizedPath) {
      return jsonResponse(400, { error: 'Ungültiger pdfStoragePath.' })
    }

    const authz = await assertCallerMaySendPdf(userClient, normalizedPath)
    if (!authz.ok) {
      return jsonResponse(authz.status, { error: authz.message })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const logEvent = async (
      status: 'ok' | 'failed',
      recipientEmail: string,
      providerMessageId?: string,
      errorText?: string
    ) => {
      await supabase.rpc('log_email_delivery_event', {
        p_provider: 'resend',
        p_channel: 'maintenance_pdf',
        p_status: status,
        p_recipient_email: recipientEmail,
        p_provider_message_id: providerMessageId ?? null,
        p_error_code: null,
        p_error_text: errorText ?? null,
      })
      await mirrorUsageToLicensePortal(status)
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('maintenance-photos')
      .download(normalizedPath)

    if (downloadError || !fileData) {
      return jsonResponse(500, {
        error: `PDF konnte nicht geladen werden: ${downloadError?.message ?? 'Unbekannt'}`,
      })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM') || 'Vico Wartung <onboarding@resend.dev>',
        to: [toEmail],
        subject: subject || 'Wartungsprotokoll',
        html: '<p>Anbei erhalten Sie das Wartungsprotokoll.</p>',
        attachments: [
          {
            content: base64,
            filename: filename || 'Wartungsprotokoll.pdf',
          },
        ],
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      await logEvent('failed', toEmail, undefined, result.message || result.detail || 'Versand fehlgeschlagen')
      return jsonResponse(res.status, {
        error: result.message || result.detail || 'E-Mail konnte nicht gesendet werden.',
      })
    }

    await logEvent('ok', toEmail, result.id)

    return jsonResponse(200, { success: true, id: result.id })
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'Unbekannter Fehler',
    })
  }
})
