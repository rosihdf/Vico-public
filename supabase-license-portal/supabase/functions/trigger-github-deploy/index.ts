/**
 * POST /functions/v1/trigger-github-deploy
 * Startet workflow_dispatch „Deploy Pages from release“ (GitHub Actions).
 *
 * Body: { release_id: string, confirm_recent_duplicate?: boolean }
 *
 * Secrets (Supabase → Edge):
 *   GITHUB_DISPATCH_TOKEN oder GITHUB_DEPLOY_TOKEN (PAT mit workflow + repo)
 *   GITHUB_REPO_OWNER, GITHUB_REPO_NAME
 *   GITHUB_WORKFLOW_DEPLOY_FILE (Default: deploy-pages-from-release.yml)
 *   GITHUB_WORKFLOW_REF (Branch mit Workflow-Datei, Default: main)
 * Optional: DEPLOY_ALLOWED_ORIGINS (kommagetrennt; leer = *)
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const DUPLICATE_WINDOW_MS = 15 * 60 * 1000

const baseCors = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
})

const pickCorsOrigin = (req: Request): string => {
  const reqOrigin = req.headers.get('Origin')?.trim() ?? ''
  const raw = Deno.env.get('DEPLOY_ALLOWED_ORIGINS')?.trim() ?? ''
  if (!raw || raw === '*') return reqOrigin || '*'
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (allowed.includes('*')) return reqOrigin || '*'
  if (reqOrigin && allowed.includes(reqOrigin)) return reqOrigin
  return allowed[0] ?? '*'
}

const json = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...baseCors(pickCorsOrigin(req)), 'Content-Type': 'application/json' },
  })

type ReleaseChannel = 'main' | 'kundenportal' | 'arbeitszeit_portal' | 'admin'

const workflowAppForChannel = (ch: string): string | null => {
  if (ch === 'main' || ch === 'kundenportal' || ch === 'arbeitszeit_portal' || ch === 'admin') return ch
  return null
}

serve(async (req) => {
  const corsOrigin = pickCorsOrigin(req)
  const corsHeaders = baseCors(corsOrigin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(req, 405, { ok: false, error: 'Method not allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const ghToken =
    (Deno.env.get('GITHUB_DEPLOY_TOKEN') ?? Deno.env.get('GITHUB_DISPATCH_TOKEN') ?? '').trim()
  const owner = (Deno.env.get('GITHUB_REPO_OWNER') ?? '').trim()
  const repo = (Deno.env.get('GITHUB_REPO_NAME') ?? '').trim()
  const workflowFile =
    (Deno.env.get('GITHUB_WORKFLOW_DEPLOY_FILE') ?? 'deploy-pages-from-release.yml').trim()
  const workflowRef = (Deno.env.get('GITHUB_WORKFLOW_REF') ?? 'main').trim()

  if (!ghToken || !owner || !repo) {
    return json(req, 503, {
      ok: false,
      error:
        'GitHub nicht konfiguriert (GITHUB_DEPLOY_TOKEN oder GITHUB_DISPATCH_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME).',
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json(req, 401, { ok: false, error: 'Unauthorized' })
  }
  const jwt = authHeader.slice(7).trim()
  if (!jwt) {
    return json(req, 401, { ok: false, error: 'Unauthorized' })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return json(req, 400, {
      ok: false,
      error: 'Ungültiger JSON-Body. Erwartet: { "release_id": string, "confirm_recent_duplicate"?: boolean }',
    })
  }
  const body = raw as {
    release_id?: string
    confirm_recent_duplicate?: boolean
  }
  const releaseId = typeof body.release_id === 'string' ? body.release_id.trim() : ''
  const confirmRecentDuplicate = body.confirm_recent_duplicate === true

  if (!releaseId) {
    return json(req, 400, { ok: false, error: 'release_id fehlt.' })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData.user) {
    return json(req, 401, { ok: false, error: 'Ungültige oder abgelaufene Session.' })
  }

  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profErr || prof?.role !== 'admin') {
    return json(req, 403, { ok: false, error: 'Nur Administratoren dürfen Production-Deploys anstoßen.' })
  }

  const { data: rel, error: relErr } = await admin
    .from('app_releases')
    .select('id, channel, version_semver, status, ci_metadata')
    .eq('id', releaseId)
    .maybeSingle()

  if (relErr || !rel) {
    return json(req, 404, { ok: false, error: 'Release nicht gefunden.' })
  }

  if (rel.status !== 'published') {
    return json(req, 400, {
      ok: false,
      error: 'Nur freigegebene Releases (published) dürfen deployed werden.',
    })
  }

  const channel = rel.channel as string
  const app = workflowAppForChannel(channel)
  if (!app) {
    return json(req, 400, { ok: false, error: 'Kanal wird für Deploy nicht unterstützt.' })
  }

  const meta =
    rel.ci_metadata && typeof rel.ci_metadata === 'object'
      ? (rel.ci_metadata as Record<string, unknown>)
      : {}
  const tag = typeof meta.tag === 'string' ? meta.tag.trim() : ''
  const sha = typeof meta.target_commitish === 'string' ? meta.target_commitish.trim() : ''
  const versionSemver = typeof rel.version_semver === 'string' ? rel.version_semver.trim() : ''
  let gitRef = tag || sha
  if (!gitRef && versionSemver) {
    gitRef = `${channel}/${versionSemver}`
  }
  if (!gitRef) {
    return json(req, 400, {
      ok: false,
      error:
        'Kein Git-Ref: bitte in ci_metadata „tag“ oder „target_commitish“ setzen (oder Version passt zur Tag-Konvention Kanal/Version).',
    })
  }

  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()
  const { data: recentRows, error: dupErr } = await admin
    .from('release_audit_log')
    .select('id')
    .eq('release_id', releaseId)
    .eq('action', 'release.deploy_triggered')
    .gte('created_at', since)
    .limit(1)

  if (dupErr) {
    console.warn('release_audit_log duplicate check', dupErr.message)
  } else if ((recentRows?.length ?? 0) > 0 && !confirmRecentDuplicate) {
    return json(req, 200, {
      ok: false,
      code: 'duplicate_deploy',
      error:
        'Für dieses Release wurde in den letzten 15 Minuten schon ein Deploy angestoßen. Erneut ausführen mit Bestätigung.',
    })
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
      ref: workflowRef,
      inputs: {
        app,
        git_ref: gitRef,
      },
    }),
  })

  if (ghRes.status !== 204) {
    const errText = await ghRes.text()
    let detail = errText
    try {
      const o = JSON.parse(errText) as { message?: string }
      if (o.message) detail = o.message
    } catch {
      /* ignore */
    }
    return json(req, 502, { ok: false, error: `GitHub-API: ${ghRes.status} – ${detail}` })
  }

  const githubActionsUrl = `https://github.com/${owner}/${repo}/actions/workflows/${encodeURIComponent(
    workflowFile
  )}`

  const { error: logErr } = await admin.from('release_audit_log').insert({
    actor_id: userData.user.id,
    action: 'release.deploy_triggered',
    release_id: releaseId,
    channel: channel as ReleaseChannel,
    metadata: {
      app,
      git_ref: gitRef,
      workflow_ref: workflowRef,
      workflow_file: workflowFile,
      github_actions_url: githubActionsUrl,
    },
  })
  if (logErr) {
    console.warn('release_audit_log insert', logErr.message)
  }

  return json(req, 200, {
    ok: true,
    message: 'Workflow gestartet. Build und Pages-Deploy laufen in GitHub Actions.',
    app,
    git_ref: gitRef,
    github_actions_url: githubActionsUrl,
  })
})
