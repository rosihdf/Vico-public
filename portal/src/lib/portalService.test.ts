import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(),
      })),
    },
  },
}))

import { supabase } from './supabase'
import { fetchPortalReports, getPortalPdfPath } from './portalService'

describe('portalService', () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset()
  })

  describe('fetchPortalReports', () => {
    it('gibt leeres Array bei Fehler', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'Fehler' } } as never)
      const result = await fetchPortalReports('user-123')
      expect(result).toEqual([])
    })

    it('gibt leeres Array bei nicht-Array data', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as never)
      const result = await fetchPortalReports('user-123')
      expect(result).toEqual([])
    })

    it('gibt Berichte zurück bei Erfolg', async () => {
      const mockReports = [
        {
          report_id: 'r1',
          maintenance_date: '2025-01-15',
          object_name: 'Tür 1',
          customer_name: 'Kunde A',
        },
      ]
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: mockReports, error: null } as never)
      const result = await fetchPortalReports('user-123')
      expect(result).toEqual(mockReports)
      expect(supabase.rpc).toHaveBeenCalledWith('get_portal_maintenance_reports', { p_user_id: 'user-123' })
    })
  })

  describe('getPortalPdfPath', () => {
    it('gibt null bei Fehler', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'Fehler' } } as never)
      const result = await getPortalPdfPath('report-123')
      expect(result).toBeNull()
    })

    it('gibt Pfad zurück bei Erfolg', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 'path/to/file.pdf', error: null } as never)
      const result = await getPortalPdfPath('report-123')
      expect(result).toBe('path/to/file.pdf')
      expect(supabase.rpc).toHaveBeenCalledWith('get_portal_pdf_path', { p_report_id: 'report-123' })
    })
  })
})
