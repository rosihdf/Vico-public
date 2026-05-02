import { describe, expect, it } from 'vitest'
import {
  __testBuildInkRowsStrip,
  __testHorizontalInkSpansFromSegment,
  __testIsSuspectedRasterFragmentDrop,
  __testMergeAdjacentVerticalSegments,
  __testPositionsFallbackCropPasses,
  __testPositionsFallbackCropPassesReview,
  __testSegmentsFromStripInkRows,
  __testShouldRejectRasterStripCrop,
  computeNonWhiteBoundingBoxInRect,
  refineRasterStripSegmentCrop,
} from './altberichtRasterBlockPhotoScan'

const fillRect = (
  data: Uint8ClampedArray,
  w: number,
  y0: number,
  y1: number,
  ink: boolean
): void => {
  const v = ink ? 0 : 255
  for (let y = y0; y < y1; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const o = (y * w + x) * 4
      data[o] = v
      data[o + 1] = v
      data[o + 2] = v
      data[o + 3] = 255
    }
  }
}

describe('altberichtRasterBlockPhotoScan (Strip-Segmentierung)', () => {
  it('findet einen vertikalen Tintenblock als ein Segment', () => {
    const w = 40
    const h = 80
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    /** Bandhöhe ≥ MIN_VERT_SEG_PX nach aktuellem Raster (34px). */
    fillRect(data, w, 10, 53, true)

    const rows = __testBuildInkRowsStrip(data, w, h)
    const segs = __testSegmentsFromStripInkRows(rows)
    expect(segs.length).toBe(1)
    expect(segs[0]!.ys).toBeGreaterThanOrEqual(9)
    expect(segs[0]!.ye).toBeLessThanOrEqual(54)
    expect(segs[0]!.ye - segs[0]!.ys).toBeGreaterThanOrEqual(33)
  })

  it('führt benachbarte vertikale Segmente mit kleiner Lücke zusammen', () => {
    const merged = __testMergeAdjacentVerticalSegments(
      [
        { ys: 10, ye: 50 },
        { ys: 58, ye: 100 },
      ],
      120
    )
    expect(merged.length).toBe(1)
    expect(merged[0]!.ys).toBe(10)
    expect(merged[0]!.ye).toBe(100)
  })

  it('trennt vertikale Segmente bei großer Lücke', () => {
    const merged = __testMergeAdjacentVerticalSegments(
      [
        { ys: 10, ye: 30 },
        { ys: 60, ye: 100 },
      ],
      120
    )
    expect(merged.length).toBe(2)
  })

  it('verwirft Fragment-Crops (dünner Streifen / wenig Textur bei kleiner Fläche)', () => {
    const w = 80
    const h = 80
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    /** Fast weißes kleines Rechteck mit wenig Variation */
    for (let y = 10; y < 44; y += 1) {
      for (let x = 8; x < 42; x += 1) {
        const o = (y * w + x) * 4
        data[o] = 248
        data[o + 1] = 248
        data[o + 2] = 248
        data[o + 3] = 255
      }
    }
    expect(
      __testIsSuspectedRasterFragmentDrop(data, w, h, { x: 8, y: 10, w: 34, h: 34 }, 'weak')
    ).toBe(true)

    expect(
      __testIsSuspectedRasterFragmentDrop(data, w, h, { x: 0, y: 10, w: 72, h: 8 }, 'review')
    ).toBe(true)
  })

  it('liefert bei komplett weißem Streifen keine Segmente', () => {
    const w = 20
    const h = 40
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    const rows = __testBuildInkRowsStrip(data, w, h)
    const segs = __testSegmentsFromStripInkRows(rows)
    expect(segs.length).toBe(0)
  })

  it('trimmt Weißrand um dunkles Rechteck (Bounding Box)', () => {
    const w = 50
    const h = 60
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    /** Grau-Inhalt nur x 30–36, y 20–27 (überall sonst weiß 255) */
    for (let y = 20; y < 28; y += 1) {
      for (let x = 30; x < 37; x += 1) {
        const o = (y * w + x) * 4
        data[o] = 40
        data[o + 1] = 40
        data[o + 2] = 40
        data[o + 3] = 255
      }
    }
    const bb = computeNonWhiteBoundingBoxInRect(data, w, 0, 10, w, 45, 240)
    expect(bb).not.toBeNull()
    expect(bb!.minX).toBe(30)
    expect(bb!.maxX).toBe(36)
    expect(bb!.minY).toBe(20)
    expect(bb!.maxY).toBe(27)
  })

  const inkPxGray = (buff: Uint8ClampedArray, wp: number, xpix: number, ypix: number): void => {
    const o = (ypix * wp + xpix) * 4
    buff[o] = 30
    buff[o + 1] = 30
    buff[o + 2] = 30
    buff[o + 3] = 255
  }

  it('splittet horizontales Segment an einer breiten weißen Mittellücke', () => {
    const w = 130
    const h = 50
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    for (let y = 8; y < 43; y += 1) {
      for (let x = 6; x < 44; x += 1) inkPxGray(data, w, x, y)
      for (let x = 88; x < 126; x += 1) inkPxGray(data, w, x, y)
    }
    const spans = __testHorizontalInkSpansFromSegment(data, w, { ys: 0, ye: h })
    expect(spans.length).toBe(2)
    expect(spans[0]!.xbIncl).toBeLessThan(70)
    expect(spans[1]!.xa).toBeGreaterThan(72)
  })

  it('verwirft schmale Höhe unter Mindestphoto (auch Tabellen-/Linienbereiche)', () => {
    const w = 340
    const h = 16
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, true)
    expect(__testShouldRejectRasterStripCrop(data, w, h, 0, 0, w, h)).toBe(true)
  })

  it('verwirft flachen breiten Status-/Textstreifen (Seitenverhältnis)', () => {
    const w = 300
    const h = 72
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    /** Zeile dunkler Text ohne dominantes Rot — dennoch flach wie Statuszeilen. */
    for (let yy = 20; yy < 54; yy += 1)
      for (let x = 4; x < w - 4; x += 1)
        inkPxGray(data, w, x, yy)
    expect(__testShouldRejectRasterStripCrop(data, w, h, 0, 0, w, h)).toBe(true)
  })

  it('verwirft dominanter roter PDF-„Mängelfarbe"-Block', () => {
    const w = 260
    const h = 78
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    const setRed = (xx: number, yy: number): void => {
      const o = (yy * w + xx) * 4
      data[o] = 230
      data[o + 1] = 60
      data[o + 2] = 55
      data[o + 3] = 255
    }
    for (let yy = 4; yy < h - 4; yy += 1)
      for (let x = 14; x < w - 14; x += 1)
        setRed(x, yy)
    expect(__testShouldRejectRasterStripCrop(data, w, h, 0, 0, w, h)).toBe(true)
  })

  it('verwirft großes Bild mit dominant rotem Kopfband (PDF-Status über echtes Foto)', () => {
    const w = 220
    const h = 260
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    const setRed = (xx: number, yy: number): void => {
      const o = (yy * w + xx) * 4
      data[o] = 228
      data[o + 1] = 58
      data[o + 2] = 52
      data[o + 3] = 255
    }
    const hTop = Math.max(2, Math.floor(h * 0.2))
    for (let yy = 0; yy < hTop; yy += 1)
      for (let x = 4; x < w - 4; x += 1)
        setRed(x, yy)
    for (let yy = hTop; yy < h; yy += 1)
      for (let x = 0; x < w; x += 1) {
        const o = (yy * w + x) * 4
        const base = (((x >> 3) + (yy >> 4)) % 11) + 96
        data[o] = base
        data[o + 1] = Math.min(255, base + 20)
        data[o + 2] = Math.min(255, base + 14)
        data[o + 3] = 255
      }
    expect(__testShouldRejectRasterStripCrop(data, w, h, 0, 0, w, h)).toBe(true)
  })

  it('akzeptiert schmales Hochformat (Tür) ohne altes symmetrisches h/w-4:1-Ausschluss', () => {
    const w = 55
    const h = 300
    const data = new Uint8ClampedArray(w * h * 4)
    for (let yy = 0; yy < h; yy += 1)
      for (let x = 0; x < w; x += 1) {
        const o = (yy * w + x) * 4
        const base = (((x >> 2) + (yy >> 4)) % 9) + 88
        data[o] = base
        data[o + 1] = Math.min(255, base + 14)
        data[o + 2] = Math.min(255, base + 10)
        data[o + 3] = 255
      }
    expect(__testShouldRejectRasterStripCrop(data, w, h, 0, 0, w, h)).toBe(false)
  })

  it('akzeptiert grau-schwarzes Raster-Foto ohne Rot-Dominanz', () => {
    const w = 248
    const h = 290
    const data = new Uint8ClampedArray(w * h * 4)
    for (let yy = 0; yy < h; yy += 1)
      for (let x = 0; x < w; x += 1) {
        const o = (yy * w + x) * 4
        const base = (((x >> 3) + (yy >> 4)) % 11) + 96
        data[o] = base
        data[o + 1] = Math.min(255, base + 20)
        data[o + 2] = Math.min(255, base + 14)
        data[o + 3] = 255
      }
    expect(__testShouldRejectRasterStripCrop(data, w, h, 0, 0, w, h)).toBe(false)
  })

  it('refineRasterStripSegmentCrop entfernt weiße Ränder im Segment', () => {
    const w = 40
    const h = 48
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    /** Genug Fläche, damit Refine-Schwellen greifen (nicht nur Fallback x=0). */
    for (let y = 10; y < 38; y += 1) {
      for (let x = 5; x < 34; x += 1) {
        const o = (y * w + x) * 4
        data[o] = 20
        data[o + 1] = 20
        data[o + 2] = 20
        data[o + 3] = 255
      }
    }
    const r = refineRasterStripSegmentCrop(data, w, h, { ys: 8, ye: 41 }, { minContentFill: 0.4 })
    expect(r.x).toBeGreaterThan(0)
    expect(r.y).toBeGreaterThanOrEqual(8)
    expect(r.w).toBeLessThan(w)
    expect(r.h).toBeLessThan(33)
  })
})

describe('positionsFallbackCropPasses (Positions-Anker-Gate)', () => {
  const fillGrayRect = (
    data: Uint8ClampedArray,
    w: number,
    x0: number,
    y0: number,
    rw: number,
    rh: number,
    v: number
  ): void => {
    for (let y = y0; y < y0 + rh; y += 1) {
      for (let x = x0; x < x0 + rw; x += 1) {
        const o = (y * w + x) * 4
        data[o] = v
        data[o + 1] = v
        data[o + 2] = v
        data[o + 3] = 255
      }
    }
  }

  it('lehnt fast die gesamte Innenflaeche fuellenden Platten-Crop ab', () => {
    const w = 120
    const h = 100
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    const innerYs = 10
    const innerYeExcl = 90
    /** Großes graues Rechteck ~Suchfenster — hoher Cover-Anteil. */
    fillGrayRect(data, w, 4, innerYs + 2, w - 8, innerYeExcl - innerYs - 4, 55)
    const ix = 4
    const iy = innerYs + 2
    const iw = w - 8
    const ih = innerYeExcl - innerYs - 4
    expect(
      __testPositionsFallbackCropPasses(data, w, h, 0, w - 1, innerYs, innerYeExcl, ix, iy, iw, ih)
    ).toBe(false)
  })

  it('akzeptiert kompakten grauen Bildanker im Inner-Band', () => {
    const w = 120
    const h = 100
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    const innerYs = 10
    const innerYeExcl = 90
    fillGrayRect(data, w, 38, 34, 44, 52, 48)
    expect(
      __testPositionsFallbackCropPasses(data, w, h, 0, w - 1, innerYs, innerYeExcl, 38, 34, 44, 52)
    ).toBe(true)
  })

  it('Positions-Review-Gate akzeptiert etwas größere Cover-Fläche bei mittlerer Textur', () => {
    const w = 140
    const h = 100
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, h, false)
    const innerYs = 8
    const innerYeExcl = 92
    for (let y = innerYs + 4; y < innerYeExcl - 4; y += 1) {
      for (let x = 18; x < 118; x += 1) {
        const v = 55 + ((x * 7 + y * 11) % 52)
        fillGrayRect(data, w, x, y, 1, 1, v)
      }
    }
    const ix = 18
    const iy = innerYs + 6
    const iw = 96
    const ih = innerYeExcl - iy - 10
    expect(
      __testPositionsFallbackCropPassesReview(data, w, h, 0, w - 1, innerYs, innerYeExcl, ix, iy, iw, ih)
    ).toBe(true)
  })
})
