import { supabase } from './supabase'

/** Zeile aus `mandanten_db_rollout_runs` (Phase 3). */
export type MandantenDbRolloutRunRow = {
  id: string
  started_by: string | null
  started_at: string
  finished_at: string | null
  product_key: string | null
  module_key: string | null
  package_id: string | null
  sql_file: string
  target: string
  mode: string
  status: string
  github_run_url: string | null
  summary_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type MandantenDbRolloutTargetRow = {
  id: string
  run_id: string
  target_index: number
  tenant_id: string | null
  project_ref: string | null
  db_host_masked: string
  status: string
  started_at: string | null
  finished_at: string | null
  psql_exit_code: number | null
  error_excerpt: string | null
  stdout_excerpt: string | null
  created_at: string
  updated_at: string
}

/** Aggregierte Target-Status je Run (Historien-Zeile). */
export type MandantenDbRolloutTargetCounts = {
  success: number
  error: number
  skipped: number
  queued: number
  running: number
}

const emptyTargetCounts = (): MandantenDbRolloutTargetCounts => ({
  success: 0,
  error: 0,
  skipped: 0,
  queued: 0,
  running: 0,
})

const DEFAULT_LIMIT = 50

export const fetchMandantenDbRolloutRuns = async (
  limit = DEFAULT_LIMIT
): Promise<{ ok: true; rows: MandantenDbRolloutRunRow[] } | { ok: false; error: string }> => {
  const lim = Math.min(100, Math.max(1, Math.floor(limit)))
  const { data, error } = await supabase
    .from('mandanten_db_rollout_runs')
    .select(
      [
        'id',
        'started_by',
        'started_at',
        'finished_at',
        'product_key',
        'module_key',
        'package_id',
        'sql_file',
        'target',
        'mode',
        'status',
        'github_run_url',
        'summary_json',
        'created_at',
        'updated_at',
      ].join(', ')
    )
    .order('started_at', { ascending: false })
    .limit(lim)

  if (error) {
    return { ok: false, error: error.message }
  }

  const rows = (data ?? []) as unknown as MandantenDbRolloutRunRow[]
  return { ok: true, rows }
}

export const fetchMandantenDbRolloutTargets = async (
  runId: string
): Promise<{ ok: true; rows: MandantenDbRolloutTargetRow[] } | { ok: false; error: string }> => {
  const { data, error } = await supabase
    .from('mandanten_db_rollout_targets')
    .select(
      [
        'id',
        'run_id',
        'target_index',
        'tenant_id',
        'project_ref',
        'db_host_masked',
        'status',
        'started_at',
        'finished_at',
        'psql_exit_code',
        'error_excerpt',
        'stdout_excerpt',
        'created_at',
        'updated_at',
      ].join(', ')
    )
    .eq('run_id', runId)
    .order('target_index', { ascending: true })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true, rows: (data ?? []) as unknown as MandantenDbRolloutTargetRow[] }
}

/** Lädt `run_id`+`status` für alle angegebenen Runs und zählt je Status (eine Abfrage pro Chunk). */
export const fetchMandantenDbRolloutTargetCountsByRunIds = async (
  runIds: ReadonlyArray<string>
): Promise<{ ok: true; map: Map<string, MandantenDbRolloutTargetCounts> } | { ok: false; error: string }> => {
  const ids = [...new Set(runIds.filter((id) => Boolean(id?.trim())))]
  const map = new Map<string, MandantenDbRolloutTargetCounts>()
  if (ids.length === 0) {
    return { ok: true, map }
  }

  for (const id of ids) {
    map.set(id, emptyTargetCounts())
  }

  const chunkSize = 40
  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    const chunk = ids.slice(offset, offset + chunkSize)
    const { data, error } = await supabase
      .from('mandanten_db_rollout_targets')
      .select('run_id, status')
      .in('run_id', chunk)

    if (error) {
      return { ok: false, error: error.message }
    }

    for (const row of (data ?? []) as { run_id: string; status: string }[]) {
      const c = map.get(row.run_id)
      if (!c) continue
      const st = row.status
      if (st === 'success') c.success++
      else if (st === 'error') c.error++
      else if (st === 'skipped') c.skipped++
      else if (st === 'queued') c.queued++
      else if (st === 'running') c.running++
    }
  }

  return { ok: true, map }
}

/** E-Mail-Anzeige für gestartet von (Batch). */
export const fetchProfilesEmailByIds = async (
  ids: ReadonlyArray<string | null | undefined>
): Promise<Map<string, string>> => {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x && String(x).trim())))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map
  const { data, error } = await supabase.from('profiles').select('id, email').in('id', unique)
  if (error || !data) return map
  for (const row of data as { id: string; email: string | null }[]) {
    map.set(row.id, row.email?.trim() ? row.email : row.id.slice(0, 8))
  }
  return map
}
