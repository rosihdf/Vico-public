import { describe, expect, it } from 'vitest'
import {
  collectEmbeddedImageDraftsFromFnArray,
  finalizeDraftsPerPage,
  classifyImagePaintOp,
} from './altberichtPdfImageScan'
import { suggestStagingObjectIdForPage } from './altberichtEmbeddedImageSuggest'

const mockOps = {
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
  paintImageMaskXObject: 87,
  paintInlineImageXObjectGroup: 88,
  paintImageMaskXObjectGroup: 89,
  paintImageXObjectRepeat: 90,
  paintImageMaskXObjectRepeat: 91,
  paintSolidColorImageMask: 92,
} as const

describe('classifyImagePaintOp', () => {
  it('erkennt paintImageXObject', () => {
    expect(classifyImagePaintOp(85, mockOps)).toBe('paintImageXObject')
  })
  it('ignoriert Text', () => {
    expect(classifyImagePaintOp(999, mockOps)).toBeNull()
  })
})

describe('collect + finalize (Seitenweise)', () => {
  it('zählt mehrere Seiten getrennt', () => {
    const a = [85, 85, 0, 0]
    const b = [86]
    const per = [collectEmbeddedImageDraftsFromFnArray(a, mockOps), collectEmbeddedImageDraftsFromFnArray(b, mockOps)]
    const all = finalizeDraftsPerPage(per)
    expect(all).toEqual([
      { pageNumber: 1, imageIndex: 0, opKind: 'paintImageXObject' },
      { pageNumber: 1, imageIndex: 1, opKind: 'paintImageXObject' },
      { pageNumber: 2, imageIndex: 0, opKind: 'paintInlineImageXObject' },
    ])
  })
})

describe('suggestStagingObjectIdForPage', () => {
  it('liefert erste Zeile (sequence) die die Seite in source_refs nennt', () => {
    const id = suggestStagingObjectIdForPage('f1', 3, [
      {
        id: 'a',
        file_id: 'f1',
        sequence: 1,
        source_refs_json: [],
        media_hints_json: [],
        findings_json: [],
      },
      {
        id: 'b',
        file_id: 'f1',
        sequence: 2,
        source_refs_json: [{ page: 2 }],
        media_hints_json: [],
        findings_json: [],
      },
      {
        id: 'c',
        file_id: 'f1',
        sequence: 3,
        source_refs_json: [{ page: 3 }],
        media_hints_json: [],
        findings_json: [],
      },
    ])
    expect(id).toBe('c')
  })
  it('gibt null wenn keine Seite', () => {
    expect(
      suggestStagingObjectIdForPage('f1', 9, [
        {
          id: 'a',
          file_id: 'f1',
          sequence: 1,
          source_refs_json: [],
          media_hints_json: [],
          findings_json: [],
        },
      ])
    ).toBeNull()
  })
})
