import { describe, expect, it } from 'vitest'
import { resolveStammdatenDefectEntryIdForC2Key } from './altberichtImportEmbeddedDefectResolve'
import type { Object as Obj } from '../../types/object'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'

const stagingBase: Partial<AltberichtImportStagingObjectRow> = {
  id: 's1',
  job_id: 'j',
  file_id: 'f',
  sequence: 1,
  status: 'draft',
  customer_text: null,
  site_text: null,
  bv_id: null,
  object_name: 'T1',
  object_type_text: 'T',
  floor_text: null,
  room_text: null,
  location_rule: 'unknown',
  findings_json: [],
  catalog_candidates_json: [],
  media_hints_json: [],
  parser_confidence_json: null,
  source_refs_json: null,
  analysis_trace_json: null,
  committed_object_id: 'obj-1',
  c2_defects_imported_keys: ['f:0'],
  created_at: '',
  updated_at: '',
}

describe('resolveStammdatenDefectEntryIdForC2Key', () => {
  it('löst bei importiertem Key und Textgleichheit', () => {
    const obj: Obj = {
      id: 'obj-1',
      name: 'T1',
    } as Obj
    const staging = {
      ...stagingBase,
      findings_json: [{ text: 'Kratzer' }],
      c2_defects_imported_keys: ['f:0'],
    } as AltberichtImportStagingObjectRow
    const object: Obj = {
      ...obj,
      defects_structured: [
        {
          id: 'de-1',
          text: 'Kratzer',
          status: 'open',
          created_at: '2020-01-01',
          resolved_at: null,
        },
      ],
    }
    const r = resolveStammdatenDefectEntryIdForC2Key(object, staging, 'f:0')
    expect(r).toEqual({ ok: true, defectEntryId: 'de-1' })
  })

  it('lehnt ab wenn f:0 nicht in C2-Import', () => {
    const object = { id: 'o', defects_structured: [] } as Obj
    const staging = {
      ...stagingBase,
      findings_json: [{ text: 'X' }],
      c2_defects_imported_keys: [] as string[],
    } as unknown as AltberichtImportStagingObjectRow
    const r = resolveStammdatenDefectEntryIdForC2Key(object, staging, 'f:0')
    expect(r.ok).toBe(false)
  })
})
