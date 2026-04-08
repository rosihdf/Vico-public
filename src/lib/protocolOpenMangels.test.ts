import { describe, expect, it } from 'vitest'
import {
  buildAuthoritativeChecklistSnapshotsByObjectId,
  buildDraftChecklistSnapshotForObjectId,
  extractDoorMangelRowsFromPerObject,
  extractFeststellMangelRowsFromFeststellBlock,
  protocolMangelBadgeMapsFromRowsAndObjects,
  protocolOpenMangelRowsForObjectFromSnapshot,
  protocolOpenMangelRowsFromSnapshots,
} from './protocolOpenMangels'
import type { WartungChecklistPerObject } from '../types/orderCompletionExtra'

describe('buildAuthoritativeChecklistSnapshotsByObjectId', () => {
  it('nutzt den neuesten erledigten Auftrag pro Tür', () => {
    const inputs = [
      {
        order: {
          id: 'old',
          object_id: 'door-1',
          object_ids: null,
          updated_at: '2025-01-01T10:00:00.000Z',
        },
        completion_extra: {
          v: 1,
          bericht_datum: '2025-01-01',
          monteur_name: 'x',
          primary: { start: '', end: '', pause_minuten: 0 },
          zusatz_monteure: [],
          material_lines: [],
          wartung_checkliste: {
            v: 1,
            by_object_id: {
              'door-1': {
                saved_at: '2025-01-01',
                checklist_modus: 'compact',
                items: { 'sec-tuerblatt-zarge': { status: 'mangel' as const, note: 'alt' } },
              },
            },
          },
        },
        completion_created_at: '2025-01-01T11:00:00.000Z',
      },
      {
        order: {
          id: 'new',
          object_id: 'door-1',
          object_ids: null,
          updated_at: '2025-06-01T10:00:00.000Z',
        },
        completion_extra: {
          v: 1,
          bericht_datum: '2025-06-01',
          monteur_name: 'x',
          primary: { start: '', end: '', pause_minuten: 0 },
          zusatz_monteure: [],
          material_lines: [],
          wartung_checkliste: {
            v: 1,
            by_object_id: {
              'door-1': {
                saved_at: '2025-06-01',
                checklist_modus: 'compact',
                items: { 'sec-tuerblatt-zarge': { status: 'ok' as const } },
              },
            },
          },
        },
        completion_created_at: '2025-06-01T11:00:00.000Z',
      },
    ]
    const snaps = buildAuthoritativeChecklistSnapshotsByObjectId(inputs)
    expect(snaps.get('door-1')?.order_id).toBe('new')
    expect(snaps.get('door-1')?.per.items['sec-tuerblatt-zarge']?.status).toBe('ok')
  })

  it('Bypass: incomplete_object_ids nutzt nicht diesen Abschluss — älterer Auftrag bleibt maßgeblich', () => {
    const inputs = [
      {
        order: {
          id: 'old',
          object_id: 'door-1',
          object_ids: null,
          updated_at: '2025-01-01T10:00:00.000Z',
        },
        completion_extra: {
          v: 1,
          bericht_datum: '2025-01-01',
          monteur_name: 'x',
          primary: { start: '', end: '', pause_minuten: 0 },
          zusatz_monteure: [],
          material_lines: [],
          wartung_checkliste: {
            v: 1,
            by_object_id: {
              'door-1': {
                saved_at: '2025-01-01',
                checklist_modus: 'compact',
                items: { 'sec-tuerblatt-zarge': { status: 'mangel' as const, note: 'alt' } },
              },
            },
          },
        },
        completion_created_at: '2025-01-01T11:00:00.000Z',
      },
      {
        order: {
          id: 'new',
          object_id: 'door-1',
          object_ids: null,
          updated_at: '2025-06-01T10:00:00.000Z',
        },
        completion_extra: {
          v: 1,
          bericht_datum: '2025-06-01',
          monteur_name: 'x',
          primary: { start: '', end: '', pause_minuten: 0 },
          zusatz_monteure: [],
          material_lines: [],
          wartung_checkliste_abschluss_bypass: {
            at: '2025-06-01T12:00:00.000Z',
            profile_id: null,
            incomplete_object_ids: ['door-1'],
          },
          wartung_checkliste: {
            v: 1,
            by_object_id: {
              'door-1': {
                saved_at: '2025-06-01',
                checklist_modus: 'compact',
                items: { 'sec-tuerblatt-zarge': { status: 'ok' as const } },
              },
            },
          },
        },
        completion_created_at: '2025-06-01T11:00:00.000Z',
      },
    ]
    const snaps = buildAuthoritativeChecklistSnapshotsByObjectId(inputs)
    expect(snaps.get('door-1')?.order_id).toBe('old')
    expect(snaps.get('door-1')?.per.items['sec-tuerblatt-zarge']?.status).toBe('mangel')
  })

  it('Bypass nur betroffene Türen: zweite Tür im gleichen Auftrag normal', () => {
    const inputs = [
      {
        order: {
          id: 'multi',
          object_id: null,
          object_ids: ['door-a', 'door-b'],
          updated_at: '2025-06-15T10:00:00.000Z',
        },
        completion_extra: {
          v: 1,
          bericht_datum: '2025-06-15',
          monteur_name: 'x',
          primary: { start: '', end: '', pause_minuten: 0 },
          zusatz_monteure: [],
          material_lines: [],
          wartung_checkliste_abschluss_bypass: {
            at: '2025-06-15T12:00:00.000Z',
            profile_id: null,
            incomplete_object_ids: ['door-a'],
          },
          wartung_checkliste: {
            v: 1,
            by_object_id: {
              'door-a': {
                saved_at: '2025-06-15',
                checklist_modus: 'compact',
                items: { 'sec-tuerblatt-zarge': { status: 'ok' as const } },
              },
              'door-b': {
                saved_at: '2025-06-15',
                checklist_modus: 'compact',
                items: { 'sec-schliessfunktion': { status: 'mangel' as const, note: 'b' } },
              },
            },
          },
        },
        completion_created_at: '2025-06-15T11:00:00.000Z',
      },
    ]
    const snaps = buildAuthoritativeChecklistSnapshotsByObjectId(inputs)
    expect(snaps.has('door-a')).toBe(false)
    expect(snaps.get('door-b')?.order_id).toBe('multi')
    expect(snaps.get('door-b')?.per.items['sec-schliessfunktion']?.status).toBe('mangel')
  })

  it('mehrere Türen am Auftrag: je Tür eigener Snapshot aus demselben Abschluss', () => {
    const inputs = [
      {
        order: {
          id: 'ord-x',
          object_id: null,
          object_ids: ['t1', 't2'],
          updated_at: '2025-03-01T10:00:00.000Z',
        },
        completion_extra: {
          v: 1,
          bericht_datum: '2025-03-01',
          monteur_name: 'x',
          primary: { start: '', end: '', pause_minuten: 0 },
          zusatz_monteure: [],
          material_lines: [],
          wartung_checkliste: {
            v: 1,
            by_object_id: {
              t1: {
                saved_at: '2025-03-01',
                checklist_modus: 'compact',
                items: { 'sec-tuerblatt-zarge': { status: 'ok' as const } },
              },
              t2: {
                saved_at: '2025-03-01',
                checklist_modus: 'compact',
                items: { 'sec-tuerblatt-zarge': { status: 'mangel' as const, note: 't2' } },
              },
            },
          },
        },
        completion_created_at: '2025-03-01T11:00:00.000Z',
      },
    ]
    const snaps = buildAuthoritativeChecklistSnapshotsByObjectId(inputs)
    expect(snaps.get('t1')?.order_id).toBe('ord-x')
    expect(snaps.get('t2')?.order_id).toBe('ord-x')
    expect(snaps.get('t2')?.per.items['sec-tuerblatt-zarge']?.status).toBe('mangel')
  })

  it('ignoriert Einträge ohne saved_at', () => {
    const inputs = [
      {
        order: {
          id: 'o1',
          object_id: 'door-x',
          object_ids: null,
          updated_at: '2025-01-05T10:00:00.000Z',
        },
        completion_extra: {
          v: 1,
          bericht_datum: '2025-01-05',
          monteur_name: 'x',
          primary: { start: '', end: '', pause_minuten: 0 },
          zusatz_monteure: [],
          material_lines: [],
          wartung_checkliste: {
            v: 1,
            by_object_id: {
              'door-x': {
                checklist_modus: 'compact',
                items: { 'sec-tuerblatt-zarge': { status: 'mangel' as const, note: 'n' } },
              },
            },
          },
        },
        completion_created_at: '2025-01-05T11:00:00.000Z',
      },
    ]
    const snaps = buildAuthoritativeChecklistSnapshotsByObjectId(inputs)
    expect(snaps.has('door-x')).toBe(false)
  })
})

describe('buildDraftChecklistSnapshotForObjectId', () => {
  const baseExtra = (doorNote: string) => ({
    v: 1,
    bericht_datum: '2025-01-01',
    monteur_name: 'x',
    primary: { start: '', end: '', pause_minuten: 0 },
    zusatz_monteure: [],
    material_lines: [],
    wartung_checkliste: {
      v: 1,
      by_object_id: {
        'door-1': {
          saved_at: '2025-01-01',
          checklist_modus: 'compact' as const,
          items: { 'sec-tuerblatt-zarge': { status: 'mangel' as const, note: doorNote } },
        },
      },
    },
  })

  it('wählt den neuesten laufenden Auftrag (updated_at) mit gespeicherter Checkliste', () => {
    const inputs = [
      {
        order: {
          id: 'old-open',
          object_id: 'door-1',
          object_ids: null,
          updated_at: '2025-01-01T10:00:00.000Z',
        },
        completion_extra: baseExtra('alt'),
        completion_created_at: '2025-01-01T11:00:00.000Z',
      },
      {
        order: {
          id: 'new-open',
          object_id: 'door-1',
          object_ids: null,
          updated_at: '2025-02-01T10:00:00.000Z',
        },
        completion_extra: baseExtra('neu'),
        completion_created_at: '2025-02-01T11:00:00.000Z',
      },
    ]
    const snap = buildDraftChecklistSnapshotForObjectId('door-1', inputs)
    expect(snap?.order_id).toBe('new-open')
    expect(snap?.per.items['sec-tuerblatt-zarge']?.note).toBe('neu')
  })

  it('wertet Bypass incomplete_object_ids nicht — Entwurf bleibt sichtbar', () => {
    const inputs = [
      {
        order: {
          id: 'open-1',
          object_id: 'door-1',
          object_ids: null,
          updated_at: '2025-03-01T10:00:00.000Z',
        },
        completion_extra: {
          ...baseExtra('bypass'),
          wartung_checkliste_abschluss_bypass: { incomplete_object_ids: ['door-1'] },
        },
        completion_created_at: '2025-03-01T11:00:00.000Z',
      },
    ]
    const snap = buildDraftChecklistSnapshotForObjectId('door-1', inputs)
    expect(snap?.order_id).toBe('open-1')
    const rows = protocolOpenMangelRowsForObjectFromSnapshot('door-1', snap)
    expect(rows.length).toBeGreaterThan(0)
  })
})

describe('protocolOpenMangelRowsFromSnapshots', () => {
  it('liefert Tür- und Feststell-Mängel getrennt', () => {
    const per: WartungChecklistPerObject = {
      saved_at: '2025-01-01',
      checklist_modus: 'compact',
      items: { 'sec-schliessfunktion': { status: 'mangel', note: 'klemmt' } },
      feststell_checkliste: {
        saved_at: '2025-01-01',
        checklist_modus: 'detail',
        items: { 'det-fst-en-1': { status: 'mangel', note: 'fehlt' } },
      },
    }
    const snaps = new Map([
      [
        'd1',
        { per, order_id: 'ord-1', established_on: '2025-01-01' },
      ],
    ])
    const rows = protocolOpenMangelRowsFromSnapshots(snaps)
    expect(rows.some((r) => r.source === 'tuer' && r.item_id === 'sec-schliessfunktion')).toBe(true)
    expect(rows.some((r) => r.source === 'feststell' && r.item_id === 'det-fst-en-1')).toBe(true)
  })
})

describe('extractDoorMangelRowsFromPerObject', () => {
  it('zählt nur Status mangel', () => {
    const per: WartungChecklistPerObject = {
      saved_at: 'x',
      checklist_modus: 'compact',
      items: {
        'sec-tuerblatt-zarge': { status: 'nicht_geprueft' },
        'sec-schliessfunktion': { status: 'mangel', note: 'x' },
      },
    }
    const rows = extractDoorMangelRowsFromPerObject(per, {
      object_id: 'o',
      order_id: 'q',
      established_on: '2025-02-02',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].item_id).toBe('sec-schliessfunktion')
  })
})

describe('extractFeststellMangelRowsFromFeststellBlock', () => {
  it('überspringt Melder-Intervall-Punkt', () => {
    const rows = extractFeststellMangelRowsFromFeststellBlock(
      {
        saved_at: 'x',
        checklist_modus: 'detail',
        items: {
          'det-fst-int-melder-austausch': { status: 'mangel' as const, note: 'soll nicht' },
          'det-fst-en-1': { status: 'mangel' as const, note: 'ja' },
        },
      },
      { object_id: 'o', order_id: 'q', established_on: '2025-02-02' }
    )
    expect(rows.every((r) => r.item_id !== 'det-fst-int-melder-austausch')).toBe(true)
    expect(rows.some((r) => r.item_id === 'det-fst-en-1')).toBe(true)
  })
})

describe('protocolMangelBadgeMapsFromRowsAndObjects', () => {
  it('aggregiert nach Kunde und BV-Schlüssel', () => {
    const maps = protocolMangelBadgeMapsFromRowsAndObjects(
      [
        {
          object_id: 'a',
          source: 'tuer',
          item_id: 'i1',
          label: 'L',
          section_title: 'S',
          note: null,
          order_id: 'o',
          established_on: '2025-01-01',
        },
        {
          object_id: 'a',
          source: 'tuer',
          item_id: 'i2',
          label: 'L2',
          section_title: 'S',
          note: null,
          order_id: 'o',
          established_on: '2025-01-01',
        },
      ],
      [{ id: 'a', customer_id: 'c1', bv_id: 'bv1' }]
    )
    expect(maps.totalByCustomerId.c1).toBe(2)
    expect(maps.byBvCompositeKey['c1::bv1']).toBe(2)
  })
})
