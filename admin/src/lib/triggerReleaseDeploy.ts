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

const parseOrigin = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).origin
  } catch {
    return ''
  }
}

export const triggerReleaseDeploy = async (
  releaseId: string,
  confirmRecentDuplicate: boolean
): Promise<TriggerReleaseDeployResult> => {
  const licenseApiBase =
    (import.meta.env.VITE_LICENSE_API_URL ?? '').trim().replace(/\/$/, '') ||
    `${(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')}/functions/v1`
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

  const invokeDeploy = async (accessToken?: string) => {
    if (!licenseApiBase) {
      return {
        data: null as InvokePayload | null,
        error: 'Lizenz-API-URL fehlt (VITE_LICENSE_API_URL).',
        status: 0,
      }
    }
    const res = await fetch(`${licenseApiBase}/trigger-github-deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(anonKey ? { apikey: anonKey } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ release_id: releaseId, confirm_recent_duplicate: confirmRecentDuplicate }),
    })

    const payload = (await res.json().catch(() => ({}))) as InvokePayload
    return {
      data: payload,
      error: res.ok ? null : payload.error || `HTTP ${res.status}`,
      status: res.status,
    }
  }

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

  // Zusätzliche Quer-Prüfung: Login-Token muss zum Lizenz-API-Projekt passen.
  const licenseApiOrigin = parseOrigin(licenseApiBase)
  if (tokenIssuer && licenseApiOrigin && !tokenIssuer.startsWith(`${licenseApiOrigin}/auth/v1`)) {
    return {
      ok: false,
      error:
        `Projekt-Mismatch: Login läuft über ${parseOrigin(tokenIssuer)}, Deploy-API über ${licenseApiOrigin}. Bitte Admin-Login auf dasselbe Lizenzportal-Supabase-Projekt konfigurieren.`,
    }
  }

  const { data: userCheckAfterRefresh, error: userCheckAfterRefreshError } = await supabase.auth.getUser(accessToken)
  if (userCheckAfterRefreshError || !userCheckAfterRefresh.user) {
    return { ok: false, error: 'Sitzung ungültig. Bitte erneut im Lizenzportal anmelden.' }
  }

  let { data, error, status } = await invokeDeploy(accessToken)

  if (error && status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    accessToken = refreshed.session?.access_token
    if (accessToken) {
      ;({ data, error, status } = await invokeDeploy(accessToken))
    }
  }

  if (error) {
    if (status === 401) {
      return { ok: false, error: 'Nicht autorisiert (HTTP 401). Bitte erneut im Lizenzportal anmelden.' }
    }
    return { ok: false, error: typeof error === 'string' ? error : 'Aufruf fehlgeschlagen' }
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
