import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { getObjectPhotoUrl } from '../../lib/dataService'
import { getObjectDisplayName, formatObjectRoomFloor } from '../../lib/objectUtils'
import type { MaintenanceReminder, Object as Obj } from '../../types'

const ObjectProfileThumbInline = ({ path }: { path?: string | null }) => {
  const p = path?.trim()
  if (!p) return null
  return (
    <img
      src={getObjectPhotoUrl(p)}
      alt=""
      className="w-10 h-10 rounded-md object-cover shrink-0 border border-slate-200 dark:border-slate-600"
      loading="lazy"
    />
  )
}

const ProtocolMangelObjectBadge = ({ count }: { count: number }) => {
  if (count <= 0) return null
  const label = `${count} offene Protokoll-Mängel`
  return (
    <span
      className="inline-flex min-h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-rose-100 px-1 text-[10px] font-bold text-rose-900 dark:bg-rose-900/45 dark:text-rose-100"
      title={label}
      aria-label={label}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

const MaintenanceStatusDot = ({
  reminder,
  mode,
}: {
  reminder: MaintenanceReminder | undefined
  mode: 'short' | 'long'
}) => {
  if (mode === 'short') {
    const status = reminder?.status
    const title = reminder
      ? status === 'overdue'
        ? `Überfällig`
        : status === 'due_soon'
          ? `Bald fällig`
          : 'Wartung in Ordnung'
      : 'Kein Wartungsintervall'
    const dotClass = status === 'overdue' ? 'bg-red-500' : status === 'due_soon' ? 'bg-amber-500' : 'bg-green-500'
    return (
      <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${reminder ? dotClass : 'bg-slate-200'}`} title={title} aria-label={title} />
    )
  }
  const status = reminder?.status
  const title = reminder
    ? status === 'overdue'
      ? `Überfällig (seit ${reminder.days_until_due != null ? Math.abs(reminder.days_until_due) : '?'} Tagen)`
      : status === 'due_soon'
        ? `Bald fällig (in ${reminder.days_until_due ?? '?'} Tagen)`
        : 'Wartung in Ordnung'
    : 'Kein Wartungsintervall'
  const dotClass = status
    ? status === 'overdue'
      ? 'bg-red-500'
      : status === 'due_soon'
        ? 'bg-amber-500'
        : 'bg-green-500'
    : 'bg-slate-200 border border-slate-300'
  return (
    <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${dotClass}`} title={title} aria-label={title} />
  )
}

export type KundenObjectAccordionRowProps = {
  obj: Obj
  protocolMangelCount: number
  maintenanceReminder: MaintenanceReminder | undefined
  reminderDisplayMode: 'short' | 'long'
  rowSurface: 'default' | 'amber'
  canUseQrBatch: boolean
  qrBatchChecked: boolean
  onToggleQrBatch: () => void
  canEdit: boolean
  onOpen: () => void
  openButtonLabel: string
  onDuplicate: () => void
  duplicateDisabled: boolean
  duplicateDisabledTitle: string | undefined
  showAuftragLink: boolean
  auftragTo: string
  showProtokollLink: boolean
  protokollTo: string
  onShowQr: () => void
  isolateRowClicks: boolean
}

export const KundenObjectAccordionRow = ({
  obj,
  protocolMangelCount,
  maintenanceReminder,
  reminderDisplayMode,
  rowSurface,
  canUseQrBatch,
  qrBatchChecked,
  onToggleQrBatch,
  canEdit,
  onOpen,
  openButtonLabel,
  onDuplicate,
  duplicateDisabled,
  duplicateDisabledTitle,
  showAuftragLink,
  auftragTo,
  showProtokollLink,
  protokollTo,
  onShowQr,
  isolateRowClicks,
}: KundenObjectAccordionRowProps) => {
  const liClass =
    rowSurface === 'amber'
      ? 'bg-white dark:bg-slate-900/80 rounded border border-amber-200 dark:border-amber-800 p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5'
      : 'bg-white dark:bg-slate-900/80 rounded border border-slate-200 dark:border-slate-600 p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5'

  const run = (fn: () => void) =>
    isolateRowClicks
      ? (e: MouseEvent) => {
          e.stopPropagation()
          fn()
        }
      : () => {
          fn()
        }

  const displayName = getObjectDisplayName(obj)

  return (
    <li className={liClass}>
      <div className="min-w-0 flex items-center gap-2">
        {canUseQrBatch && (
          <label className="shrink-0 flex items-center cursor-pointer" title="Für A4-Sammel-PDF auswählen">
            <input
              type="checkbox"
              checked={qrBatchChecked}
              onChange={onToggleQrBatch}
              className="rounded border-slate-400 text-vico-primary focus:ring-vico-primary"
              aria-label={`${displayName} für A4-PDF auswählen`}
            />
          </label>
        )}
        <ObjectProfileThumbInline path={obj.profile_photo_path} />
        <MaintenanceStatusDot reminder={maintenanceReminder} mode={reminderDisplayMode} />
        <div>
          <p className="font-medium text-slate-600 dark:text-slate-300 text-xs inline-flex items-center gap-1.5 flex-wrap">
            {displayName}
            <ProtocolMangelObjectBadge count={protocolMangelCount} />
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatObjectRoomFloor(obj)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {canEdit && (
          <button
            type="button"
            onClick={run(onOpen)}
            className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
            aria-label={`${displayName} öffnen`}
          >
            {openButtonLabel}
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={run(onDuplicate)}
            disabled={duplicateDisabled}
            title={duplicateDisabledTitle}
            className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`${displayName} kopieren`}
          >
            Kopie
          </button>
        )}
        {showAuftragLink && (
          <Link
            to={auftragTo}
            className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
            aria-label={`Auftrag anlegen: ${displayName}`}
          >
            Auftrag
          </Link>
        )}
        {showProtokollLink && (
          <Link
            to={protokollTo}
            className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            Protokoll
          </Link>
        )}
        <button
          type="button"
          onClick={run(onShowQr)}
          className="px-2.5 py-1.5 min-h-[32px] inline-flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
          aria-label="QR-Code anzeigen"
        >
          QR-Code
        </button>
      </div>
    </li>
  )
}
