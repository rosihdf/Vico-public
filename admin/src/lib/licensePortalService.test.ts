import { describe, it, expect } from 'vitest'
import { generateLicenseNumber } from './licensePortalService'

describe('generateLicenseNumber', () => {
  it('liefert VIC-XXXX-XXXX mit erlaubten Zeichen', () => {
    const n = generateLicenseNumber()
    expect(n).toMatch(/^VIC-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(n.split('-')).toHaveLength(3)
    expect(n.startsWith('VIC-')).toBe(true)
  })

  it('liefert bei mehreren Aufrufen gültiges Format', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateLicenseNumber()).toMatch(/^VIC-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    }
  })
})
