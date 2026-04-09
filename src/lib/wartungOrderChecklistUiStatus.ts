import type { ChecklistDisplayMode } from './doorMaintenanceChecklistCatalog'
import {
  countChecklistMangel,
  validateChecklistComplete,
} from './doorMaintenanceChecklistCatalog'
import type { FeststellChecklistItemState } from './feststellChecklistCatalog'
import {
  countFeststellMangel,
  validateFeststellChecklistComplete,
} from './feststellChecklistCatalog'
import type { WartungChecklistItemState } from '../types/orderCompletionExtra'

/** UI-Status pro Tür für Dropdown/Badge (Tür- + ggf. Feststell-Checkliste, ein gemeinsamer Stand). */
export type WartungChecklistObjectUiStatus =
  | { kind: 'offen' }
  | { kind: 'ok' }
  | { kind: 'mangel'; count: number }

/**
 * Aus aktueller Editor-Ansicht: vollständig & ohne dokumentierte Mängel → `ok`,
 * vollständig & mindestens ein Mangel → `mangel` inkl. Gesamtzahl (Tür + Feststellung).
 */
export const getWartungChecklistObjectUiStatus = (
  mode: ChecklistDisplayMode,
  doorItems: Record<string, WartungChecklistItemState>,
  festItems: Record<string, FeststellChecklistItemState> | null,
  hasHoldOpen: boolean
): WartungChecklistObjectUiStatus => {
  const doorVal = validateChecklistComplete(mode, doorItems)
  if (!doorVal.ok) return { kind: 'offen' }
  let mangel = countChecklistMangel(mode, doorItems)

  if (hasHoldOpen) {
    if (!festItems) return { kind: 'offen' }
    const fv = validateFeststellChecklistComplete(mode, festItems)
    if (!fv.ok) return { kind: 'offen' }
    mangel += countFeststellMangel(mode, festItems)
  }

  if (mangel === 0) return { kind: 'ok' }
  return { kind: 'mangel', count: mangel }
}
