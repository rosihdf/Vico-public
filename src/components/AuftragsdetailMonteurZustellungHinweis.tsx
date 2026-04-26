export type AuftragsdetailMonteurZustellungHinweisProps = {
  /** Entspricht der bisherigen Bedingung vor dem Absatz (Monteur-Abschluss + Auftrag noch nicht erledigt/storniert). */
  show: boolean
  message: string
}

export function AuftragsdetailMonteurZustellungHinweis({
  show,
  message,
}: AuftragsdetailMonteurZustellungHinweisProps) {
  if (!show) return null
  return (
    <p
      className="text-sm text-slate-600 dark:text-slate-300 max-w-xl pt-1"
      role="status"
      aria-live="polite"
    >
      {message}
    </p>
  )
}
