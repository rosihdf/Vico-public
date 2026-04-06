import type { MandantenReleasesApiPayload } from './mandantenReleaseApi'
import { incomingReleasesHaveHardReloadHint, mandantenReleasesHasIncoming } from './mandantenReleaseApi'

const CHANNEL_LABEL_DE: Record<MandantenReleasesApiPayload['channel'], string> = {
  main: 'Haupt-App',
  kundenportal: 'Kundenportal',
  arbeitszeit_portal: 'Arbeitszeitenportal',
}

type MandantenIncomingReleaseBannerProps = {
  releases: MandantenReleasesApiPayload | null | undefined
}

/**
 * §11.20: Hinweis, wenn der Mandant für den erkannten Kanal „Incoming“-Releases sieht (Pilot / Rollout).
 */
const MandantenIncomingReleaseBanner = ({ releases }: MandantenIncomingReleaseBannerProps) => {
  if (!releases) return null
  if (!mandantenReleasesHasIncoming(releases)) return null

  const ch = CHANNEL_LABEL_DE[releases.channel]
  const parts = releases.incoming.map((r) => {
    const label = r.title?.trim() || r.version
    return r.version && r.title?.trim() ? `${label} (${r.version})` : label
  })
  const hardReloadHint = incomingReleasesHaveHardReloadHint(releases)

  return (
    <div
      role="status"
      className="bg-indigo-100 dark:bg-indigo-950/45 text-indigo-950 dark:text-indigo-100 text-center py-2 px-4 text-sm font-medium border-b border-indigo-200 dark:border-indigo-800"
      aria-live="polite"
    >
      <span className="font-semibold">App-Release ({ch}):</span>{' '}
      <span>
        Anstehende Versionen – bitte testen und Rückmeldung geben: {parts.join(' · ')}.
      </span>
      {hardReloadHint ? (
        <span className="mt-2 block text-xs font-medium text-indigo-900 dark:text-indigo-200">
          Hinweis: Mindestens ein Release ist mit „hartem Neu-Laden“ nach Freigabe gekennzeichnet – nach Go-Live die
          Seite/App vollständig neu laden.
        </span>
      ) : null}
    </div>
  )
}

export default MandantenIncomingReleaseBanner
