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
      className="border-b border-indigo-200 bg-indigo-100 py-2.5 px-4 text-center text-sm leading-relaxed text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950 dark:text-slate-100"
      aria-live="polite"
    >
      <span className="font-semibold text-indigo-950 dark:text-indigo-100">
        App-Release ({ch}):
      </span>{' '}
      <span className="text-indigo-900 dark:text-slate-100">
        Anstehende Versionen – bitte testen und Rückmeldung geben: {parts.join(' · ')}.
      </span>
      {hardReloadHint ? (
        <span className="mt-2 block border-t border-indigo-200/80 pt-2 text-xs font-normal text-indigo-900 dark:border-indigo-700/80 dark:text-slate-300">
          Hinweis: Mindestens ein Release ist mit „hartem Neu-Laden“ nach Freigabe gekennzeichnet. Nach dem Go-Live die
          Seite oder App vollständig neu laden (kein reines Weiterarbeiten im offenen Tab).
        </span>
      ) : null}
    </div>
  )
}

export default MandantenIncomingReleaseBanner
