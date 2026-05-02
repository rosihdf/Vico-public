import type { UpdateHubStatusKind, UpdateHubStatusLine } from '../lib/updateHubStatus'

const dotClass = (status: UpdateHubStatusKind): string => {
  if (status === 'ok') return 'bg-emerald-500'
  if (status === 'warning') return 'bg-amber-500'
  if (status === 'error') return 'bg-red-600'
  return 'bg-slate-400'
}

const labelForStatus = (status: UpdateHubStatusKind): string => {
  if (status === 'ok') return 'OK'
  if (status === 'warning') return 'Hinweis'
  if (status === 'error') return 'Blockiert'
  return 'Nicht geprüft'
}

export type UpdateHubStatusPanelProps = {
  title: string
  lines: UpdateHubStatusLine[]
  description?: string
  ariaLabelledById?: string
}

export const UpdateHubStatusPanel = ({
  title,
  lines,
  description,
  ariaLabelledById = 'update-hub-status-heading',
}: UpdateHubStatusPanelProps) => {
  return (
    <section
      className="rounded-lg border border-slate-300 bg-white p-3 sm:p-4 space-y-3"
      aria-labelledby={ariaLabelledById}
      role="region"
    >
      <h4 id={ariaLabelledById} className="text-sm font-semibold text-slate-900 m-0">
        {title}
      </h4>
      {description ? (
        <p className="text-[11px] text-slate-500 m-0" role="note">
          {description}
        </p>
      ) : null}
      <ul className="list-none m-0 p-0 space-y-2" aria-label={title}>
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
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {labelForStatus(line.status)}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 m-0 leading-snug break-words">{line.explanation}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
