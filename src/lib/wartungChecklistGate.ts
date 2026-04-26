import { getOrderObjectIds } from './orderUtils'
import { validateChecklistComplete } from './doorMaintenanceChecklistCatalog'
import { validateFeststellChecklistComplete } from './feststellChecklistCatalog'
import type { Order } from '../types/order'
import type { Object as Obj } from '../types/object'
import type { WartungChecklistExtraV1 } from '../types/orderCompletionExtra'

export type WartungChecklistGateBad = {
  ok: false
  message: string
  incompleteObjectIds: string[]
}

export type WartungChecklistGateResult = { ok: true } | WartungChecklistGateBad

/** Prüfungsauftrag: alle am Auftrag hängenden Türen müssen für den Standard-Abschluss checklisten-fertig sein. */
export const evaluateWartungChecklistGate = (
  order: Order,
  wc: WartungChecklistExtraV1 | undefined,
  orderObjects: Obj[]
): WartungChecklistGateResult => {
  if (order.order_type !== 'wartung') return { ok: true }
  const oids = getOrderObjectIds(order).filter(Boolean)
  if (oids.length === 0) return { ok: true }
  if (!wc?.by_object_id) {
    return {
      ok: false,
      message: 'Bitte für jede Tür die Wartungscheckliste speichern.',
      incompleteObjectIds: oids,
    }
  }
  const incomplete: string[] = []
  let firstMessage: string | null = null
  for (const oid of oids) {
    const per = wc.by_object_id[oid]
    if (!per?.saved_at) {
      incomplete.push(oid)
      if (!firstMessage) firstMessage = 'Für mindestens eine Tür fehlt eine gespeicherte Checkliste.'
      continue
    }
    const mode = per.checklist_modus === 'compact' ? 'compact' : 'detail'
    const val = validateChecklistComplete(mode, per.items ?? {})
    if (!val.ok) {
      incomplete.push(oid)
      if (!firstMessage) firstMessage = val.message
      continue
    }
    const ob = orderObjects.find((x) => x.id === oid)
    if (ob?.has_hold_open) {
      const f = per.feststell_checkliste
      if (!f?.saved_at) {
        incomplete.push(oid)
        if (!firstMessage) {
          firstMessage =
            'Für mindestens eine Tür mit Feststellanlage fehlt eine gespeicherte Feststell-Checkliste.'
        }
        continue
      }
      const fm = f.checklist_modus === 'compact' ? 'compact' : 'detail'
      const fv = validateFeststellChecklistComplete(fm, f.items ?? {})
      if (!fv.ok) {
        incomplete.push(oid)
        if (!firstMessage) firstMessage = fv.message
        continue
      }
    }
    if (!per.pruefer_signature_path?.trim() || !per.pruefer_profile_id) {
      incomplete.push(oid)
      if (!firstMessage) {
        firstMessage = 'Für mindestens eine Tür fehlt die Pflicht-Unterschrift des Prüfers.'
      }
    }
  }
  if (incomplete.length === 0) return { ok: true }
  return {
    ok: false,
    message: firstMessage ?? 'Checkliste unvollständig.',
    incompleteObjectIds: [...new Set(incomplete)],
  }
}
