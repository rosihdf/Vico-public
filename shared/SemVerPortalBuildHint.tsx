import { useMemo } from 'react'
import { getSemverPortalVsBuildRelation } from './versionUtils'

export type SemVerPortalBuildHintProps = {
  /** Lokale Build-Version (`__APP_VERSION__`). */
  buildVersion: string
  /** Im Lizenzportal gepflegte Anzeigeversion (optional). */
  portalDisplayVersion: string | undefined | null
}

/**
 * Hinweis nur wenn Build und Portal-Version beide als SemVer (x.y.z) lesbar sind und sich unterscheiden.
 */
export const SemVerPortalBuildHint = ({ buildVersion, portalDisplayVersion }: SemVerPortalBuildHintProps) => {
  const relation = useMemo(
    () => getSemverPortalVsBuildRelation(buildVersion, portalDisplayVersion),
    [buildVersion, portalDisplayVersion]
  )

  if (relation === null || relation === 'same') return null

  if (relation === 'portal_ahead') {
    return (
      <div
        className="mb-4 p-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">SemVer: Lizenzportal vor Build</p>
        <p className="text-sm text-amber-900/95 dark:text-amber-100/95">
          Im Lizenzportal ist <strong>{portalDisplayVersion?.trim()}</strong> hinterlegt – neuer als Ihr aktueller Build (
          <strong>{buildVersion}</strong>). Nach Deployment oder wenn <code className="text-xs bg-amber-100/80 dark:bg-amber-900/50 px-1 rounded">version.json</code> zum Server passt, sollten die Versionen übereinstimmen.
        </p>
      </div>
    )
  }

  return (
    <div
      className="mb-4 p-3 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/90 dark:bg-sky-950/30 text-sky-950 dark:text-sky-100"
      role="status"
      aria-live="polite"
    >
      <p className="text-xs font-semibold text-sky-900 dark:text-sky-200 mb-1">SemVer: Build vor Lizenzportal</p>
      <p className="text-sm text-sky-900/95 dark:text-sky-100/95">
        Ihr Build (<strong>{buildVersion}</strong>) ist neuer als die im Lizenzportal gepflegte Anzeigeversion (
        <strong>{portalDisplayVersion?.trim()}</strong>). Bitte die Version im Mandanten im Lizenzportal anpassen.
      </p>
    </div>
  )
}
