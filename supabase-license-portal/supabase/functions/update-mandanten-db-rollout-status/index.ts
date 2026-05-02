/**
 * POST /functions/v1/update-mandanten-db-rollout-status
 *
 * Nur für GitHub Actions / Apply-Script (Shared Secret). Kein JWT.
 * Header: X-Rollout-Callback-Secret = MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET
 *
 * Body: { op, run_id, ... }
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-rollout-callback-secret',
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const clip = (s: string, max: number): string => (s.length <= max ? s : s.slice(0, max))

const sanitizeGithubUrl = (u: unknown): string | null => {
  if (typeof u !== 'string') return null
  const t = u.trim()
  if (!t.startsWith('https://')) return null
  return clip(t, 900)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const expected = Deno.env.get('MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET') ?? ''
  const hdr = req.headers.get('X-Rollout-Callback-Secret') ?? ''
  if (!expected || hdr !== expected) {
    return json(401, { error: 'Unauthorized' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const admin = createClient(supabaseUrl, serviceKey)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const op = typeof body.op === 'string' ? body.op : ''
  const runId = typeof body.run_id === 'string' ? body.run_id.trim() : ''
  if (!runId) {
    return json(400, { error: 'run_id required' })
  }

  const { data: exists } = await admin.from('mandanten_db_rollout_runs').select('id').eq('id', runId).maybeSingle()
  if (!exists) {
    return json(404, { error: 'run not found' })
  }

  const now = new Date().toISOString()

  switch (op) {
    case 'run_mark_running': {
      const gh = sanitizeGithubUrl(body.github_run_url)
      const patch: Record<string, unknown> = {
        status: 'running',
        updated_at: now,
      }
      if (gh) patch.github_run_url = gh
      await admin.from('mandanten_db_rollout_runs').update(patch).eq('id', runId)
      return json(200, { ok: true })
    }

    case 'targets_replace': {
      const targets = Array.isArray(body.targets) ? body.targets : []
      await admin.from('mandanten_db_rollout_targets').delete().eq('run_id', runId)
      if (targets.length === 0) {
        return json(200, { ok: true, inserted: 0 })
      }
      const rows = targets.map((raw: unknown, i: number) => {
        const t = raw as Record<string, unknown>
        const idx = typeof t.target_index === 'number' && t.target_index >= 0 ? Math.floor(t.target_index) : i
        return {
          run_id: runId,
          target_index: idx,
          tenant_id: null,
          project_ref:
            typeof t.project_ref === 'string' && t.project_ref.trim() ? clip(t.project_ref.trim(), 128) : null,
          db_host_masked: clip(String(t.db_host_masked ?? '(maskiert)'), 512),
          status: typeof t.status === 'string' ? clip(t.status, 32) : 'queued',
          started_at: null,
          finished_at: null,
          psql_exit_code: null,
          error_excerpt: null,
          stdout_excerpt: null,
          created_at: now,
          updated_at: now,
        }
      })
      const { error } = await admin.from('mandanten_db_rollout_targets').insert(rows)
      if (error) {
        return json(500, { error: error.message })
      }
      await admin.rpc('enrich_mandanten_db_rollout_targets', { p_run_id: runId })
      return json(200, { ok: true, inserted: rows.length })
    }

    case 'target_update': {
      const ti = body.target_index
      if (typeof ti !== 'number' || ti < 0 || !Number.isFinite(ti)) {
        return json(400, { error: 'target_index invalid' })
      }
      const patchRaw = (body.patch ?? {}) as Record<string, unknown>
      const update: Record<string, unknown> = { updated_at: now }
      const copyKeys = [
        'status',
        'started_at',
        'finished_at',
        'psql_exit_code',
        'error_excerpt',
        'stdout_excerpt',
        'tenant_id',
      ] as const
      for (const k of copyKeys) {
        if (patchRaw[k] !== undefined) {
          update[k] = patchRaw[k]
        }
      }
      if (typeof update.error_excerpt === 'string') {
        update.error_excerpt = clip(update.error_excerpt, 4000)
      }
      if (typeof update.stdout_excerpt === 'string') {
        update.stdout_excerpt = clip(update.stdout_excerpt, 4000)
      }
      await admin.from('mandanten_db_rollout_targets').update(update).eq('run_id', runId).eq('target_index', ti)
      return json(200, { ok: true })
    }

    case 'run_finalize': {
      const status = typeof body.status === 'string' ? body.status : ''
      const allowed = ['success', 'partial', 'error', 'cancelled']
      if (!allowed.includes(status)) {
        return json(400, { error: 'status invalid' })
      }
      const finishedAt = typeof body.finished_at === 'string' ? body.finished_at : now
      const patch: Record<string, unknown> = {
        status,
        finished_at: finishedAt,
        summary_json: body.summary_json ?? null,
        updated_at: now,
      }
      const ghFinalize = sanitizeGithubUrl(body.github_run_url)
      if (ghFinalize) patch.github_run_url = ghFinalize
      await admin.from('mandanten_db_rollout_runs').update(patch).eq('id', runId)
      return json(200, { ok: true })
    }

    default:
      return json(400, { error: 'unknown op' })
  }
})
