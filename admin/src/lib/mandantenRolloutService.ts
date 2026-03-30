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
}

export const triggerMandantenDbRollout = async (
  payload: MandantenRolloutPayload
): Promise<{ ok: true; message?: string } | { ok: false; error: string }> => {
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
    }),
  })

  const text = await res.text()
  let parsed: { error?: string; message?: string; ok?: boolean } = {}
  try {
    parsed = JSON.parse(text) as { error?: string; message?: string; ok?: boolean }
  } catch {
    if (!res.ok) return { ok: false, error: text || res.statusText }
  }

  if (!res.ok) return { ok: false, error: parsed.error ?? res.statusText }
  return { ok: true, message: typeof parsed.message === 'string' ? parsed.message : undefined }
}
