import type { FormEvent } from 'react'
import OrderActiveConflictCallout from '../OrderActiveConflictCallout'
import { getObjectDisplayName } from '../../lib/objectUtils'
import { getProfileDisplayName, type Profile } from '../../lib/userService'
import type { ActiveOrderObjectConflict } from '../../lib/orderUtils'
import {
  ORDER_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  orderFormControl,
  orderFormTextarea,
  orderFormFooterBtn,
  orderPagePrimaryCta,
  type OrderFormState,
} from '../../lib/auftragAnlegenFormModel'
import type { Customer, BV, Object as Obj, OrderType, OrderStatus } from '../../types'

export type AuftragAnlegenOrderFormModalProps = {
  onBackdropClick: () => void
  formMode: 'create' | 'edit'
  formData: OrderFormState
  customers: Customer[]
  bvs: BV[]
  showBvSelect: boolean
  singleBv: BV | null
  showTuerTorSection: boolean
  hasDoorsToPick: boolean
  pickerObjects: Obj[]
  showZuweisungSection: boolean
  canAssign: boolean
  profilesAssignable: Profile[]
  onFormChange: (field: keyof OrderFormState, value: string | OrderType | OrderStatus) => void
  onToggleObject: (objectId: string) => void
  isRelease110Enabled: boolean
  conflictCalloutRows: ActiveOrderObjectConflict[]
  resolveConflictDoorLabel: (objectId: string) => string
  formError: string | null
  canSubmitOrder: boolean
  isSaving: boolean
  saveBlockedByDoorConflict: boolean
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

export function AuftragAnlegenOrderFormModal({
  onBackdropClick,
  formMode,
  formData,
  customers,
  bvs,
  showBvSelect,
  singleBv,
  showTuerTorSection,
  hasDoorsToPick,
  pickerObjects,
  showZuweisungSection,
  canAssign,
  profilesAssignable,
  onFormChange,
  onToggleObject,
  isRelease110Enabled,
  conflictCalloutRows,
  resolveConflictDoorLabel,
  formError,
  canSubmitOrder,
  isSaving,
  saveBlockedByDoorConflict,
  onSubmit,
  onCancel,
}: AuftragAnlegenOrderFormModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto overscroll-contain"
      style={{
        padding:
          'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))',
      }}
      onClick={onBackdropClick}
      onKeyDown={(e) => e.key === 'Escape' && onBackdropClick()}
      role="dialog"
      aria-modal
      aria-labelledby="auftrag-form-title"
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full min-w-0 my-auto max-h-[min(90vh,90dvh)] overflow-y-auto p-6 border border-slate-200 dark:border-slate-600"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="auftrag-form-title" className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
          {formMode === 'edit' ? 'Auftrag bearbeiten' : 'Neuer Auftrag'}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="order-customer" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Kunde *
            </label>
            <select
              id="order-customer"
              value={formData.customer_id}
              onChange={(e) => onFormChange('customer_id', e.target.value)}
              className={orderFormControl}
              required
            >
              <option value="">— Auswählen —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {formData.customer_id && (
            <>
              {bvs.length === 0 && (
                <p
                  className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2"
                  role="status"
                >
                  Kein Objekt/BV – Türen/Tore direkt unter dem Kunden (falls vorhanden) können gewählt werden.
                </p>
              )}
              {showBvSelect && (
                <div>
                  <label htmlFor="order-bv" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Objekt/BV *
                  </label>
                  <select
                    id="order-bv"
                    value={formData.bv_id}
                    onChange={(e) => onFormChange('bv_id', e.target.value)}
                    className={orderFormControl}
                    required
                    aria-label="Objekt/BV auswählen"
                  >
                    <option value="">— Auswählen —</option>
                    {bvs.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {singleBv && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium">Objekt/BV:</span> {singleBv.name}
                </p>
              )}
            </>
          )}
          {showTuerTorSection && (
            <fieldset className="space-y-2 min-w-0 border-0 p-0 m-0">
              <legend className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                Tür/Tor (Mehrfachauswahl)
              </legend>
              {hasDoorsToPick ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Mindestens eine Tür/Tor wählen, damit die Zuweisung und das Speichern möglich sind.
                </p>
              ) : null}
              {formData.order_type !== 'wartung' && formData.selectedObjectIds.length > 1 ? (
                <p
                  className="text-xs text-slate-600 dark:text-slate-400 border-l-2 border-amber-400 pl-2 py-1 mb-2"
                  role="note"
                >
                  Hinweis: Bei Auftragstypen außer „Wartung“ dient die Mehrfachauswahl der Zuordnung mehrerer Türen zu{' '}
                  <span className="font-medium">einem</span> Termin; der Monteurbericht wird nicht wie bei der Wartung
                  automatisch türweise in getrennte Prüfprotokolle aufgeteilt.
                </p>
              ) : null}
              {formData.order_type === 'wartung' && formData.selectedObjectIds.length > 1 ? (
                <p
                  className="text-xs text-slate-600 dark:text-slate-400 border-l-2 border-slate-300 dark:border-slate-600 pl-2 py-1 mb-2"
                  role="note"
                >
                  Bei „Wartung“ wird im Auftrag für <span className="font-medium">jede</span> gewählte Tür eine
                  Prüf-Checkliste erwartet; Ausnahmen beim Abschluss werden im erledigten Auftrag dokumentiert.
                </p>
              ) : null}
              {pickerObjects.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Keine Türen/Tore für diese Auswahl.</p>
              ) : (
                <ul
                  className="max-h-44 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-600 divide-y divide-slate-200 dark:divide-slate-600"
                  aria-label="Türen und Tore auswählen"
                >
                  {pickerObjects.map((obj) => {
                    const checked = formData.selectedObjectIds.includes(obj.id)
                    return (
                      <li key={obj.id}>
                        <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleObject(obj.id)}
                            className="rounded border-slate-300 dark:border-slate-600"
                            aria-checked={checked}
                          />
                          <span className="text-sm text-slate-800 dark:text-slate-100">{getObjectDisplayName(obj)}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </fieldset>
          )}
          {showZuweisungSection && canAssign && (
            <div>
              <label htmlFor="order-assign" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                Zugewiesen an
              </label>
              <select
                id="order-assign"
                value={formData.assigned_to}
                onChange={(e) => onFormChange('assigned_to', e.target.value)}
                className={orderFormControl}
                aria-label="Nutzer zuweisen"
              >
                <option value="">— Keine Zuweisung —</option>
                {profilesAssignable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getProfileDisplayName(p)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="order-date" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Datum *
            </label>
            <input
              id="order-date"
              type="date"
              value={formData.order_date}
              onChange={(e) => onFormChange('order_date', e.target.value)}
              className={orderFormControl}
              required
            />
          </div>
          <div>
            <label htmlFor="order-time" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Uhrzeit (optional)
            </label>
            <input
              id="order-time"
              type="time"
              value={formData.order_time}
              onChange={(e) => onFormChange('order_time', e.target.value)}
              className={orderFormControl}
              aria-label="Uhrzeit optional"
            />
          </div>
          <div>
            <label htmlFor="order-type" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Art
            </label>
            <select
              id="order-type"
              value={formData.order_type}
              onChange={(e) => onFormChange('order_type', e.target.value as OrderType)}
              className={orderFormControl}
            >
              {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((t) => (
                <option key={t} value={t}>
                  {ORDER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {formMode === 'edit' && (
            <div>
              <label htmlFor="order-status" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                Status
              </label>
              <select
                id="order-status"
                value={formData.status}
                onChange={(e) => onFormChange('status', e.target.value as OrderStatus)}
                className={orderFormControl}
              >
                {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="order-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Beschreibung
            </label>
            <textarea
              id="order-desc"
              value={formData.description}
              onChange={(e) => onFormChange('description', e.target.value)}
              rows={3}
              className={orderFormTextarea}
              placeholder="Auftragsdetails…"
            />
          </div>
          {isRelease110Enabled && conflictCalloutRows.length > 0 ? (
            <div className="pt-1">
              <OrderActiveConflictCallout conflicts={conflictCalloutRows} resolveDoorLabel={resolveConflictDoorLabel} />
            </div>
          ) : null}
          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {formError}
            </p>
          )}
          <div className="flex flex-nowrap gap-2 pt-2 items-stretch">
            <button
              type="submit"
              disabled={!canSubmitOrder || isSaving || saveBlockedByDoorConflict}
              className={`flex-1 min-w-0 shrink ${orderPagePrimaryCta} bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 disabled:opacity-50 border border-slate-300 dark:border-slate-600`}
            >
              {isSaving ? 'Wird gespeichert…' : formMode === 'edit' ? 'Speichern' : 'Anlegen'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={`${orderFormFooterBtn} shrink-0 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700`}
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
