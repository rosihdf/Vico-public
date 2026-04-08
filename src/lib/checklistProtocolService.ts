import { supabase } from '../supabase'
import { mergeWartungChecklistState } from './wartungChecklistCatalog'
import { isFeststellMelderInterval, mergeFeststellChecklistState } from './feststellChecklistCatalog'
import type { OrderCompletion } from '../types/order'
import { parseOrderCompletionExtra } from '../types/orderCompletionExtra'

/** Flaches Objekt mit Boolean-Werten für checklist_protocol (JSON-serialisierbar). */
export type ChecklistProtocolFlat = Record<string, boolean>

const toJsonbObject = (obj: ChecklistProtocolFlat): Record<string, boolean> => {
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'boolean') out[k] = v
  }
  return out
}

/**
 * Normierte Tür-Checkliste aus maintenance_reports.checklist_state.
 */
export const doorChecklistFromReportPayload = (
  checklistState: Record<string, boolean> | null | undefined
): ChecklistProtocolFlat => toJsonbObject(mergeWartungChecklistState(checklistState ?? undefined))

/** JSON für `checklist_protocol.feststell_checklist` (Booleans + optional `melder_interval`). */
export type FeststellProtocolPatch = Record<string, boolean | string>

/**
 * Feststell-Block für RPC `upsert_checklist_protocol_replace` aus completion_extra (V1).
 */
export const feststellProtocolPayloadFromCompletionExtra = (
  completionExtra: OrderCompletion['completion_extra'],
  monteurNameFallback: string
): FeststellProtocolPatch => {
  const parsed = parseOrderCompletionExtra(completionExtra, monteurNameFallback)
  const base = mergeFeststellChecklistState(parsed.feststell_checklist)
  const out: FeststellProtocolPatch = { ...base }
  const melderRaw = parsed.feststell_melder_interval
  if (typeof melderRaw === 'string' && isFeststellMelderInterval(melderRaw)) {
    out.melder_interval = melderRaw
  }
  return out
}

/**
 * upsert_checklist_protocol_replace: genau ein Parent-UUID, null = Spalte nicht ändern.
 */
export const upsertChecklistProtocolReplace = async (args: {
  maintenanceReportId: string | null
  orderCompletionId: string | null
  doorPatch: ChecklistProtocolFlat | null
  feststellPatch: FeststellProtocolPatch | null
}): Promise<{ error: { message: string } | null }> => {
  const mr = args.maintenanceReportId
  const oc = args.orderCompletionId
  if ((mr == null && oc == null) || (mr != null && oc != null)) {
    return { error: { message: 'checklist_protocol: genau ein Parent erforderlich' } }
  }
  const { error } = await supabase.rpc('upsert_checklist_protocol_replace', {
    p_maintenance_report_id: mr,
    p_order_completion_id: oc,
    p_door: args.doorPatch,
    p_feststell: args.feststellPatch,
  })
  return { error: error ? { message: error.message } : null }
}
