import { describe, expect, it } from 'vitest'
import type { Order } from '../types/order'
import type { Object as Obj } from '../types/object'
import type {
  WartungChecklistExtraV1,
  WartungChecklistItemState,
  WartungChecklistPerObject,
} from '../types/orderCompletionExtra'
import { getChecklistItemIdsForMode, type ChecklistDisplayMode } from './doorMaintenanceChecklistCatalog'
import {
  FESTSTELL_MELDER_INTERVAL_ITEM_ID,
  getFeststellChecklistItemIdsForMode,
  type FeststellChecklistItemState,
} from './feststellChecklistCatalog'
import { evaluateWartungChecklistGate } from './wartungChecklistGate'

const FST_INTERVAL_SECTION_ID = 'sec-fst-intervall'

const baseOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1',
  customer_id: 'cust-1',
  bv_id: null,
  related_order_id: null,
  object_id: 'door-a',
  object_ids: ['door-a'],
  order_date: '2026-04-01',
  order_time: null,
  order_type: 'wartung',
  status: 'in_bearbeitung',
  billing_status: null,
  description: null,
  assigned_to: null,
  created_by: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const mockObject = (id: string, has_hold_open: boolean): Obj => ({
  id,
  bv_id: null,
  customer_id: null,
  name: 'Tür',
  internal_id: null,
  door_position: null,
  internal_door_number: null,
  floor: null,
  room: null,
  type_tuer: true,
  type_sektionaltor: false,
  type_schiebetor: false,
  type_freitext: null,
  wing_count: null,
  anforderung: null,
  manufacturer: null,
  build_year: null,
  lock_manufacturer: null,
  lock_type: null,
  has_hold_open,
  hold_open_manufacturer: null,
  hold_open_type: null,
  hold_open_approval_no: null,
  hold_open_approval_date: null,
  smoke_detector_count: 0,
  smoke_detector_build_years: null,
  panic_function: null,
  accessories: null,
  maintenance_by_manufacturer: false,
  hold_open_maintenance: false,
  defects: null,
  remarks: null,
  created_at: '',
  updated_at: '',
})

const allOkDoorItems = (mode: ChecklistDisplayMode): Record<string, WartungChecklistItemState> => {
  const out: Record<string, WartungChecklistItemState> = {}
  for (const id of getChecklistItemIdsForMode(mode)) {
    out[id] = { status: 'ok' }
  }
  return out
}

/** Vollständige Feststell-Checkliste (inkl. Melder-Intervall) passend zum Modus. */
const allOkFeststellItems = (mode: ChecklistDisplayMode): Record<string, FeststellChecklistItemState> => {
  const out: Record<string, FeststellChecklistItemState> = {}
  const ids = getFeststellChecklistItemIdsForMode(mode)
  for (const id of ids) {
    if (mode === 'compact' && id === FST_INTERVAL_SECTION_ID) {
      out[FESTSTELL_MELDER_INTERVAL_ITEM_ID] = { melder_interval: 'ohne_5j' }
      continue
    }
    if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID) {
      out[id] = { melder_interval: 'ohne_5j' }
      continue
    }
    out[id] = { status: 'ok' }
  }
  return out
}

const completePerObject = (args: {
  mode: ChecklistDisplayMode
  withFeststell?: boolean
  festMode?: ChecklistDisplayMode
  pruefer?: { path: string | null; profileId: string | null }
}): WartungChecklistPerObject => {
  const fm = args.festMode ?? args.mode
  const pruefer = args.pruefer ?? { path: 'pruefer/sig.png', profileId: 'p1' }
  const per: WartungChecklistPerObject = {
    saved_at: '2026-04-01T10:00:00.000Z',
    checklist_modus: args.mode,
    items: allOkDoorItems(args.mode),
    pruefer_signature_path: pruefer.path,
    pruefer_profile_id: pruefer.profileId,
  }
  if (args.withFeststell) {
    per.feststell_checkliste = {
      saved_at: '2026-04-01T10:05:00.000Z',
      checklist_modus: fm,
      items: allOkFeststellItems(fm),
    }
  }
  return per
}

describe('evaluateWartungChecklistGate (Assistent / Abschluss-Gate)', () => {
  it('gibt ok für Nicht-Wartung', () => {
    const r = evaluateWartungChecklistGate(
      baseOrder({ order_type: 'reparatur', object_ids: ['door-a'] }),
      undefined,
      [mockObject('door-a', false)]
    )
    expect(r.ok).toBe(true)
  })

  it('gibt ok für Wartung ohne Objekte', () => {
    const r = evaluateWartungChecklistGate(
      baseOrder({ object_id: null, object_ids: [] }),
      undefined,
      []
    )
    expect(r.ok).toBe(true)
  })

  it('blockiert ohne Wartungscheckliste (kein by_object_id)', () => {
    const r = evaluateWartungChecklistGate(
      baseOrder({ object_ids: ['door-a', 'door-b'] }),
      undefined,
      [mockObject('door-a', false), mockObject('door-b', false)]
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toContain('jede Tür')
      expect(r.incompleteObjectIds.sort()).toEqual(['door-a', 'door-b'].sort())
    }
  })

  it('blockiert bei leerem by_object_id (keine Einträge pro Tür)', () => {
    const r = evaluateWartungChecklistGate(
      baseOrder({ object_ids: ['door-a'] }),
      { v: 1, by_object_id: {} },
      [mockObject('door-a', false)]
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('gespeicherte Checkliste')
  })

  it('blockiert ohne gespeicherte Checkliste (saved_at)', () => {
    const wc: WartungChecklistExtraV1 = {
      v: 1,
      by_object_id: {
        'door-a': {
          items: allOkDoorItems('compact'),
          pruefer_signature_path: 'x',
          pruefer_profile_id: 'p1',
        },
      },
    }
    const r = evaluateWartungChecklistGate(baseOrder(), wc, [mockObject('door-a', false)])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('gespeicherte Checkliste')
  })

  it('blockiert bei unvollständiger Tür-Checkliste (Detail)', () => {
    const items = allOkDoorItems('detail')
    delete items['det-tbz-1']
    const wc: WartungChecklistExtraV1 = {
      v: 1,
      by_object_id: {
        'door-a': {
          saved_at: '2026-04-01T10:00:00.000Z',
          checklist_modus: 'detail',
          items,
          pruefer_signature_path: 'x',
          pruefer_profile_id: 'p1',
        },
      },
    }
    const r = evaluateWartungChecklistGate(baseOrder(), wc, [mockObject('door-a', false)])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('Prüfpunkte')
  })

  it('blockiert bei Feststellanlage ohne gespeicherte Feststell-Checkliste', () => {
    const r = evaluateWartungChecklistGate(
      baseOrder(),
      {
        v: 1,
        by_object_id: {
          'door-a': completePerObject({ mode: 'compact', withFeststell: false }),
        },
      },
      [mockObject('door-a', true)]
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('Feststell')
  })

  it('blockiert bei Feststellanlage mit unvollständiger Feststell-Checkliste', () => {
    const per = completePerObject({ mode: 'compact', withFeststell: true })
    if (per.feststell_checkliste) {
      per.feststell_checkliste.items = { ...allOkFeststellItems('compact') }
      delete per.feststell_checkliste.items['sec-fst-energie']
    }
    const r = evaluateWartungChecklistGate(
      baseOrder(),
      { v: 1, by_object_id: { 'door-a': per } },
      [mockObject('door-a', true)]
    )
    expect(r.ok).toBe(false)
  })

  it('blockiert ohne Prüfer-Unterschrift (Pfad oder Profil)', () => {
    const r = evaluateWartungChecklistGate(
      baseOrder(),
      {
        v: 1,
        by_object_id: {
          'door-a': completePerObject({
            mode: 'detail',
            pruefer: { path: '  ', profileId: 'p1' },
          }),
        },
      },
      [mockObject('door-a', false)]
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('Prüfers')
  })

  it('erlaubt Abschluss: eine Tür, Kompakt, ohne Feststell', () => {
    const r = evaluateWartungChecklistGate(
      baseOrder(),
      { v: 1, by_object_id: { 'door-a': completePerObject({ mode: 'compact' }) } },
      [mockObject('door-a', false)]
    )
    expect(r.ok).toBe(true)
  })

  it('erlaubt Abschluss: zwei Türen vollständig (Detail)', () => {
    const wc: WartungChecklistExtraV1 = {
      v: 1,
      by_object_id: {
        'door-a': completePerObject({ mode: 'detail' }),
        'door-b': completePerObject({ mode: 'detail' }),
      },
    }
    const r = evaluateWartungChecklistGate(
      baseOrder({ object_ids: ['door-a', 'door-b'], object_id: 'door-a' }),
      wc,
      [mockObject('door-a', false), mockObject('door-b', false)]
    )
    expect(r.ok).toBe(true)
  })

  it('erlaubt Abschluss: Tür mit Feststellanlage, Kompakt + Feststell kompakt', () => {
    const r = evaluateWartungChecklistGate(
      baseOrder(),
      {
        v: 1,
        by_object_id: {
          'door-a': completePerObject({ mode: 'compact', withFeststell: true, festMode: 'compact' }),
        },
      },
      [mockObject('door-a', true)]
    )
    expect(r.ok).toBe(true)
  })
})
