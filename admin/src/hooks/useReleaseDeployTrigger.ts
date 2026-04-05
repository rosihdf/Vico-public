import { useState, useEffect, useCallback } from 'react'
import { triggerReleaseDeploy } from '../lib/triggerReleaseDeploy'

export type DeployOutcomeOk = {
  type: 'ok'
  message: string
  github_actions_url: string
  git_ref: string
  app: string
}

export const useReleaseDeployTrigger = (
  releaseId: string | null,
  onDeploySuccess?: (outcome: DeployOutcomeOk) => void
) => {
  const [deployBusy, setDeployBusy] = useState(false)
  const [deployOutcome, setDeployOutcome] = useState<DeployOutcomeOk | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)

  const clearDeploy = useCallback(() => {
    setDeployOutcome(null)
    setDeployError(null)
  }, [])

  useEffect(() => {
    clearDeploy()
  }, [releaseId, clearDeploy])

  const handleDeployClick = useCallback(() => {
    if (!releaseId) return
    const attempt = async (confirmRecentDuplicate: boolean) => {
      setDeployBusy(true)
      setDeployOutcome(null)
      setDeployError(null)
      try {
        const res = await triggerReleaseDeploy(releaseId, confirmRecentDuplicate)
        if (res.ok) {
          const okPayload: DeployOutcomeOk = {
            type: 'ok',
            message: res.message,
            github_actions_url: res.github_actions_url,
            git_ref: res.git_ref,
            app: res.app,
          }
          setDeployOutcome(okPayload)
          onDeploySuccess?.(okPayload)
          return
        }
        if ('duplicate_deploy' in res && res.duplicate_deploy) {
          const ok = window.confirm(
            `${res.error}\n\nTrotzdem einen weiteren Deploy-Workflow starten?`
          )
          if (ok) await attempt(true)
          return
        }
        setDeployError(res.error)
      } finally {
        setDeployBusy(false)
      }
    }
    void attempt(false)
  }, [releaseId, onDeploySuccess])

  return {
    deployBusy,
    deployOutcome,
    deployError,
    handleDeployClick,
    clearDeploy,
  }
}
