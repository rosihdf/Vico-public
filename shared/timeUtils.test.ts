import { describe, it, expect, vi, afterEach } from 'vitest'
import { getWeekBounds, getMonthBounds, calcWorkMinutes } from './timeUtils'

describe('timeUtils', () => {
  describe('getWeekBounds', () => {
    it('gibt Montag und Sonntag der Woche zurück', () => {
      // 2025-03-16 ist Sonntag → Woche 10.03–16.03
      expect(getWeekBounds('2025-03-16')).toEqual({ from: '2025-03-10', to: '2025-03-16' })
    })

    it('behandelt Montag korrekt', () => {
      // 2025-03-17 ist Montag → gleiche Woche
      expect(getWeekBounds('2025-03-17')).toEqual({ from: '2025-03-17', to: '2025-03-23' })
    })

    it('behandelt Mittwoch korrekt', () => {
      expect(getWeekBounds('2025-03-19')).toEqual({ from: '2025-03-17', to: '2025-03-23' })
    })

    it('behandelt Monatsübergang', () => {
      // 2025-03-31 ist Montag
      expect(getWeekBounds('2025-03-31')).toEqual({ from: '2025-03-31', to: '2025-04-06' })
    })
  })

  describe('getMonthBounds', () => {
    it('gibt ersten und letzten Tag des Monats zurück', () => {
      expect(getMonthBounds('2025-03-15')).toEqual({ from: '2025-03-01', to: '2025-03-31' })
    })

    it('behandelt Februar mit 28 Tagen', () => {
      expect(getMonthBounds('2025-02-15')).toEqual({ from: '2025-02-01', to: '2025-02-28' })
    })

    it('behandelt Schaltjahr Februar', () => {
      expect(getMonthBounds('2024-02-15')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    })

    it('behandelt Dezember', () => {
      expect(getMonthBounds('2025-12-31')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    })
  })

  describe('calcWorkMinutes', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('berechnet Minuten zwischen Start und Ende ohne Pausen', () => {
      const entry = {
        start: '2025-03-16T08:00:00.000Z',
        end: '2025-03-16T12:30:00.000Z',
      }
      expect(calcWorkMinutes(entry, [])).toBe(270)
    })

    it('zieht Pausen ab', () => {
      const entry = {
        start: '2025-03-16T08:00:00.000Z',
        end: '2025-03-16T12:30:00.000Z',
      }
      const breaks = [
        { start: '2025-03-16T10:00:00.000Z', end: '2025-03-16T10:30:00.000Z' },
      ]
      expect(calcWorkMinutes(entry, breaks)).toBe(240)
    })

    it('zieht mehrere Pausen ab', () => {
      const entry = {
        start: '2025-03-16T08:00:00.000Z',
        end: '2025-03-16T17:00:00.000Z',
      }
      const breaks = [
        { start: '2025-03-16T10:00:00.000Z', end: '2025-03-16T10:30:00.000Z' },
        { start: '2025-03-16T12:00:00.000Z', end: '2025-03-16T13:00:00.000Z' },
      ]
      // 9h = 540 min, minus 30 min, minus 60 min = 450 min
      expect(calcWorkMinutes(entry, breaks)).toBe(450)
    })

    it('behandelt laufenden Eintrag (end: null) mit aktueller Zeit', () => {
      const fixedNow = new Date('2025-03-16T10:00:00.000Z').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(fixedNow)

      const entry = {
        start: '2025-03-16T08:00:00.000Z',
        end: null,
      }
      expect(calcWorkMinutes(entry, [])).toBe(120)
    })

    it('behandelt laufende Pause (end: null) mit aktueller Zeit', () => {
      const fixedNow = new Date('2025-03-16T10:15:00.000Z').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(fixedNow)

      const entry = {
        start: '2025-03-16T08:00:00.000Z',
        end: '2025-03-16T12:00:00.000Z',
      }
      const breaks = [
        { start: '2025-03-16T10:00:00.000Z', end: null },
      ]
      // 4h = 240 min, Pause 15 min (10:00 bis 10:15) = 225 min
      expect(calcWorkMinutes(entry, breaks)).toBe(225)
    })

    it('gibt 0 zurück bei negativem Ergebnis', () => {
      const entry = {
        start: '2025-03-16T12:00:00.000Z',
        end: '2025-03-16T12:30:00.000Z',
      }
      const breaks = [
        { start: '2025-03-16T08:00:00.000Z', end: '2025-03-16T11:00:00.000Z' },
      ]
      expect(calcWorkMinutes(entry, breaks)).toBe(0)
    })

    it('rundet auf ganze Minuten ab', () => {
      const entry = {
        start: '2025-03-16T08:00:00.000Z',
        end: '2025-03-16T08:00:59.999Z',
      }
      expect(calcWorkMinutes(entry, [])).toBe(0)
    })

    it('rundet 59.9 Sekunden auf 0 Minuten ab', () => {
      const entry = {
        start: '2025-03-16T08:00:00.000Z',
        end: '2025-03-16T08:01:59.999Z',
      }
      expect(calcWorkMinutes(entry, [])).toBe(1)
    })
  })
})
