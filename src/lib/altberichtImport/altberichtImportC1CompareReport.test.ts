import { describe, expect, it } from 'vitest'
import { buildC1PositionCompare, summarizeC1PositionCompare } from './altberichtImportC1CompareReport'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'

const baseRow = (): AltberichtImportStagingObjectRow => ({
  id: 'st-1',
  job_id: 'j1',
  file_id: 'f1',
  sequence: 3,
  status: 'ready',
  customer_text: null,
  site_text: null,
  bv_id: 'bv1',
  object_name: 'Pos. 3',
  object_type_text: 'Tür',
  floor_text: 'EG',
  room_text: 'Flur',
  location_rule: 'room',
  findings_json: [{ text: 'Reiß', confidence: 0.5 }],
  catalog_candidates_json: [
    { field: 'fluegel', raw: '2' },
    { field: 'hersteller', raw: 'Hörmann' },
    { field: 'schliessmittel_typ', raw: 'TS89' },
  ],
  media_hints_json: null,
  parser_confidence_json: null,
  source_refs_json: null,
  analysis_trace_json: null,
  review_status: 'ready',
  review_customer_id: null,
  review_bv_id: 'bv1',
  review_object_id: null,
  review_object_name: 'Eingang',
  review_object_type_text: 'Tür',
  review_floor_text: 'EG',
  review_room_text: 'Flur',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

describe('buildC1PositionCompare', () => {
  it('notYetImported: Vergleichs-Status n/v, kein Produktiv', () => {
    const r = buildC1PositionCompare(baseRow(), null)
    expect(r.notYetImported).toBe(true)
    expect(r.fields[0]!.statusLabel).toBe('n/v')
    const sm = summarizeC1PositionCompare(r)
    expect(sm.tone).toBe('neutral')
    expect(sm.headline).toMatch(/C1-Übernahme/)
    expect(sm.subline).toMatch(/Reparse|erneut committen/i)
  })

  it('abgleich mit Produktivobjekt', () => {
    const row = { ...baseRow(), committed_object_id: '00000000-0000-4000-8000-0000000000aa' as const }
    const obj = {
      id: '00000000-0000-4000-8000-0000000000aa',
      bv_id: 'bv1',
      customer_id: 'c1',
      name: 'Eingang',
      internal_id: 'OBJ-TEST',
      door_position: null,
      internal_door_number: null,
      floor: 'EG',
      room: 'Flur',
      type_tuer: true,
      type_sektionaltor: false,
      type_schiebetor: false,
      type_freitext: null,
      wing_count: 2,
      anforderung: null,
      manufacturer: 'Hörmann',
      build_year: null,
      lock_manufacturer: null,
      lock_type: 'TS89',
      has_hold_open: false,
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
    }
    const r = buildC1PositionCompare({ ...row, committed_object_id: row.committed_object_id }, obj as any)
    expect(r.notYetImported).toBe(false)
    const nameField = r.fields.find((f) => f.label === 'Objektname')
    expect(nameField?.status).toBe('match')
  })
})
