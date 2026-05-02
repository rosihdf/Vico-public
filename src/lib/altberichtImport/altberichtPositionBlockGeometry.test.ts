import { describe, expect, it } from 'vitest'

import {
  __testing,
  buildAltberichtPositionBlockBoxes,
  buildAltberichtPositionBlockBoxLookup,
} from './altberichtPositionBlockGeometry'

const { matchSequenceFromAnchor, collectAnchorYByPage } = __testing

describe('matchSequenceFromAnchor', () => {
  it('erkennt „Pos. 3"-Anker', () => {
    expect(matchSequenceFromAnchor('Pos. 3 Wohnzimmer')).toBe(3)
    expect(matchSequenceFromAnchor('pos 12')).toBe(12)
  })
  it('erkennt „Position 7"-Anker', () => {
    expect(matchSequenceFromAnchor('Position 7 Bad EG')).toBe(7)
  })
  it('erkennt „1. <Text>"-Anker', () => {
    expect(matchSequenceFromAnchor('1. Eingangstür')).toBe(1)
    expect(matchSequenceFromAnchor('25.    Schornstein')).toBe(25)
  })
  it('lehnt unsinnige/zu hohe Werte ab', () => {
    expect(matchSequenceFromAnchor('1234. zu hoch')).toBe(null)
    expect(matchSequenceFromAnchor('Pos.')).toBe(null)
    expect(matchSequenceFromAnchor('')).toBe(null)
  })
  it('reagiert nicht auf zufällige Zahlen mitten im Text', () => {
    expect(matchSequenceFromAnchor('Übersicht von 2 Wohnungen')).toBe(null)
  })
})

describe('collectAnchorYByPage / buildAltberichtPositionBlockBoxes', () => {
  it('liefert eine Box pro erkannter Sequenz, sortiert mit absteigendem y', () => {
    const pages = [
      {
        pageNumber: 1,
        pageWidth: 595,
        pageHeight: 842,
        items: [
          { text: 'Pos. 1 Eingang', baselineY: 800, height: 12 },
          { text: 'Bla bla', baselineY: 760, height: 10 },
          { text: 'Pos. 2 Bad', baselineY: 700, height: 12 },
          { text: 'Bla bla', baselineY: 650, height: 10 },
          { text: 'Pos. 3 WZ', baselineY: 600, height: 12 },
        ],
      },
    ]
    const anchors = collectAnchorYByPage(pages)
    expect(anchors).toEqual([
      { sequence: 1, pageNumber: 1, y: 800 },
      { sequence: 2, pageNumber: 1, y: 700 },
      { sequence: 3, pageNumber: 1, y: 600 },
    ])

    const boxes = buildAltberichtPositionBlockBoxes(pages)
    expect(boxes).toHaveLength(3)
    expect(boxes[0]).toMatchObject({ sequence: 1, pageNumber: 1 })
    expect(boxes[0].yTop).toBeGreaterThan(boxes[0].yBottom)
    /** Box-Übergang: yBottom von Pos.1 ≈ y(Pos.2) - 2 */
    expect(boxes[0].yBottom).toBeCloseTo(700 - 2, 0)
    /** Letzter Anker geht bis Seitenende. */
    expect(boxes[2].yBottom).toBe(0)
  })

  it('Anker auf der Folgeseite: yBottom = 0 für vorletzte Position der vorherigen Seite', () => {
    const pages = [
      {
        pageNumber: 1,
        pageWidth: 595,
        pageHeight: 842,
        items: [{ text: 'Pos. 1 Eingang', baselineY: 800, height: 12 }],
      },
      {
        pageNumber: 2,
        pageWidth: 595,
        pageHeight: 842,
        items: [{ text: 'Pos. 2 WC', baselineY: 780, height: 12 }],
      },
    ]
    const boxes = buildAltberichtPositionBlockBoxes(pages)
    expect(boxes).toHaveLength(2)
    /** Page-Wechsel: Pos. 1 endet am Seitenfuß (yBottom = 0). */
    expect(boxes[0]).toMatchObject({ sequence: 1, pageNumber: 1, yBottom: 0 })
    expect(boxes[1]).toMatchObject({ sequence: 2, pageNumber: 2, yBottom: 0 })
  })

  it('ignoriert Doppelvorkommen einer Sequenz (Tabellenkopf-Wiederholung)', () => {
    const pages = [
      {
        pageNumber: 1,
        pageWidth: 595,
        pageHeight: 842,
        items: [
          { text: 'Pos. 1 Header', baselineY: 800, height: 12 },
          { text: 'Pos. 1 (wiederholt)', baselineY: 760, height: 12 },
          { text: 'Pos. 2', baselineY: 700, height: 12 },
        ],
      },
    ]
    const boxes = buildAltberichtPositionBlockBoxes(pages)
    expect(boxes.map((b) => b.sequence)).toEqual([1, 2])
  })

  it('Lookup: bySequence ermöglicht O(1)-Zugriff', () => {
    const pages = [
      {
        pageNumber: 1,
        pageWidth: 595,
        pageHeight: 842,
        items: [
          { text: 'Pos. 5 Test', baselineY: 800, height: 12 },
          { text: 'Pos. 8 Anderes', baselineY: 600, height: 12 },
        ],
      },
    ]
    const boxes = buildAltberichtPositionBlockBoxes(pages)
    const lookup = buildAltberichtPositionBlockBoxLookup(boxes)
    expect(lookup.bySequence.get(5)?.pageNumber).toBe(1)
    expect(lookup.bySequence.get(8)?.pageNumber).toBe(1)
    expect(lookup.bySequence.get(99)).toBeUndefined()
  })

  it('liefert leeres Array, wenn keine Anker erkannt werden', () => {
    const pages = [
      {
        pageNumber: 1,
        pageWidth: 595,
        pageHeight: 842,
        items: [{ text: 'Übersicht', baselineY: 800, height: 12 }],
      },
    ]
    expect(buildAltberichtPositionBlockBoxes(pages)).toEqual([])
  })
})
