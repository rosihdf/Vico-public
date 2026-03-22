/**
 * Native input[type=date] ist auf iOS/WebKit oft rechts ausgerichtet und lässt sich kaum per CSS korrigieren.
 * Lösung: unsichtbares date-Input (volle Fläche, öffnet den Picker) + sichtbarer, linksbündiger Text (de-DE).
 */
const formatIsoToGermanDisplay = (iso: string): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type DateInputLeftAlignedProps = {
  id: string
  label: string
  value: string
  onChange: (isoDate: string) => void
  disabled?: boolean
}

export const DateInputLeftAligned = ({
  id,
  label,
  value,
  onChange,
  disabled,
}: DateInputLeftAlignedProps) => {

  const display = formatIsoToGermanDisplay(value)

  return (
    <div className="min-w-0 max-w-full">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
        {label}
      </label>
      <div
        className={`group relative w-full min-h-[44px] overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus-within:border-vico-primary focus-within:ring-2 focus-within:ring-vico-primary/30 ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        {/* Sichtbarer Wert – immer linksbündig (unabhängig von WebKit-internem Layout) */}
        <div
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-start px-2 sm:px-3"
          aria-hidden
        >
          <span className="w-full text-left text-sm tabular-nums text-slate-900 dark:text-slate-100">
            {display || '\u00a0'}
          </span>
        </div>
        <input
          id={id}
          type="date"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="relative z-10 box-border h-[44px] min-h-[44px] w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  )
}
