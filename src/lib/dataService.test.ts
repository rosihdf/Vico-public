import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

vi.mock('./offlineStorage', () => ({
  getCachedCustomers: vi.fn(() => []),
  setCachedCustomers: vi.fn(),
  getCachedBvs: vi.fn(() => []),
  setCachedBvs: vi.fn(),
  getCachedObjects: vi.fn(() => []),
  setCachedObjects: vi.fn(),
  getCachedMaintenanceReports: vi.fn(() => []),
  setCachedMaintenanceReports: vi.fn(),
  getCachedOrders: vi.fn(() => []),
  setCachedOrders: vi.fn(),
  getCachedObjectPhotos: vi.fn(() => []),
  setCachedObjectPhotos: vi.fn(),
  getObjectPhotoOutbox: vi.fn(() => []),
  addToObjectPhotoOutbox: vi.fn(),
  removeObjectPhotoOutboxItem: vi.fn(),
  getCachedObjectDocuments: vi.fn(() => []),
  setCachedObjectDocuments: vi.fn(),
  getObjectDocumentOutbox: vi.fn(() => []),
  addToObjectDocumentOutbox: vi.fn(),
  removeObjectDocumentOutboxItem: vi.fn(),
  getCachedMaintenancePhotos: vi.fn(() => []),
  setCachedMaintenancePhotos: vi.fn(),
  getMaintenancePhotoOutbox: vi.fn(() => []),
  addToMaintenancePhotoOutbox: vi.fn(),
  removeMaintenancePhotoOutboxItem: vi.fn(),
  getObjectDefectPhotoOutbox: vi.fn(() => []),
  addToObjectDefectPhotoOutbox: vi.fn(),
  removeObjectDefectPhotoOutboxItem: vi.fn(),
  getCachedReminders: vi.fn(() => []),
  setCachedReminders: vi.fn(),
  getMaintenanceOutbox: vi.fn(() => []),
  addToMaintenanceOutbox: vi.fn(),
  removeMaintenanceOutboxItem: vi.fn(),
  addToOutbox: vi.fn(),
  getCachedAuditLog: vi.fn(() => []),
  setCachedAuditLog: vi.fn(),
}))

import {
  subscribeToDataChange,
  notifyDataChange,
  fetchCustomers,
  fetchCustomer,
  fetchBvs,
  fetchObjects,
  fetchMaintenanceReminders,
  fetchAuditLog,
} from './dataService'
import * as offlineStorage from './offlineStorage'

describe('dataService', () => {
  beforeEach(() => {
    notifyDataChange()
  })

  describe('subscribeToDataChange / notifyDataChange', () => {
    it('ruft alle registrierten Listener auf', () => {
      const fn1 = vi.fn()
      const fn2 = vi.fn()
      const unsub1 = subscribeToDataChange(fn1)
      const unsub2 = subscribeToDataChange(fn2)

      notifyDataChange()

      expect(fn1).toHaveBeenCalledTimes(1)
      expect(fn2).toHaveBeenCalledTimes(1)
      unsub1()
      unsub2()
    })

    it('entfernt Listener nach unsubscribe', () => {
      const fn = vi.fn()
      const unsub = subscribeToDataChange(fn)
      unsub()

      notifyDataChange()

      expect(fn).not.toHaveBeenCalled()
    })

    it('ruft verbleibende Listener weiterhin auf nach unsubscribe', () => {
      const fn1 = vi.fn()
      const fn2 = vi.fn()
      const unsub1 = subscribeToDataChange(fn1)
      const unsub2 = subscribeToDataChange(fn2)
      unsub1()

      notifyDataChange()

      expect(fn1).not.toHaveBeenCalled()
      expect(fn2).toHaveBeenCalledTimes(1)
      unsub2()
    })
  })

  describe('Offline-Fallback (Cache)', () => {
    const originalNavigator = globalThis.navigator

    beforeEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { ...originalNavigator, onLine: false },
        writable: true,
      })
    })

    afterEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
      })
    })

    it('fetchCustomers gibt aktive Kunden aus Cache wenn offline (ohne archivierte)', async () => {
      const cached = [
        { id: 'c1', name: 'Kunde A', archived_at: null },
        { id: 'c2', name: 'Alt', archived_at: '2020-01-01T00:00:00.000Z' },
      ] as never[]
      vi.mocked(offlineStorage.getCachedCustomers).mockReturnValue(cached)

      const result = await fetchCustomers()

      expect(result).toEqual([{ id: 'c1', name: 'Kunde A', archived_at: null }])
    })

    it('fetchCustomer gibt Eintrag aus Cache oder null wenn offline', async () => {
      const cached = [
        { id: 'c1', name: 'Kunde A', archived_at: null },
        { id: 'c2', name: 'Kunde B', archived_at: null },
      ] as never[]
      vi.mocked(offlineStorage.getCachedCustomers).mockReturnValue(cached)

      expect(await fetchCustomer('c1')).toEqual({ id: 'c1', name: 'Kunde A', archived_at: null })
      expect(await fetchCustomer('c2')).toEqual({ id: 'c2', name: 'Kunde B', archived_at: null })
      expect(await fetchCustomer('c99')).toBeNull()
    })

    it('fetchBvs filtert Cache nach customerId wenn offline', async () => {
      const cached = [
        { id: 'b1', customer_id: 'c1', name: 'BV 1' },
        { id: 'b2', customer_id: 'c1', name: 'BV 2' },
        { id: 'b3', customer_id: 'c2', name: 'BV 3' },
      ] as never[]
      vi.mocked(offlineStorage.getCachedBvs).mockReturnValue(cached)

      const result = await fetchBvs('c1')

      expect(result).toHaveLength(2)
      expect(result.map((b) => b.id)).toEqual(['b1', 'b2'])
    })

    it('fetchObjects filtert Cache nach bvId wenn offline', async () => {
      const cached = [
        { id: 'o1', bv_id: 'b1', name: null, internal_id: 'T-1' },
        { id: 'o2', bv_id: 'b1', name: null, internal_id: 'T-2' },
        { id: 'o3', bv_id: 'b2', name: null, internal_id: 'T-3' },
      ] as never[]
      vi.mocked(offlineStorage.getCachedObjects).mockReturnValue(cached)

      const result = await fetchObjects('b1')

      expect(result).toHaveLength(2)
      expect(result.map((o) => o.id)).toEqual(['o1', 'o2'])
    })

    it('fetchMaintenanceReminders gibt Cache zurück wenn offline', async () => {
      const cached = [{ object_id: 'o1', status: 'ok' }] as never[]
      vi.mocked(offlineStorage.getCachedReminders).mockReturnValue(cached)

      const result = await fetchMaintenanceReminders()

      expect(result).toEqual(cached)
    })

    it('fetchAuditLog gibt Cache zurück wenn offline', async () => {
      const origNavigator = globalThis.navigator
      Object.defineProperty(globalThis, 'navigator', {
        value: { ...origNavigator, onLine: false },
        writable: true,
        configurable: true,
      })
      vi.mocked(offlineStorage.getCachedAuditLog).mockReturnValue([])
      const result = await fetchAuditLog()
      Object.defineProperty(globalThis, 'navigator', {
        value: origNavigator,
        writable: true,
        configurable: true,
      })

      expect(result).toEqual([])
    })
  })
})
