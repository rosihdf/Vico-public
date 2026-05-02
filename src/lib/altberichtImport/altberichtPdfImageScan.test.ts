import { describe, expect, it } from 'vitest'
import {
  collectEmbeddedImageDraftsFromFnArray,
  finalizeDraftsPerPage,
  classifyImagePaintOp,
  classifyEmbeddedImageLogoLikelihood,
  __testDeriveMetricsFromArgs,
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

describe('classifyEmbeddedImageLogoLikelihood', () => {
  it('klassifiziert wiederkehrende kleine Grafik als likely', () => {
    const r = classifyEmbeddedImageLogoLikelihood({
      width: 180,
      height: 48,
      pageWidth: 595,
      pageHeight: 842,
      fingerprintPageCount: 3,
    })
    expect(r.likelihood).toBe('likely')
    expect(r.reasons.length).toBeGreaterThan(0)
  })
  it('klassifiziert große einmalige Fläche als none', () => {
    const r = classifyEmbeddedImageLogoLikelihood({
      width: 1200,
      height: 900,
      pageWidth: 1200,
      pageHeight: 900,
      fingerprintPageCount: 1,
    })
    expect(r.likelihood).toBe('none')
  })
  it('klassifiziert breiten Streifen als likely', () => {
    const r = classifyEmbeddedImageLogoLikelihood({
      width: 320,
      height: 72,
      pageWidth: 595,
      pageHeight: 842,
      fingerprintPageCount: 1,
    })
    expect(r.likelihood).toBe('likely')
  })
})

describe('deriveMetricsFromArgs (args-first, kein objs.get nötig)', () => {
  it('liest paintImageXObject-Maße direkt aus args [objId, w, h]', () => {
    const r = __testDeriveMetricsFromArgs('paintImageXObject', ['img_42', 320, 240])
    expect(r).toEqual({ width: 320, height: 240, inlineImage: null, objId: 'img_42' })
  })
  it('liest paintImageXObjectRepeat-Maße direkt aus args', () => {
    const r = __testDeriveMetricsFromArgs('paintImageXObjectRepeat', ['img_7', 16, 16, []])
    expect(r.width).toBe(16)
    expect(r.height).toBe(16)
    expect(r.objId).toBe('img_7')
  })
  it('Inline-Image: liest width/height aus args[0] und liefert imgData mit', () => {
    const inline = { width: 64, height: 48, data: new Uint8Array(64 * 48 * 4) }
    const r = __testDeriveMetricsFromArgs('paintInlineImageXObject', [inline])
    expect(r.width).toBe(64)
    expect(r.height).toBe(48)
    expect(r.inlineImage).toBe(inline)
    expect(r.objId).toBeNull()
  })
  it('liefert leere Maße bei fehlenden args', () => {
    expect(__testDeriveMetricsFromArgs('paintImageXObject', undefined)).toEqual({
      width: 0,
      height: 0,
      inlineImage: null,
      objId: null,
    })
  })
  it('rundet kommazahlige Maße in args sauber', () => {
    const r = __testDeriveMetricsFromArgs('paintImageXObject', ['img_x', 199.6, 100.4])
    expect(r.width).toBe(200)
    expect(r.height).toBe(100)
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
