import { useId, useState } from 'react'
import type { C1PositionCompare } from '../../lib/altberichtImport/altberichtImportC1CompareReport'
import { summarizeC1PositionCompare } from '../../lib/altberichtImport/altberichtImportC1CompareReport'

const fieldBadgeClass = (label: C1PositionCompare['fields'][0]['statusLabel']): string => {
  switch (label) {
    case 'passt':
      return 'text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50'
    case 'fehlt':
      return 'text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40'
    case 'abweichend':
      return 'text-rose-900 dark:text-rose-100 bg-rose-50 dark:bg-rose-950/40'
    default:
      return 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40'
  }
}

const toneBarClass = (tone: 'ok' | 'warn' | 'bad' | 'neutral'): string => {
  switch (tone) {
    case 'ok':
      return 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/30'
    case 'warn':
      return 'border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30'
    case 'bad':
      return 'border-rose-200 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/25'
    default:
      return 'border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50'
  }
}

type AltberichtC1CompareRowInlineProps = {
  compare: C1PositionCompare
}

export const AltberichtC1CompareRowInline = ({ compare }: AltberichtC1CompareRowInlineProps) => {
  const [open, setOpen] = useState(false)
  /** Direkt pro Render (kein useMemo) – stets passend zu den aktuellen Staging-Review-Daten. */
  const sum = summarizeC1PositionCompare(compare)
  const panelId = useId()

  return (
    <div
      className={`rounded border text-xs ${toneBarClass(sum.tone)} overflow-hidden`}
      data-altbericht-c1-abgleich
    >
      <div className="px-2 py-1.5 flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-800 dark:text-slate-100 shrink-0">Abgleich: PDF / Staging</span>
        <span className="text-slate-700 dark:text-slate-200 min-w-0 flex-1">{sum.headline}</span>
        <button
          type="button"
          className="shrink-0 rounded border border-slate-300 dark:border-slate-500 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Details ausblenden' : 'Details anzeigen'}
        </button>
      </div>
      {sum.subline ? (
        <div className="px-2 pb-1.5 text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
          {sum.subline}
        </div>
      ) : null}
      {open ? (
        <div id={panelId} className="border-t border-slate-200/80 dark:border-slate-600/80 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[11px]">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/80">
                <th className="py-1.5 pl-2 pr-1 w-[20%] font-medium">Feld</th>
                <th className="py-1.5 pr-1 w-[36%] font-medium">PDF / Staging</th>
                <th className="py-1.5 pr-1 w-[36%] font-medium">Produktiv</th>
                <th className="py-1.5 pr-2 w-[8%] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {compare.fields.map((f) => (
                <tr key={f.label} className="border-b border-slate-100/90 dark:border-slate-800/80 align-top">
                  <td className="py-1 pl-2 pr-1 text-slate-600 dark:text-slate-300">{f.label}</td>
                  <td className="py-1 pr-1 text-slate-800 dark:text-slate-100 break-words">{f.left}</td>
                  <td className="py-1 pr-1 text-slate-800 dark:text-slate-100 break-words">{f.right}</td>
                  <td className="py-1 pr-2">
                    <span
                      className={`inline-block rounded px-1 py-0.5 text-[9px] font-medium ${fieldBadgeClass(
                        f.statusLabel
                      )}`}
                    >
                      {f.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {compare.findingsLeft && compare.findingsLeft !== '—' ? (
            <div className="px-2 py-1.5 text-[11px] border-t border-slate-200/80 dark:border-slate-600/80 bg-white/30 dark:bg-slate-900/30">
              <span className="font-medium text-slate-600 dark:text-slate-300">Mängel / Hinweise (Staging):</span>{' '}
              {compare.findingsLeft}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
