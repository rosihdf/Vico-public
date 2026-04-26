export type AuftragsdetailMonteurSelectedDoorLabel = {
  oid: string
  display: string
}

export type AuftragsdetailMonteurSelectedDoorsHintProps = {
  doors: AuftragsdetailMonteurSelectedDoorLabel[]
}

export function AuftragsdetailMonteurSelectedDoorsHint({
  doors,
}: AuftragsdetailMonteurSelectedDoorsHintProps) {
  if (doors.length <= 1) return null
  return (
    <div className="mt-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">Ausgewählte Türen/Tore für diesen Auftrag:</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {doors.map((entry) => (
          <li
            key={entry.oid}
            className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-200"
            title={`Objekt-ID: ${entry.oid}`}
          >
            {entry.display}
          </li>
        ))}
      </ul>
    </div>
  )
}
