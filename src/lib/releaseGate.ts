import type { MandantenReleasesApiPayload } from '../../shared/mandantenReleaseApi'
import { isNewerVersion, isSemverComparable } from '../../shared/versionUtils'

/**
 * Kanalbezogenes Gate auf Basis des aktiven Mandanten-Releases (tenant_release_assignments).
 * Wichtig für Pilot-Rollouts: nur der aktuell zugewiesene Kanal-Release zählt.
 */
export const isAssignedChannelReleaseAtLeast = (
  releases: MandantenReleasesApiPayload | null | undefined,
  minimumVersion: string
): boolean => {
  const active = releases?.active?.version?.trim() ?? ''
  if (!active || !isSemverComparable(active) || !isSemverComparable(minimumVersion)) return false
  return !isNewerVersion(active, minimumVersion)
}

