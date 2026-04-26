export type AuftragsdetailWartungChecklistBypassNoticeProps = {
  bypassAtIso: string
  bypassAtDisplay: string
  bypassUserDisplay: string | null
  incompleteDoorsLine: string | null
}

export function AuftragsdetailWartungChecklistBypassNotice({
  bypassAtIso,
  bypassAtDisplay,
  bypassUserDisplay,
  incompleteDoorsLine,
}: AuftragsdetailWartungChecklistBypassNoticeProps) {
  return (
    <div
      className="mb-6 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
      role="note"
      aria-label="Hinweis zum Abschluss der Wartungscheckliste"
    >
      <p className="font-semibold text-amber-900 dark:text-amber-50">Abschluss mit Ausnahme</p>
      <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
        Dieser Auftrag wurde mit „Trotzdem abschließen“ beendet, obwohl die Wartungscheckliste nicht für alle
        Türen vollständig war. Zeitpunkt:{' '}
        <time dateTime={bypassAtIso}>{bypassAtDisplay}</time>
        {bypassUserDisplay ? (
          <>
            {' '}
            · Nutzer: {bypassUserDisplay}
          </>
        ) : null}
      </p>
      {incompleteDoorsLine ? (
        <p className="mt-2 text-xs text-amber-900/85 dark:text-amber-100/85">
          Unvollständig (Tür/Tor): {incompleteDoorsLine}
        </p>
      ) : null}
    </div>
  )
}
