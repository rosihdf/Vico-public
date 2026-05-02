import type { MailSetupStatusKind, MailSetupStatusLine } from '../../lib/mandantMailSetupStatus'

const dotClass = (status: MailSetupStatusKind): string => {
  if (status === 'ok') return 'bg-emerald-500'
  if (status === 'warning') return 'bg-amber-500'
  return 'bg-red-600'
}

const labelForStatus = (status: MailSetupStatusKind): string => {
  if (status === 'ok') return 'OK'
  if (status === 'warning') return 'Hinweis'
  return 'Fehlt'
}

export type MandantMailSetupStatusProps = {
  lines: MailSetupStatusLine[]
  onRefresh?: () => void | Promise<void>
  refreshLoading?: boolean
}

export const MandantMailSetupStatus = ({
  lines,
  onRefresh,
  refreshLoading = false,
}: MandantMailSetupStatusProps) => {
  return (
    <section
      className="rounded-lg border border-slate-300 bg-white p-3 sm:p-4 space-y-3"
      aria-labelledby="mail-system-status-heading"
      role="region"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id="mail-system-status-heading" className="text-sm font-semibold text-slate-900 m-0">
          Mail-System Status
        </h4>
        {onRefresh ? (
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={refreshLoading}
            className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
          >
            {refreshLoading ? 'Prüfen…' : 'Setup prüfen'}
          </button>
        ) : null}
      </div>
      <p className="text-[11px] text-slate-500 m-0" role="note">
        Ampel aus Formular, Secret-Flags und Vorlagenliste – keine Secrets werden angezeigt.
      </p>
      <ul className="list-none m-0 p-0 space-y-2" aria-label="Einzelschritte Mail-Einrichtung">
        {lines.map((line) => (
          <li
            key={line.key}
            className="flex gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-2 text-xs text-slate-800"
          >
            <span
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotClass(line.status)}`}
              title={labelForStatus(line.status)}
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span className="font-medium text-slate-900">{line.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">{labelForStatus(line.status)}</span>
              </div>
              <p className="text-[11px] text-slate-600 m-0 leading-snug">{line.explanation}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
