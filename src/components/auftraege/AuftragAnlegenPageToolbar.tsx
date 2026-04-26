import { Link } from 'react-router-dom'
import { orderPageSegmentBtn, orderPagePrimaryCta } from '../../lib/auftragAnlegenFormModel'

export type AuftragAnlegenPageToolbarProps = {
  canBuchhaltungExport: boolean
  canEdit: boolean
  archiveMode: 'active' | 'archive'
  viewMode: 'list' | 'calendar'
  relationFilter: 'all' | 'linked' | 'unlinked'
  onArchiveActive: () => void
  onArchiveArchive: () => void
  onViewList: () => void
  onViewCalendar: () => void
  onRelationAll: () => void
  onRelationLinked: () => void
  onRelationUnlinked: () => void
  onCreateClick: () => void
}

export function AuftragAnlegenPageToolbar({
  canBuchhaltungExport,
  canEdit,
  archiveMode,
  viewMode,
  relationFilter,
  onArchiveActive,
  onArchiveArchive,
  onViewList,
  onViewCalendar,
  onRelationAll,
  onRelationLinked,
  onRelationUnlinked,
  onCreateClick,
}: AuftragAnlegenPageToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Aufträge</h2>
        {canBuchhaltungExport && (
          <Link
            to="/buchhaltung-export"
            className="mt-1 inline-block text-sm font-medium text-vico-primary hover:underline focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 rounded dark:focus:ring-offset-slate-900"
          >
            Buchhaltungs-Export (CSV) →
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
          <button
            type="button"
            onClick={onArchiveActive}
            className={`${orderPageSegmentBtn} ${
              archiveMode === 'active'
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Aktive
          </button>
          <button
            type="button"
            onClick={onArchiveArchive}
            className={`${orderPageSegmentBtn} ${
              archiveMode === 'archive'
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Archiv
          </button>
        </div>
        <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
          <button
            type="button"
            onClick={onViewList}
            className={`${orderPageSegmentBtn} ${
              viewMode === 'list'
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Liste
          </button>
          <button
            type="button"
            onClick={onViewCalendar}
            className={`${orderPageSegmentBtn} ${
              viewMode === 'calendar'
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Kalender
          </button>
        </div>
        <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
          <button
            type="button"
            onClick={onRelationAll}
            className={`${orderPageSegmentBtn} ${
              relationFilter === 'all'
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Alle
          </button>
          <button
            type="button"
            onClick={onRelationLinked}
            className={`${orderPageSegmentBtn} ${
              relationFilter === 'linked'
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Verknüpft
          </button>
          <button
            type="button"
            onClick={onRelationUnlinked}
            className={`${orderPageSegmentBtn} ${
              relationFilter === 'unlinked'
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Ohne Verknüpfung
          </button>
        </div>
        {canEdit && archiveMode === 'active' && (
          <button
            type="button"
            onClick={onCreateClick}
            className={`${orderPagePrimaryCta} bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600`}
          >
            + Auftrag anlegen
          </button>
        )}
      </div>
    </div>
  )
}
