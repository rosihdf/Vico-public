import { supabase } from '../supabase'
import type { Customer, BV, Object as Obj } from '../types'
import {
  getOutbox,
  setOutbox,
  removeOutboxItem,
  setCachedCustomers,
  setCachedBvs,
  setCachedObjects,
  getCachedCustomers,
  getCachedBvs,
  getCachedObjects,
} from './offlineStorage'

export type SyncResult = { success: boolean; pendingCount: number; error?: string }

export const processOutbox = async (): Promise<SyncResult> => {
  const box = getOutbox()
  if (box.length === 0) return { success: true, pendingCount: 0 }

  for (const item of [...box]) {
    try {
      if (item.action === 'insert') {
        const { error } = await supabase.from(item.table).insert(item.payload)
        if (error) throw new Error(error.message)
      } else if (item.action === 'update') {
        const { id, ...rest } = item.payload as { id: string; [k: string]: unknown }
        const { error } = await supabase.from(item.table).update(rest).eq('id', id)
        if (error) throw new Error(error.message)
      } else if (item.action === 'delete') {
        const { id } = item.payload as { id: string }
        const { error } = await supabase.from(item.table).delete().eq('id', id)
        if (error) throw new Error(error.message)
      }
      removeOutboxItem(item.id)
    } catch (err) {
      return {
        success: false,
        pendingCount: getOutbox().length,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
  return { success: true, pendingCount: 0 }
}

export const pullFromServer = async (): Promise<void> => {
  const [custRes, bvRes, objRes] = await Promise.all([
    supabase.from('customers').select('*').order('name'),
    supabase.from('bvs').select('*').order('name'),
    supabase.from('objects').select('*').order('internal_id'),
  ])

  if (!custRes.error) setCachedCustomers((custRes.data as Customer[]) ?? [])
  if (!bvRes.error) setCachedBvs((bvRes.data as BV[]) ?? [])
  if (!objRes.error) setCachedObjects((objRes.data as Obj[]) ?? [])
}

export const runSync = async (): Promise<SyncResult> => {
  const pushResult = await processOutbox()
  if (!pushResult.success) return pushResult
  await pullFromServer()
  return { success: true, pendingCount: 0 }
}

export const getPendingCount = () => getOutbox().length

export const mergeCacheWithOutbox = () => {
  const box = getOutbox()
  if (box.length === 0) return

  let customers = getCachedCustomers() as Customer[]
  let bvs = getCachedBvs() as BV[]
  let objects = getCachedObjects() as Obj[]

  for (const item of box) {
    if (item.action === 'delete') {
      const id = (item.payload as { id: string }).id
      if (item.table === 'customers') customers = customers.filter((c) => c.id !== id)
      if (item.table === 'bvs') bvs = bvs.filter((b) => b.id !== id)
      if (item.table === 'objects') objects = objects.filter((o) => o.id !== id)
    } else if (item.action === 'insert' || item.action === 'update') {
      const row = item.payload as Record<string, unknown>
      const id = row.id as string
      if (item.table === 'customers') {
        customers = customers.filter((c) => c.id !== id)
        customers.push(row as unknown as Customer)
      }
      if (item.table === 'bvs') {
        bvs = bvs.filter((b) => b.id !== id)
        bvs.push(row as unknown as BV)
      }
      if (item.table === 'objects') {
        objects = objects.filter((o) => o.id !== id)
        objects.push(row as unknown as Obj)
      }
    }
  }

  setCachedCustomers(customers)
  setCachedBvs(bvs)
  setCachedObjects(objects)
}
