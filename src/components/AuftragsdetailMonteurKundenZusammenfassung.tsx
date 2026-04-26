export type AuftragsdetailMonteurKundenZusammenfassungProps = {
  berichtDatumDisplay: string
  bvTitle: string
  /** Wenn gesetzt: Adressblock unter BV; bei `null` kein zweiter Absatz (wie ohne BV-Zeile). */
  bvAddressMultiline: string | null
  ausgefuehrteDisplay: string
  arbeitszeitGesamtDisplay: string
  materialDisplay: string
  monteurDisplay: string
}

export function AuftragsdetailMonteurKundenZusammenfassung({
  berichtDatumDisplay,
  bvTitle,
  bvAddressMultiline,
  ausgefuehrteDisplay,
  arbeitszeitGesamtDisplay,
  materialDisplay,
  monteurDisplay,
}: AuftragsdetailMonteurKundenZusammenfassungProps) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-900/40 p-4 space-y-4 min-w-0">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Kunden-Zusammenfassung</p>
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
        <div className="p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Berichtsdatum</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{berichtDatumDisplay}</p>
        </div>
        <div className="p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">BV</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{bvTitle}</p>
          {bvAddressMultiline != null ? (
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{bvAddressMultiline}</p>
          ) : null}
        </div>
        <div className="p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Ausgeführte Arbeiten</p>
          <p className="mt-1 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-line">{ausgefuehrteDisplay}</p>
        </div>
        <div className="p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Arbeitszeit gesamt</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{arbeitszeitGesamtDisplay}</p>
        </div>
        <div className="p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Material</p>
          <p className="mt-1 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-line">{materialDisplay}</p>
        </div>
        <div className="p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Monteur</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{monteurDisplay}</p>
        </div>
      </div>
    </div>
  )
}
