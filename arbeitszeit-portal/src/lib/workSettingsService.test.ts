import { describe, it, expect } from 'vitest'
import { BUNDESLAENDER, getWeekdayLabel } from './workSettingsService'

describe('workSettingsService', () => {
  it('BUNDESLAENDER enthält 16 Bundesländer', () => {
    expect(BUNDESLAENDER).toHaveLength(16)
    const codes = new Set(BUNDESLAENDER.map((b) => b.code))
    expect(codes).toContain('BE')
    expect(codes).toContain('BY')
  })

  it('getWeekdayLabel liefert Kurzbezeichnungen 0–6', () => {
    expect(getWeekdayLabel(0)).toBe('So')
    expect(getWeekdayLabel(1)).toBe('Mo')
    expect(getWeekdayLabel(6)).toBe('Sa')
  })

  it('getWeekdayLabel fällt für unbekannte Werte auf String zurück', () => {
    expect(getWeekdayLabel(99)).toBe('99')
  })
})
