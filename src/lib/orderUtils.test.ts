import { describe, it, expect } from 'vitest'
import { findActiveOrderConflictsAmong, getOrderObjectIds } from './orderUtils'
import type { Order } from '../types'

describe('getOrderObjectIds', () => {
  it('nutzt object_ids wenn gesetzt', () => {
    expect(
      getOrderObjectIds({
        object_id: 'a',
        object_ids: ['b', 'c'],
      })
    ).toEqual(['b', 'c'])
  })

  it('fällt auf object_id zurück', () => {
    expect(
      getOrderObjectIds({
        object_id: 'a',
        object_ids: null,
      })
    ).toEqual(['a'])
  })
})

const o = (partial: Partial<Order>): Order =>
  ({
    id: 'x',
    customer_id: 'c',
    bv_id: null,
    object_id: null,
    object_ids: null,
    order_date: '2026-01-01',
    order_time: null,
    order_type: 'wartung',
    status: 'offen',
    description: null,
    assigned_to: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    ...partial,
  }) as Order

describe('findActiveOrderConflictsAmong', () => {
  it('findet Konflikt wenn andere Order dieselbe Tür aktiv hat', () => {
    const orders = [
      o({ id: '1', object_ids: ['door-a'], status: 'offen' }),
      o({ id: '2', object_ids: ['door-b'], status: 'offen' }),
    ]
    const c = findActiveOrderConflictsAmong(orders, null, ['door-a'], 'in_bearbeitung')
    expect(c).toEqual([{ objectId: 'door-a', orderId: '1' }])
  })

  it('ignoriert excludeOrderId', () => {
    const orders = [o({ id: '1', object_ids: ['door-a'], status: 'offen' })]
    expect(findActiveOrderConflictsAmong(orders, '1', ['door-a'], 'offen')).toEqual([])
  })

  it('kein Konflikt bei erledigt', () => {
    const orders = [o({ id: '1', object_ids: ['door-a'], status: 'erledigt' })]
    expect(findActiveOrderConflictsAmong(orders, null, ['door-a'], 'offen')).toEqual([])
  })
})
