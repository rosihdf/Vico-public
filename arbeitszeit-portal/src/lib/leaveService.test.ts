import { describe, it, expect } from 'vitest'
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from './leaveService'

describe('leaveService labels', () => {
  it('LEAVE_TYPE_LABELS deckt alle Leave-Typen ab', () => {
    const keys = ['urlaub', 'krank', 'sonderurlaub', 'unbezahlt', 'sonstiges'] as const
    for (const k of keys) {
      expect(LEAVE_TYPE_LABELS[k]).toBeTruthy()
      expect(typeof LEAVE_TYPE_LABELS[k]).toBe('string')
    }
  })

  it('LEAVE_STATUS_LABELS deckt alle Status ab', () => {
    const keys = ['pending', 'approved', 'rejected'] as const
    for (const k of keys) {
      expect(LEAVE_STATUS_LABELS[k]).toBeTruthy()
    }
  })
})
