import { describe, expect, it } from 'vitest'
import { ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP } from './altberichtRasterGrid'
import type { AltberichtImportEmbeddedImageRow } from './altberichtImportTypes'
import { getAltberichtEmbeddedImageAssignmentConfidence } from './altberichtImportEmbeddedImageRowUi'

const stubImage = (
  partial: Partial<AltberichtImportEmbeddedImageRow>
): AltberichtImportEmbeddedImageRow => ({
  id: 'i1',
  job_id: 'j1',
  file_id: 'f1',
  page_number: 1,
  image_index: 1101,
  scan_version: 't',
  op_kind: ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP,
  suggested_staging_object_id: null,
  user_intent: 'unreviewed',
  linked_staging_object_id: null,
  preview_storage_path: null,
  created_at: '',
  updated_at: '',
  ...partial,
})

describe('getAltberichtEmbeddedImageAssignmentConfidence', () => {
  it('Raster-Zeile: Abgleich globalRowIndex ↔ Staging-Sequenz → Vorgeschlagen', () => {
    const im = stubImage({
      suggested_staging_object_id: 'andere-id',
      scan_meta_json: { globalRowIndex: 12 },
    })
    expect(getAltberichtEmbeddedImageAssignmentConfidence(im, 'row-a', 12)).toBe('suggested')
  })

  it('Raster-Zeile: Sequenz passt nicht → Möglicherweise passend', () => {
    const im = stubImage({
      suggested_staging_object_id: null,
      scan_meta_json: { globalRowIndex: 5 },
    })
    expect(getAltberichtEmbeddedImageAssignmentConfidence(im, 'row-a', 12)).toBe('page-fallback')
  })
})
