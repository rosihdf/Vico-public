import { describe, expect, it } from 'vitest'
import {
  buildC1NewObjectInsertForStaging,
  deriveC1ObjectTypeFields,
  getAltberichtCatalogFieldRaw,
  parseRauchmelderCountFromRaw,
  parseWingCountFromFluegelRaw,
} from './altberichtImportC1ObjectFields'

describe('getAltberichtCatalogFieldRaw', () => {
  it('liest erstes befülltes Vorkommen', () => {
    const cat = [
      { field: 'fluegel', raw: '  ', confidence: 0.5 },
      { field: 'fluegel', raw: '2', confidence: 0.5 },
    ]
    expect(getAltberichtCatalogFieldRaw(cat, 'fluegel')).toBe('2')
  })

  it('gibt null für fehlendes Array zurück', () => {
    expect(getAltberichtCatalogFieldRaw(null, 'hersteller')).toBeNull()
  })
})

describe('parseWingCountFromFluegelRaw', () => {
  it('erkennt Zahl 1-32', () => {
    expect(parseWingCountFromFluegelRaw('1')).toBe(1)
    expect(parseWingCountFromFluegelRaw('2 Flügel')).toBe(2)
  })
  it('gibt null für ungültig zurück', () => {
    expect(parseWingCountFromFluegelRaw('0')).toBeNull()
    expect(parseWingCountFromFluegelRaw('99')).toBeNull()
  })
})

describe('parseRauchmelderCountFromRaw', () => {
  it('mappt 0-30, sonst 0', () => {
    expect(parseRauchmelderCountFromRaw('3')).toBe(3)
    expect(parseRauchmelderCountFromRaw('0')).toBe(0)
    expect(parseRauchmelderCountFromRaw(null)).toBe(0)
  })
})

describe('deriveC1ObjectTypeFields', () => {
  it('reine Türe ohne doppelten Freitext', () => {
    const r = deriveC1ObjectTypeFields('Tür')
    expect(r.type_tuer).toBe(true)
    expect(r.type_freitext).toBeNull()
  })
  it('Glas in Freitext, Checkbox Türe', () => {
    const r = deriveC1ObjectTypeFields('Glas')
    expect(r.type_tuer).toBe(true)
    expect(r.type_freitext).toBe('Glas')
  })
})

describe('buildC1NewObjectInsertForStaging', () => {
  it('mappen Hersteller, Flügel, Schließmitteltyp aus Katalog', () => {
    const p = buildC1NewObjectInsertForStaging({
      bvId: null,
      customerId: 'c1',
      name: 'E 01/02',
      floor: 'EG',
      room: 'x',
      typeLabel: 'Tür',
      catalog: [
        { field: 'fluegel', raw: '1' },
        { field: 'hersteller', raw: 'Teckentrupp' },
        { field: 'schliessmittel_typ', raw: 'TS 89' },
        { field: 'anforderung', raw: 'T30' },
      ],
    })
    expect(p.wing_count).toBe(1)
    expect(p.manufacturer).toBe('Teckentrupp')
    expect(p.lock_type).toBe('TS 89')
    expect(p.anforderung).toBe('T30')
    expect(p.type_tuer).toBe(true)
    expect(p.type_freitext).toBeNull()
    expect(p.internal_id).toMatch(/^OBJ-[0-9A-Z]+$/)
  })

  it('übernimmt vorgeschlagene interne ID aus dem Staging, wenn gesetzt', () => {
    const p = buildC1NewObjectInsertForStaging({
      bvId: null,
      customerId: 'c1',
      name: 'X',
      floor: 'EG',
      room: 'y',
      typeLabel: 'Tür',
      catalog: [],
      proposedInternalId: '  OBJ-ALTB-FIX  ',
    })
    expect(p.internal_id).toBe('OBJ-ALTB-FIX')
  })

  it('mappen FSA → Feststellanlage (has_hold_open) und Felder aus Katalog', () => {
    const p = buildC1NewObjectInsertForStaging({
      bvId: null,
      customerId: 'c1',
      name: 'X',
      floor: 'EG',
      room: 'y',
      typeLabel: 'Tür',
      catalog: [
        { field: 'fsa_hersteller', raw: 'Geze' },
        { field: 'fsa_typ', raw: 'R ISM' },
        { field: 'rauchmelder', raw: '3' },
      ],
    })
    expect(p.has_hold_open).toBe(true)
    expect(p.hold_open_manufacturer).toBe('Geze')
    expect(p.hold_open_type).toBe('R ISM')
    expect(p.smoke_detector_count).toBe(3)
  })

  it('nur FSA-Typ reicht für Feststellanlage-Flag', () => {
    const p = buildC1NewObjectInsertForStaging({
      bvId: null,
      customerId: 'c1',
      name: 'X',
      floor: null,
      room: null,
      typeLabel: 'Tür',
      catalog: [{ field: 'fsa_typ', raw: 'R ISM' }],
    })
    expect(p.has_hold_open).toBe(true)
    expect(p.hold_open_type).toBe('R ISM')
    expect(p.hold_open_manufacturer).toBeNull()
    expect(p.smoke_detector_count).toBe(0)
  })
})
