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
import {
  DEFAULT_PORTAL_ORDER_TIMELINE_SETTINGS,
  fetchPortalOrderTimeline,
  fetchPortalReports,
  getPortalPdfPath,
  getPortalPruefprotokollPdfPath,
} from './portalService'

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

  describe('fetchPortalOrderTimeline', () => {
    it('liefert Defaults bei Fehler', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'Fehler' } } as never)
      const result = await fetchPortalOrderTimeline('user-123')
      expect(result).toEqual({ settings: DEFAULT_PORTAL_ORDER_TIMELINE_SETTINGS, orders: [] })
    })

    it('parst RPC-JSON', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          settings: {
            portal_timeline_show_planned: true,
            portal_timeline_show_termin: false,
            portal_timeline_show_in_progress: true,
          },
          orders: [
            {
              id: 'o1',
              status: 'offen',
              order_type: 'wartung',
              order_date: null,
              order_time: null,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
              object_names: 'T1',
            },
          ],
        },
        error: null,
      } as never)
      const result = await fetchPortalOrderTimeline('user-123')
      expect(result.orders).toHaveLength(1)
      expect(result.settings.portal_timeline_show_planned).toBe(true)
      expect(result.settings.portal_timeline_show_termin).toBe(false)
      expect(supabase.rpc).toHaveBeenCalledWith('get_portal_order_timeline', { p_user_id: 'user-123' })
    })
  })

  describe('getPortalPruefprotokollPdfPath', () => {
    it('gibt null bei Fehler', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'Fehler' } } as never)
      const result = await getPortalPruefprotokollPdfPath('report-123')
      expect(result).toBeNull()
    })

    it('gibt Pfad zurück bei Erfolg', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 'pdf/pruef-x.pdf', error: null } as never)
      const result = await getPortalPruefprotokollPdfPath('report-123')
      expect(result).toBe('pdf/pruef-x.pdf')
      expect(supabase.rpc).toHaveBeenCalledWith('get_portal_pruefprotokoll_pdf_path', {
        p_report_id: 'report-123',
      })
    })
  })
})
