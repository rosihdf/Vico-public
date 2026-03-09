import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

import { getProfileDisplayName, parseRole } from './userService'

describe('userService', () => {
  describe('getProfileDisplayName', () => {
    it('gibt Vor- und Nachname zurück', () => {
      expect(getProfileDisplayName({ first_name: 'Max', last_name: 'Muster' } as never)).toBe('Max Muster')
      expect(getProfileDisplayName({ first_name: 'Max', last_name: '' } as never)).toBe('Max')
    })

    it('gibt E-Mail zurück wenn kein Name', () => {
      expect(getProfileDisplayName({ email: 'user@example.com' } as never)).toBe('user@example.com')
    })

    it('gibt "(kein Name)" zurück bei leerem Profil', () => {
      expect(getProfileDisplayName({} as never)).toBe('(kein Name)')
      expect(getProfileDisplayName({ email: null, first_name: null, last_name: null } as never)).toBe('(kein Name)')
    })
  })

  describe('parseRole', () => {
    it('erkennt alle gültigen Rollen', () => {
      expect(parseRole('admin')).toBe('admin')
      expect(parseRole('mitarbeiter')).toBe('mitarbeiter')
      expect(parseRole('operator')).toBe('operator')
      expect(parseRole('leser')).toBe('leser')
      expect(parseRole('demo')).toBe('demo')
      expect(parseRole('kunde')).toBe('kunde')
    })

    it('gibt mitarbeiter zurück bei unbekannter Rolle', () => {
      expect(parseRole('unknown')).toBe('mitarbeiter')
      expect(parseRole('')).toBe('mitarbeiter')
      expect(parseRole('portal')).toBe('mitarbeiter')
    })
  })
})
