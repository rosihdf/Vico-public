/**
 * POST /functions/v1/trigger-mandanten-db-rollout
 * Startet den GitHub-Actions-Workflow „Mandanten-DB – Rollout (psql)“.
 *
 * Body (JSON):
 *   mode: "dry_run" | "apply"
 *   target: "staging" | "production" (optional, Default production)
 *   sql_file: relativer Repo-Pfad (optional, Default supabase-complete.sql)
 *   product_key, module_key, package_id: optional (Historie / Multi-App)
 *
 * Secrets (Lizenzportal → Edge): GITHUB_DISPATCH_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME
 * Optional: GITHUB_WORKFLOW_FILE, GITHUB_DEFAULT_BRANCH
 *
 * Workflow-Input run_id (UUID) verknüpft mit mandanten_db_rollout_runs; Apply-Script meldet Status per
 * update-mandanten-db-rollout-status (Secret MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET).
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

const sanitizeOptText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

const isValidSqlFile = (s: string): boolean => {
  const t = s.trim()
  if (!t || t.length > 220) return false
  if (t.includes('..') || t.includes('\0') || t.startsWith('/')) return false
  if (t === 'supabase-complete.sql') return true
  if (!t.startsWith('docs/sql/') || !t.endsWith('.sql')) return false
  return /^docs\/sql\/[a-zA-Z0-9/_-]+\.sql$/.test(t)
}

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
  let target: string
  let sqlFile: string
  let productKey: string | null
  let moduleKey: string | null
  let packageId: string | null
  try {
    const body = (await req.json()) as {
      mode?: string
      target?: string
      sql_file?: string
      product_key?: string
      module_key?: string
      package_id?: string
    }
    mode = body.mode === 'apply' ? 'apply' : 'dry_run'
    target = body.target === 'staging' ? 'staging' : 'production'
    productKey = sanitizeOptText(body.product_key, 64)
    moduleKey = sanitizeOptText(body.module_key, 64)
    packageId = sanitizeOptText(body.package_id, 128)
    const rawFile =
      typeof body.sql_file === 'string' && body.sql_file.trim()
        ? body.sql_file.trim()
        : 'supabase-complete.sql'
    sqlFile = rawFile
    if (!isValidSqlFile(sqlFile)) {
      return json(400, {
        error:
          'sql_file ungültig. Erlaubt: supabase-complete.sql oder docs/sql/…/name.sql (Buchstaben, Zahlen, /, _, -).',
      })
    }
  } catch {
    return json(400, {
      error:
        'Ungültiger JSON-Body. Erwartet: { "mode": "dry_run"|"apply", "target"?, "sql_file"?, "product_key"?, "module_key"?, "package_id"? }',
    })
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

  const startedAt = new Date().toISOString()

  const { data: inserted, error: insertErr } = await admin
    .from('mandanten_db_rollout_runs')
    .insert({
      started_by: userData.user.id,
      started_at: startedAt,
      finished_at: null,
      product_key: productKey,
      module_key: moduleKey,
      package_id: packageId,
      sql_file: sqlFile,
      target,
      mode,
      status: 'queued',
      github_run_url: null,
      summary_json: null,
    })
    .select('id')
    .maybeSingle()

  if (insertErr || !inserted?.id) {
    return json(503, {
      error: `Rollout-Historie konnte nicht geschrieben werden: ${insertErr?.message ?? 'keine Zeilen-ID'}`,
    })
  }

  const runId = inserted.id as string

  const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(
    workflowFile
  )}/dispatches`

  try {
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
        inputs: {
          mode,
          target,
          sql_file: sqlFile,
          run_id: runId,
        },
      }),
    })

    if (ghRes.status === 204) {
      return json(200, {
        ok: true,
        message: `Workflow gestartet (${target}, ${mode}, ${sqlFile}). Logs in GitHub → Actions.`,
        mode,
        target,
        sql_file: sqlFile,
        run_id: runId,
        rollout_run_id: runId,
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

    const excerpt = detail.slice(0, 4000)
    const finishedAt = new Date().toISOString()
    await admin
      .from('mandanten_db_rollout_runs')
      .update({
        status: 'error',
        finished_at: finishedAt,
        summary_json: { dispatch_error: excerpt },
        updated_at: finishedAt,
      })
      .eq('id', runId)

    return json(502, {
      error: `GitHub-API: ${ghRes.status} – ${detail}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const finishedAt = new Date().toISOString()
    await admin
      .from('mandanten_db_rollout_runs')
      .update({
        status: 'error',
        finished_at: finishedAt,
        summary_json: { dispatch_exception: msg.slice(0, 4000) },
        updated_at: finishedAt,
      })
      .eq('id', runId)

    return json(502, {
      error: `GitHub-Dispatch fehlgeschlagen: ${msg}`,
    })
  }
})
