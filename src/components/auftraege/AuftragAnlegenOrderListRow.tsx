import { Link } from 'react-router-dom'
import { getOrderObjectIds } from '../../lib/orderUtils'
import { getObjectDisplayName } from '../../lib/objectUtils'
import { getProfileDisplayName, type Profile } from '../../lib/userService'
import {
  ORDER_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  orderPageControlH,
  orderListNativeControl,
  orderListActionBtn,
  orderListActionLink,
  orderListRowSelect,
  buildObjektBearbeitenUrl,
} from '../../lib/auftragAnlegenFormModel'
import {
  orderObjectSummaryForOrder,
  getProfileLabelForOrderList,
  type AuftragOrderListRow,
} from '../../lib/auftragAnlegenListDerive'
import type { Object as Obj, OrderStatus } from '../../types'

export type AuftragAnlegenOrderListRowProps = {
  row: AuftragOrderListRow
  allObjects: Obj[]
  profiles: Profile[]
  profilesAssignable: Profile[]
  berichteLoadingOrderId: string | null
  canAssign: boolean
  canEdit: boolean
  archiveMode: 'active' | 'archive'
  checklistAssistantAvailable: boolean
  onMonteursberichtClick: () => void
  onPruefprotokollClick: (objectId: string) => void
  onAssignmentChange: (assignedTo: string) => void
  onDateChange: (newDate: string) => void
  onStatusChange: (status: OrderStatus) => void
  onEditClick: () => void
  onDeleteClick: () => void
}

export function AuftragAnlegenOrderListRow({
  row: o,
  allObjects,
  profiles,
  profilesAssignable,
  berichteLoadingOrderId,
  canAssign,
  canEdit,
  archiveMode,
  checklistAssistantAvailable,
  onMonteursberichtClick,
  onPruefprotokollClick,
  onAssignmentChange,
  onDateChange,
  onStatusChange,
  onEditClick,
  onDeleteClick,
}: AuftragAnlegenOrderListRowProps) {
  return (
    <li
      className={`rounded-lg border p-4 flex flex-col gap-3 ${
        !o.assigned_to
          ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 border-l-4 border-l-amber-500'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600'
      }`}
    >
      <div>
        <p className="font-medium text-slate-800 dark:text-slate-100">
          {o.customerName} → {o.bvName}
          {!o.assigned_to && (
            <span className="ml-2 text-sm font-normal text-amber-700 dark:text-amber-300">(nicht zugewiesen)</span>
          )}
          {o.isLinked ? (
            <span className="ml-2 inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 text-xs font-medium text-sky-800 dark:text-sky-200">
              verknüpft
            </span>
          ) : null}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {o.order_date}{o.order_time ? ` ${o.order_time.slice(0, 5)}` : ''} · {ORDER_TYPE_LABELS[o.order_type]} ·{' '}
          {ORDER_STATUS_LABELS[o.status]}
          {orderObjectSummaryForOrder(o, allObjects)}
          {o.assigned_to && (
            <span className="ml-2 text-slate-500 dark:text-slate-400">
              → {getProfileLabelForOrderList(profiles, o.assigned_to)}
            </span>
          )}
        </p>
        {o.related_order_id ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Verknüpft mit{' '}
            <Link
              to={`/auftrag/${o.related_order_id}`}
              className="text-vico-primary hover:underline dark:text-sky-400"
            >
              Auftrag #{o.related_order_id.slice(0, 8)}
            </Link>
          </p>
        ) : o.hasChildren ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hat verknüpfte Folgeaufträge.</p>
        ) : null}
        {o.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate max-w-md">{o.description}</p>
        )}
      </div>
      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-0.5 w-full items-center justify-end">
        {o.status === 'erledigt' && (
          <>
            <button
              type="button"
              disabled={berichteLoadingOrderId === o.id}
              onClick={onMonteursberichtClick}
              className={orderListActionBtn}
              title="Gespeicherten Monteursbericht anzeigen"
            >
              Monteursbericht
            </button>
            {o.order_type === 'wartung'
              ? getOrderObjectIds(o)
                  .filter(Boolean)
                  .map((oid) => {
                    const obj = allObjects.find((x) => x.id === oid)
                    return (
                      <button
                        key={oid}
                        type="button"
                        disabled={berichteLoadingOrderId === o.id}
                        onClick={() => onPruefprotokollClick(oid)}
                        className="px-3 py-1.5 text-sm shrink-0 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 max-w-[140px] truncate"
                        title={`Prüfprotokoll anzeigen: ${obj ? getObjectDisplayName(obj) : oid.slice(0, 8)}`}
                        aria-label={`Prüfprotokoll anzeigen: ${obj ? getObjectDisplayName(obj) : oid.slice(0, 8)}`}
                      >
                        Prüfprotokoll
                      </button>
                    )
                  })
              : null}
          </>
        )}
        {canAssign && archiveMode === 'active' && (
          <select
            value={profilesAssignable.some((p) => p.id === o.assigned_to) ? o.assigned_to ?? '' : ''}
            onChange={(e) => onAssignmentChange(e.target.value)}
            className={`${orderListRowSelect} min-w-[140px]`}
            title="Nutzer auswählen (Liste)"
            aria-label="Nutzer aus Liste zuweisen"
          >
            <option value="">— Zuweisen —</option>
            {profilesAssignable.map((p) => (
              <option key={p.id} value={p.id}>
                {getProfileDisplayName(p)}
              </option>
            ))}
          </select>
        )}
        {canEdit && archiveMode === 'active' && (
          <>
            <input
              type="date"
              value={o.order_date}
              onChange={(e) => onDateChange(e.target.value)}
              className={`${orderListNativeControl} max-w-[140px]`}
              title="Termin ändern"
              aria-label="Termin ändern"
            />
            <select
              value={o.status}
              onChange={(e) => onStatusChange(e.target.value as OrderStatus)}
              className={orderListRowSelect}
              title="Status auswählen (Liste)"
              aria-label="Auftragsstatus aus Liste wählen"
            >
              {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </>
        )}
        {canEdit && archiveMode === 'active' && (
          <button type="button" onClick={onEditClick} className={orderListActionBtn}>
            Bearbeiten
          </button>
        )}
        <Link
          to={
            o.status === 'erledigt'
              ? `/auftrag/${o.id}`
              : checklistAssistantAvailable && o.order_type === 'wartung'
                ? `/auftrag/${o.id}/assistent`
                : `/auftrag/${o.id}`
          }
          className={orderListActionLink}
          aria-label={
            o.status === 'erledigt'
              ? 'Erledigten Auftrag ansehen'
              : checklistAssistantAvailable && o.order_type === 'wartung'
                ? 'Auftrag abarbeiten (Assistent oder klassische Ansicht)'
                : 'Auftrag bearbeiten'
          }
        >
          {o.status === 'erledigt' ? 'Ansehen' : 'Abarbeiten'}
        </Link>
        <Link to={buildObjektBearbeitenUrl(o)} className={orderListActionLink}>
          Tür/Tor
        </Link>
        {canEdit && o.status !== 'erledigt' && o.status !== 'storniert' && (
          <button
            type="button"
            onClick={onDeleteClick}
            className={`${orderPageControlH} px-3 text-sm inline-flex items-center justify-center shrink-0 ml-auto text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40`}
          >
            Löschen
          </button>
        )}
      </div>
    </li>
  )
}
