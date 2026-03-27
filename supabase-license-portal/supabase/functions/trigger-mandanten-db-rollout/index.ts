/**
 * POST /functions/v1/trigger-mandanten-db-rollout
 * Startet den GitHub-Actions-Workflow „Mandanten-DB – supabase-complete“ (nur für Lizenzportal-Admins).
 *
 * Secrets (Lizenzportal-Projekt → Edge Function):
 *   GITHUB_DISPATCH_TOKEN – PAT mit scope „actions: write“ (repo)
 *   GITHUB_REPO_OWNER, GITHUB_REPO_NAME
 * Optional: GITHUB_WORKFLOW_FILE (default mandanten-db-apply-complete.yml), GITHUB_DEFAULT_BRANCH (default main)
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const ghToken = Deno.env.get('GITHUB_DISPATCH_TOKEN') ?? ''
  const owner = Deno.env.get('GITHUB_REPO_OWNER') ?? ''
  const repo = Deno.env.get('GITHUB_REPO_NAME') ?? ''
  const workflowFile = Deno.env.get('GITHUB_WORKFLOW_FILE') ?? 'mandanten-db-apply-complete.yml'
  const branch = Deno.env.get('GITHUB_DEFAULT_BRANCH') ?? 'main'

  if (!ghToken || !owner || !repo) {
    return json(503, {
      error:
        'GitHub-Integration nicht konfiguriert (GITHUB_DISPATCH_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME).',
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { error: 'Unauthorized' })
  }

  const jwt = authHeader.slice(7).trim()
  if (!jwt) {
    return json(401, { error: 'Unauthorized' })
  }

  let mode: string
  try {
    const body = (await req.json()) as { mode?: string }
    mode = body.mode === 'apply' ? 'apply' : 'dry_run'
  } catch {
    return json(400, { error: 'Ungültiger JSON-Body (erwartet { "mode": "dry_run" | "apply" }).' })
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
    return json(403, { error: 'Nur Administratoren dürfen diesen Workflow starten.' })
  }

  const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(
    workflowFile
  )}/dispatches`

  const ghRes = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${ghToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: branch,
      inputs: { mode },
    }),
  })

  if (ghRes.status === 204) {
    return json(200, {
      ok: true,
      message:
        mode === 'dry_run'
          ? 'Workflow gestartet (Trockenlauf). Ergebnis in GitHub unter Actions prüfen.'
          : 'Workflow gestartet (Echtlauf). Ergebnis in GitHub unter Actions prüfen.',
      mode,
    })
  }

  const errText = await ghRes.text()
  let detail = errText
  try {
    const o = JSON.parse(errText) as { message?: string }
    if (o.message) detail = o.message
  } catch {
    /* ignore */
  }

  return json(502, {
    error: `GitHub-API: ${ghRes.status} – ${detail}`,
  })
})
