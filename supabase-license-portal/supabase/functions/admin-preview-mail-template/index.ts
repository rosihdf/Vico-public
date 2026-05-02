/**
 * POST /functions/v1/admin-preview-mail-template
 * Rendert eine Mailvorlage serverseitig (LP-Admins); keine Secrets, kein Versand.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  deepMerge,
  MAIL_PREVIEW_SAMPLE_CONTEXT,
  resolveRenderedMail,
  resolveRenderedMailGlobalOnly,
} from '../_shared/mailTemplateRender.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
}

type Body = {
  tenantId?: string
  /** Nur globale Vorlage (tenant_id IS NULL) + Code-Fallback — ohne Mandanten-Kontext. */
  globalOnly?: boolean
  tenantDisplayName?: string
  templateKey?: string
  locale?: string
  draft?: { subject_template?: string; html_template?: string; text_template?: string }
  context?: Record<string, unknown>
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim()
  const anonKey = (Deno.env.get('SUPABASE_ANON_KEY') ?? '').trim()
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { error: 'Supabase-Umgebungsvariablen fehlen.' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { error: 'Nicht autorisiert.' })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json(400, { error: 'Ungültiger JSON-Body.' })
  }

  const globalOnly = body.globalOnly === true
  const tenantId = String(body.tenantId ?? '').trim()
  const templateKey = String(body.templateKey ?? '').trim()
  const locale = String(body.locale ?? 'de').trim() || 'de'

  if (!globalOnly && (!tenantId || !UUID_RE.test(tenantId))) {
    return json(400, { error: 'tenantId ist erforderlich (oder globalOnly: true setzen).' })
  }
  if (!templateKey) {
    return json(400, { error: 'templateKey ist erforderlich.' })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return json(401, { error: 'Nicht autorisiert.' })
  }

  const { data: prof, error: profErr } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profErr || (prof as { role?: string } | null)?.role !== 'admin') {
    return json(403, { error: 'Nur Lizenzportal-Admins.' })
  }

  const svc = createClient(supabaseUrl, serviceKey)

  let tenantDisplayNameForPreview = ''
  if (!globalOnly) {
    const { data: tenant, error: tenantErr } = await svc.from('tenants').select('name').eq('id', tenantId).maybeSingle()
    if (tenantErr || !tenant) {
      return json(404, { error: 'Mandant nicht gefunden.' })
    }
    tenantDisplayNameForPreview = String((tenant as { name?: string }).name ?? '')
  }

  const mandantNameForPreview = globalOnly
    ? String(body.tenantDisplayName ?? 'Beispiel GmbH').trim() || 'Beispiel GmbH'
    : tenantDisplayNameForPreview

  const sampleMerged = deepMerge(MAIL_PREVIEW_SAMPLE_CONTEXT as Record<string, unknown>, {
    mandant: { name: mandantNameForPreview },
  })

  const ctx =
    body.context && typeof body.context === 'object' && body.context !== null && !Array.isArray(body.context)
      ? deepMerge(sampleMerged, body.context as Record<string, unknown>)
      : sampleMerged

  const draft = body.draft
    ? {
        subject_template: body.draft.subject_template,
        html_template: body.draft.html_template,
        text_template: body.draft.text_template,
      }
    : null

  try {
    const rendered = globalOnly
      ? await resolveRenderedMailGlobalOnly(svc, templateKey, locale, ctx, draft)
      : await resolveRenderedMail(svc, tenantId, templateKey, locale, ctx, draft)
    return json(200, {
      success: true,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateSource: rendered.source,
    })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Render fehlgeschlagen' })
  }
})
