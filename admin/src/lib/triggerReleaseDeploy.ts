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

export const triggerReleaseDeploy = async (
  releaseId: string,
  confirmRecentDuplicate: boolean
): Promise<TriggerReleaseDeployResult> => {
  const { data, error } = await supabase.functions.invoke<InvokePayload>('trigger-github-deploy', {
    body: { release_id: releaseId, confirm_recent_duplicate: confirmRecentDuplicate },
  })

  if (error) {
    return { ok: false, error: error.message || 'Aufruf fehlgeschlagen' }
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
