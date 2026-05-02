import { supabase } from './supabase'

const getFunctionsBase = (): string => {
  const u = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
  if (!u) throw new Error('VITE_SUPABASE_URL fehlt.')
  return `${u}/functions/v1`
}

export type MandantenRolloutMode = 'dry_run' | 'apply'

export type MandantenRolloutTarget = 'staging' | 'production'

export type MandantenRolloutPayload = {
  mode: MandantenRolloutMode
  target: MandantenRolloutTarget
  sql_file: string
  product_key?: string | null
  module_key?: string | null
  package_id?: string | null
}

export type MandantenRolloutTriggerResult =
  | {
      ok: true
      message?: string
      run_id?: string
      sql_file?: string
      target?: MandantenRolloutTarget
      mode?: MandantenRolloutMode
    }
  | { ok: false; error: string }

export const triggerMandantenDbRollout = async (
  payload: MandantenRolloutPayload
): Promise<MandantenRolloutTriggerResult> => {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { ok: false, error: 'Nicht angemeldet.' }

  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
  const res = await fetch(`${getFunctionsBase()}/trigger-mandanten-db-rollout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: payload.mode,
      target: payload.target,
      sql_file: payload.sql_file.trim(),
      ...(payload.product_key != null && String(payload.product_key).trim()
        ? { product_key: String(payload.product_key).trim() }
        : {}),
      ...(payload.module_key != null && String(payload.module_key).trim()
        ? { module_key: String(payload.module_key).trim() }
        : {}),
      ...(payload.package_id != null && String(payload.package_id).trim()
        ? { package_id: String(payload.package_id).trim() }
        : {}),
    }),
  })

  const text = await res.text()
  let parsed: {
    error?: string
    message?: string
    ok?: boolean
    run_id?: string
    rollout_run_id?: string
    sql_file?: string
    target?: string
    mode?: string
  } = {}
  try {
    parsed = JSON.parse(text) as typeof parsed
  } catch {
    if (!res.ok) return { ok: false, error: text || res.statusText }
  }

  if (!res.ok) return { ok: false, error: parsed.error ?? res.statusText }

  const runIdRaw = typeof parsed.run_id === 'string' ? parsed.run_id : parsed.rollout_run_id
  const targetRaw = parsed.target === 'staging' ? 'staging' : parsed.target === 'production' ? 'production' : undefined
  const modeRaw =
    parsed.mode === 'dry_run'
      ? 'dry_run'
      : parsed.mode === 'apply'
        ? 'apply'
        : undefined

  return {
    ok: true,
    message: typeof parsed.message === 'string' ? parsed.message : undefined,
    run_id: typeof runIdRaw === 'string' ? runIdRaw : undefined,
    sql_file: typeof parsed.sql_file === 'string' ? parsed.sql_file : undefined,
    target: targetRaw,
    mode: modeRaw,
  }
}
