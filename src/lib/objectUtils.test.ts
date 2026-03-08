import { describe, it, expect } from 'vitest'
import { getObjectDisplayName, formatObjectRoomFloor } from './objectUtils'

describe('getObjectDisplayName', () => {
  it('gibt name zurück wenn gesetzt', () => {
    expect(getObjectDisplayName({ name: 'Haupteingang' })).toBe('Haupteingang')
    expect(getObjectDisplayName({ name: 'Haupteingang', internal_id: 'T-001' })).toBe('Haupteingang')
  })

  it('gibt internal_id zurück wenn name leer', () => {
    expect(getObjectDisplayName({ internal_id: 'T-001' })).toBe('T-001')
    expect(getObjectDisplayName({ internal_id: 'T-001', room: 'Küche', floor: 'EG' })).toBe('T-001')
  })

  it('gibt room · floor · manufacturer zurück wenn weder name noch internal_id', () => {
    expect(getObjectDisplayName({ room: 'Küche', floor: 'EG', manufacturer: 'Geze' })).toBe(
      'Küche · EG · Geze'
    )
    expect(getObjectDisplayName({ room: 'Küche', floor: 'EG' })).toBe('Küche · EG')
    expect(getObjectDisplayName({ room: 'Küche' })).toBe('Küche')
    expect(getObjectDisplayName({ manufacturer: 'Geze' })).toBe('Geze')
  })

  it('gibt "–" zurück bei null/undefined/leerem Objekt', () => {
    expect(getObjectDisplayName(null)).toBe('–')
    expect(getObjectDisplayName(undefined)).toBe('–')
    expect(getObjectDisplayName({})).toBe('–')
  })

  it('ignoriert leeren name und internal_id', () => {
    expect(getObjectDisplayName({ name: '', internal_id: '', room: 'Küche' })).toBe('Küche')
    expect(getObjectDisplayName({ name: '   ', internal_id: '   ', room: 'Küche' })).toBe('Küche')
    expect(getObjectDisplayName({ internal_id: '', room: 'Küche' })).toBe('Küche')
  })
})

describe('formatObjectRoomFloor', () => {
  it('formatiert Raum und Etage mit Feldnamen', () => {
    expect(formatObjectRoomFloor({ room: '1', floor: 'EG' })).toBe('Raum: 1 · Etage: EG')
    expect(formatObjectRoomFloor({ room: 'Küche', floor: '2' })).toBe('Raum: Küche · Etage: 2')
  })

  it('gibt nur Raum oder nur Etage zurück', () => {
    expect(formatObjectRoomFloor({ room: '101' })).toBe('Raum: 101')
    expect(formatObjectRoomFloor({ floor: 'UG' })).toBe('Etage: UG')
  })

  it('gibt manufacturer zurück wenn weder room noch floor', () => {
    expect(formatObjectRoomFloor({ manufacturer: 'Geze' })).toBe('Geze')
  })

  it('gibt "–" zurück bei null/undefined/leerem Objekt', () => {
    expect(formatObjectRoomFloor(null)).toBe('–')
    expect(formatObjectRoomFloor(undefined)).toBe('–')
    expect(formatObjectRoomFloor({})).toBe('–')
  })
})
