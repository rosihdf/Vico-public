import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

vi.mock('./offlineStorage', () => ({
  getCachedTimeEntries: vi.fn(() => []),
  setCachedTimeEntries: vi.fn(),
  getTimeOutbox: vi.fn(() => []),
  addToTimeOutbox: vi.fn(),
  updateTimeOutboxItem: vi.fn(),
  addToOutbox: vi.fn(),
}))

vi.mock('../../shared/networkUtils', () => ({
  isOnline: vi.fn(() => true),
}))

vi.mock('./dataService', () => ({
  notifyDataChange: vi.fn(),
}))

import { getActiveEntry, getActiveBreak } from './timeService'
import type { TimeEntry, TimeBreak } from '../types'

describe('timeService', () => {
  describe('getActiveEntry', () => {
    it('gibt den Eintrag ohne end zurück', () => {
      const entries: TimeEntry[] = [
        { id: '1', user_id: 'u1', date: '2025-03-16', start: '08:00', end: '12:00', notes: null, order_id: null, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u1', date: '2025-03-16', start: '13:00', end: null, notes: null, order_id: null, created_at: '', updated_at: '' },
      ]
      expect(getActiveEntry(entries)?.id).toBe('2')
    })

    it('gibt null zurück wenn alle Einträge beendet sind', () => {
      const entries: TimeEntry[] = [
        { id: '1', user_id: 'u1', date: '2025-03-16', start: '08:00', end: '12:00', notes: null, order_id: null, created_at: '', updated_at: '' },
      ]
      expect(getActiveEntry(entries)).toBeNull()
    })

    it('gibt null zurück bei leerer Liste', () => {
      expect(getActiveEntry([])).toBeNull()
    })

    it('gibt den ersten aktiven Eintrag zurück wenn mehrere aktiv', () => {
      const entries: TimeEntry[] = [
        { id: '1', user_id: 'u1', date: '2025-03-16', start: '08:00', end: null, notes: null, order_id: null, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u1', date: '2025-03-16', start: '13:00', end: null, notes: null, order_id: null, created_at: '', updated_at: '' },
      ]
      expect(getActiveEntry(entries)?.id).toBe('1')
    })
  })

  describe('getActiveBreak', () => {
    it('gibt die Pause ohne end zurück', () => {
      const breaks: TimeBreak[] = [
        { id: 'b1', time_entry_id: 'e1', start: '10:00', end: '10:30', created_at: '' },
        { id: 'b2', time_entry_id: 'e1', start: '12:00', end: null, created_at: '' },
      ]
      const entry = {} as TimeEntry
      expect(getActiveBreak(entry, breaks)?.id).toBe('b2')
    })

    it('gibt null zurück wenn alle Pausen beendet sind', () => {
      const breaks: TimeBreak[] = [
        { id: 'b1', time_entry_id: 'e1', start: '10:00', end: '10:30', created_at: '' },
      ]
      const entry = {} as TimeEntry
      expect(getActiveBreak(entry, breaks)).toBeNull()
    })

    it('gibt null zurück bei leerer Liste', () => {
      const entry = {} as TimeEntry
      expect(getActiveBreak(entry, [])).toBeNull()
    })
  })
})
