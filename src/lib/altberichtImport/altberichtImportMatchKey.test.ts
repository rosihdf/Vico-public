import { describe, expect, it } from 'vitest'
import {
  buildAltberichtDuplicateCheckKeyForObject,
  buildAltberichtDuplicateCheckKeyFromStaging,
  buildImportMatchKeyFromParserObject,
  listAltberichtSoftDuplicateHints,
} from './altberichtImportMatchKey'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'

const minimalStagingRow = (
  extra: Partial<AltberichtImportStagingObjectRow>
): AltberichtImportStagingObjectRow => ({
  id: 's1',
  job_id: 'j1',
  file_id: 'f1',
  sequence: 1,
  status: 'ready',
  customer_text: 'K1',
  site_text: null,
  bv_id: 'bv1',
  object_name: 'A',
  object_type_text: 'Tür',
  floor_text: 'eg',
  room_text: '1',
  location_rule: 'room',
  findings_json: [],
  catalog_candidates_json: [
    { field: 'anforderung', raw: 'T30' },
    { field: 'hersteller', raw: 'ACME' },
  ],
  media_hints_json: [],
  parser_confidence_json: null,
  source_refs_json: null,
  analysis_trace_json: null,
  review_status: 'ready',
  review_customer_id: 'c1',
  review_bv_id: 'bv1',
  review_object_id: null,
  review_object_name: 'A',
  review_object_type_text: 'Tür',
  review_floor_text: 'EG',
  review_room_text: '1',
  created_at: '',
  updated_at: '',
  ...extra,
})

describe('buildImportMatchKeyFromParserObject', () => {
  it('ist stabil bei gleichen Parserdaten (inkl. Sequenz)', () => {
    const a = buildImportMatchKeyFromParserObject({
      sequence: 2,
      status: 'ready_for_review',
      objectName: 'E',
      objectTypeText: 'Tür',
      locationRule: 'room',
      findings: [],
      catalogCandidates: [
        { field: 'anforderung', raw: 'T30' },
        { field: 'hersteller', raw: 'X' },
      ],
      mediaHints: [],
      customerText: 'Acme',
      siteText: null,
      bvId: 'bv-1',
      floorText: 'EG',
      roomText: '101',
    })
    const b = buildImportMatchKeyFromParserObject({
      sequence: 2,
      status: 'ready_for_review',
      objectName: 'E',
      objectTypeText: 'Tür',
      locationRule: 'room',
      findings: [],
      catalogCandidates: [
        { field: 'anforderung', raw: 'T30' },
        { field: 'hersteller', raw: 'X' },
      ],
      mediaHints: [],
      customerText: 'Acme',
      siteText: null,
      bvId: 'bv-1',
      floorText: 'EG',
      roomText: '101',
    })
    expect(a).toBe(b)
    expect(a).toContain('mk1')
    expect(a).toContain('|2|')
  })
})

describe('Dubletten-Check-Keys', () => {
  it('Staging und Produktiv matchen bei gleichem fachlichem Inhalt', () => {
    const row = minimalStagingRow({})
    const k1 = buildAltberichtDuplicateCheckKeyFromStaging(row, 'c1')!
    const obj = {
      id: 'o1',
      bv_id: 'bv1',
      customer_id: 'c1',
      name: 'A',
      internal_id: 'OBJ-999',
      door_position: null,
      internal_door_number: null,
      floor: 'EG',
      room: '1',
      type_tuer: true,
      type_sektionaltor: false,
      type_schiebetor: false,
      type_freitext: null,
      wing_count: null,
      anforderung: 'T30',
      manufacturer: 'ACME',
      build_year: null,
      lock_manufacturer: null,
      lock_type: null,
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
    const k2 = buildAltberichtDuplicateCheckKeyForObject(obj, 'c1')
    expect(k1).toBe(k2)
  })
})

describe('listAltberichtSoftDuplicateHints', () => {
  it('liefert Treffer, wenn Fingerprint und Kunde passen (nicht blockierend)', () => {
    const row = minimalStagingRow({ review_object_id: null, committed_at: null })
    const o = {
      id: 'o-dup',
      bv_id: 'bv1',
      customer_id: 'c1',
      name: 'A',
      internal_id: 'OBJ-X',
      door_position: null,
      internal_door_number: null,
      floor: 'EG',
      room: '1',
      type_tuer: true,
      type_sektionaltor: false,
      type_schiebetor: false,
      type_freitext: null,
      wing_count: null,
      anforderung: 'T30',
      manufacturer: 'ACME',
      build_year: null,
      lock_manufacturer: null,
      lock_type: null,
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
    const hints = listAltberichtSoftDuplicateHints(
      row,
      [o],
      (x) => x.internal_id || x.id
    )
    expect(hints.length).toBe(1)
    expect(hints[0]!.id).toBe('o-dup')
  })

  it('keine Treffer, wenn kein Kunde (Review) gesetzt', () => {
    const row = minimalStagingRow({ review_customer_id: null })
    const hints = listAltberichtSoftDuplicateHints(row, [], () => 'x')
    expect(hints.length).toBe(0)
  })
})
