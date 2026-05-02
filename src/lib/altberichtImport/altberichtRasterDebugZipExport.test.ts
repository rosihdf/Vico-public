import { describe, expect, it } from 'vitest'

import { ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP } from './altberichtRasterGrid'
import type { AltberichtImportEmbeddedImageRow } from './altberichtImportTypes'
import {
  filterAltberichtRasterPhotosZipEligibleRows,
  isAltberichtRasterRawDebugZipRow,
} from './altberichtRasterDebugZipExport'

const baseRow = (): AltberichtImportEmbeddedImageRow => ({
  id: 'img-1',
  job_id: 'job-1',
  file_id: 'file-1',
  page_number: 1,
  image_index: 1,
  scan_version: '1',
  op_kind: ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP,
  suggested_staging_object_id: null,
  user_intent: 'unreviewed',
  linked_staging_object_id: null,
  preview_storage_path: null,
  created_at: 'x',
  updated_at: 'x',
})

const viewportMeta = () => ({
  photoAnalysis: 'viewport_crop_v2' as const,
  viewportScaleUsed: 1.2,
  cropViewportPx: { sx: 0, sy: 0, sw: 40, sh: 50 },
})

describe('altberichtRasterDebugZipExport filtering', () => {
  it('schließt block_raw_crop standardmäßig aus', () => {
    const im = {
      ...baseRow(),
      scan_meta_json: { ...viewportMeta(), rasterSource: 'block_raw_crop' },
    }
    expect(isAltberichtRasterRawDebugZipRow(im)).toBe(true)
    expect(filterAltberichtRasterPhotosZipEligibleRows([im]).length).toBe(0)
    expect(
      filterAltberichtRasterPhotosZipEligibleRows([im], { includeRawDebugCrops: true }).length
    ).toBe(1)
  })

  it('schließt block_raw_safety anhand subtype aus', () => {
    const im = {
      ...baseRow(),
      scan_meta_json: {
        ...viewportMeta(),
        subtype: 'block_raw_safety',
        rasterSource: 'segment',
      },
    }
    expect(isAltberichtRasterRawDebugZipRow(im)).toBe(true)
    expect(filterAltberichtRasterPhotosZipEligibleRows([im]).length).toBe(0)
    expect(
      filterAltberichtRasterPhotosZipEligibleRows([im], { includeRawDebugCrops: true }).length
    ).toBe(1)
  })

  it('schließt block_raw_safety anhand rasterSource aus', () => {
    const im = {
      ...baseRow(),
      scan_meta_json: {
        ...viewportMeta(),
        rasterSource: 'block_raw_safety',
        subtype: 'segment',
      },
    }
    expect(isAltberichtRasterRawDebugZipRow(im)).toBe(true)
    expect(filterAltberichtRasterPhotosZipEligibleRows([im]).length).toBe(0)
    expect(
      filterAltberichtRasterPhotosZipEligibleRows([im], { includeRawDebugCrops: true }).length
    ).toBe(1)
  })

  it('lässt normales block_crop/segment ohne Rohhinweis durch', () => {
    const im = {
      ...baseRow(),
      scan_meta_json: {
        ...viewportMeta(),
        subtype: 'segment',
        rasterSource: 'block_crop',
      },
    }
    expect(isAltberichtRasterRawDebugZipRow(im)).toBe(false)
    expect(filterAltberichtRasterPhotosZipEligibleRows([im]).length).toBe(1)
  })
})
