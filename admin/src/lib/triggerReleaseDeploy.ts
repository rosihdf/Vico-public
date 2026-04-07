import { supabase } from './supabase'

export type TriggerReleaseDeployResult =
  | {
      ok: true
      message: string
      app: string
      git_ref: string
      github_actions_url: string
    }
  | { ok: false; duplicate_deploy: true; error: string }
  | { ok: false; error: string }

type InvokePayload = {
  ok?: boolean
  code?: string
  error?: string
  message?: string
  app?: string
  git_ref?: string
  github_actions_url?: string
}

const parseJwtIssuer = (token: string): string | null => {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = JSON.parse(globalThis.atob(padded)) as { iss?: string }
    return typeof json.iss === 'string' ? json.iss : null
  } catch {
    return null
  }
}

export const triggerReleaseDeploy = async (
  releaseId: string,
  confirmRecentDuplicate: boolean
): Promise<TriggerReleaseDeployResult> => {
  const invokeDeploy = async (accessToken?: string) =>
    supabase.functions.invoke<InvokePayload>('trigger-github-deploy', {
      body: { release_id: releaseId, confirm_recent_duplicate: confirmRecentDuplicate },
      ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
    })

  const { data: sessionData } = await supabase.auth.getSession()
  let accessToken = sessionData.session?.access_token

  // Lokale Vorprüfung gegen stale/fremdes JWT (typisch nach URL-/Projektwechsel).
  if (accessToken) {
    const { data: userCheck, error: userCheckError } = await supabase.auth.getUser(accessToken)
    if (userCheckError || !userCheck.user) {
      const { data: refreshed } = await supabase.auth.refreshSession()
      accessToken = refreshed.session?.access_token
    }
  } else {
    const { data: refreshed } = await supabase.auth.refreshSession()
    accessToken = refreshed.session?.access_token
  }

  if (!accessToken) {
    return { ok: false, error: 'Sitzung ungültig. Bitte erneut im Lizenzportal anmelden.' }
  }

  const expectedIssuer = `${(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')}/auth/v1`
  const tokenIssuer = parseJwtIssuer(accessToken)
  if (expectedIssuer && tokenIssuer && tokenIssuer !== expectedIssuer) {
    return {
      ok: false,
      error:
        'Projekt-Mismatch: Login-Token passt nicht zur Admin-Supabase-URL. Bitte VITE_ADMIN_SUPABASE_URL/ANON_KEY im gleichen Lizenzportal-Projekt setzen und neu deployen.',
    }
  }

  const { data: userCheckAfterRefresh, error: userCheckAfterRefreshError } = await supabase.auth.getUser(accessToken)
  if (userCheckAfterRefreshError || !userCheckAfterRefresh.user) {
    return { ok: false, error: 'Sitzung ungültig. Bitte erneut im Lizenzportal anmelden.' }
  }

  let { data, error } = await invokeDeploy(accessToken)

  const status =
    error && error.context && typeof error.context === 'object'
      ? (error.context as { status?: number }).status
      : undefined
  if (error && status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    accessToken = refreshed.session?.access_token
    if (accessToken) {
      ;({ data, error } = await invokeDeploy(accessToken))
    }
  }

  if (error) {
    let detail = ''
    if (error.context && typeof error.context === 'object') {
      const maybe = error.context as { status?: number; statusText?: string }
      if (typeof maybe.status === 'number') {
        detail = ` (HTTP ${maybe.status}${maybe.statusText ? ` ${maybe.statusText}` : ''})`
      }
    }
    if (detail.includes('HTTP 401')) {
      return { ok: false, error: 'Nicht autorisiert (HTTP 401). Bitte erneut im Lizenzportal anmelden.' }
    }
    return { ok: false, error: `${error.message || 'Aufruf fehlgeschlagen'}${detail}` }
  }

  const payload = data
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Leere oder ungültige Antwort' }
  }

  if (payload.ok === true && payload.github_actions_url && payload.git_ref && payload.app) {
    return {
      ok: true,
      message: typeof payload.message === 'string' ? payload.message : 'Workflow gestartet.',
      app: payload.app,
      git_ref: payload.git_ref,
      github_actions_url: payload.github_actions_url,
    }
  }

  if (payload.code === 'duplicate_deploy') {
    return {
      ok: false,
      duplicate_deploy: true,
      error: typeof payload.error === 'string' ? payload.error : 'Kürzlich bereits deployt.',
    }
  }

  return {
    ok: false,
    error: typeof payload.error === 'string' ? payload.error : 'Deploy fehlgeschlagen',
  }
}
