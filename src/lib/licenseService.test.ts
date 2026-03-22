import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./offlineStorage', () => ({
  getCachedLicense: vi.fn(() => null),
  setCachedLicense: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

vi.mock('./licensePortalApi', () => ({
  getCachedLicenseResponse: vi.fn(() => null),
  getStoredLicenseNumber: vi.fn(() => null),
  isLicenseApiConfigured: vi.fn(() => false),
}))

import { supabase } from '../supabase'
import {
  getCachedLicenseResponse,
  getStoredLicenseNumber,
  isLicenseApiConfigured,
} from './licensePortalApi'
import {
  fetchLicenseStatus,
  checkCanCreateCustomer,
  checkCanInviteUser,
  hasFeature,
  isLimitReached,
  formatLicenseDate,
  mergeLicenseApiCacheIntoStatus,
} from './licenseService'

const baseLicenseStatus = {
  tier: 'professional',
  valid_until: null,
  max_customers: null,
  max_users: null,
  max_storage_mb: null as number | null,
  current_customers: 0,
  current_users: 0,
  features: {} as Record<string, boolean>,
  valid: true,
  expired: false,
  read_only: false,
}

describe('licenseService', () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset()
    vi.mocked(getCachedLicenseResponse).mockReturnValue(null)
    vi.mocked(getStoredLicenseNumber).mockReturnValue(null)
    vi.mocked(isLicenseApiConfigured).mockReturnValue(false)
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...(typeof navigator !== 'undefined' ? navigator : {}), onLine: true },
      writable: true,
      configurable: true,
    })
  })

  describe('fetchLicenseStatus', () => {
    it('gibt EMPTY_LICENSE zurück bei Fehler', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'Fehler' } } as never)
      const result = await fetchLicenseStatus()
      expect(result.tier).toBe('none')
      expect(result.valid).toBe(false)
      expect(result.expired).toBe(true)
    })

    it('gibt Daten zurück bei Erfolg', async () => {
      const mockData = {
        tier: 'professional',
        valid_until: '2026-12-31',
        max_customers: 50,
        max_users: 10,
        current_customers: 5,
        current_users: 2,
        features: { kundenportal: true },
        valid: true,
        expired: false,
        read_only: false,
      }
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: mockData, error: null } as never)
      const result = await fetchLicenseStatus()
      expect(result).toEqual(mockData)
    })
  })

  describe('checkCanCreateCustomer', () => {
    it('gibt true zurück bei Fehler (Fail-open)', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'Fehler' } } as never)
      const result = await checkCanCreateCustomer()
      expect(result).toBe(true)
    })

    it('gibt data zurück bei Erfolg', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: true, error: null } as never)
      expect(await checkCanCreateCustomer()).toBe(true)

      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: false, error: null } as never)
      expect(await checkCanCreateCustomer()).toBe(false)
    })
  })

  describe('checkCanInviteUser', () => {
    it('gibt true zurück bei Fehler (Fail-open)', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'Fehler' } } as never)
      const result = await checkCanInviteUser()
      expect(result).toBe(true)
    })

    it('gibt data zurück bei Erfolg', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: true, error: null } as never)
      expect(await checkCanInviteUser()).toBe(true)

      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: false, error: null } as never)
      expect(await checkCanInviteUser()).toBe(false)
    })
  })

  describe('hasFeature', () => {
    it('gibt true zurück wenn Feature aktiv', () => {
      expect(hasFeature({ features: { kundenportal: true } } as never, 'kundenportal')).toBe(true)
    })

    it('gibt false zurück wenn Feature inaktiv oder fehlt', () => {
      expect(hasFeature({ features: { kundenportal: false } } as never, 'kundenportal')).toBe(false)
      expect(hasFeature({ features: {} } as never, 'kundenportal')).toBe(false)
      expect(hasFeature({ features: null } as never, 'kundenportal')).toBe(false)
    })
  })

  describe('mergeLicenseApiCacheIntoStatus', () => {
    it('lässt Status unverändert wenn Lizenz-API nicht konfiguriert', () => {
      vi.mocked(isLicenseApiConfigured).mockReturnValue(false)
      const s = mergeLicenseApiCacheIntoStatus({ ...baseLicenseStatus })
      expect(s?.max_storage_mb).toBeNull()
    })

    it('übernimmt max_storage_mb aus dem API-Cache (gleiche Lizenznummer)', () => {
      vi.mocked(isLicenseApiConfigured).mockReturnValue(true)
      vi.mocked(getStoredLicenseNumber).mockReturnValue('LIC-TEST')
      vi.mocked(getCachedLicenseResponse).mockImplementation((num: string) =>
        num === 'LIC-TEST'
          ? ({ license: { max_storage_mb: 512 } } as never)
          : null,
      )
      const s = mergeLicenseApiCacheIntoStatus({ ...baseLicenseStatus, max_storage_mb: null })
      expect(s?.max_storage_mb).toBe(512)
    })

    it('rundet max_storage_mb aus dem Cache', () => {
      vi.mocked(isLicenseApiConfigured).mockReturnValue(true)
      vi.mocked(getStoredLicenseNumber).mockReturnValue('LIC-TEST')
      vi.mocked(getCachedLicenseResponse).mockReturnValue({
        license: { max_storage_mb: 100.6 },
      } as never)
      const s = mergeLicenseApiCacheIntoStatus({ ...baseLicenseStatus })
      expect(s?.max_storage_mb).toBe(101)
    })
  })

  describe('isLimitReached', () => {
    it('gibt false zurück wenn max null', () => {
      expect(isLimitReached(100, null)).toBe(false)
    })

    it('gibt true zurück wenn current >= max', () => {
      expect(isLimitReached(10, 10)).toBe(true)
      expect(isLimitReached(11, 10)).toBe(true)
    })

    it('gibt false zurück wenn current < max', () => {
      expect(isLimitReached(5, 10)).toBe(false)
    })
  })

  describe('formatLicenseDate', () => {
    it('gibt "Unbegrenzt" zurück bei null', () => {
      expect(formatLicenseDate(null)).toBe('Unbegrenzt')
    })

    it('formatiert Datum', () => {
      const result = formatLicenseDate('2026-12-31')
      expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/)
    })
  })
})
