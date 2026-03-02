import { supabase } from './supabase'
import type { Customer, BV, Object as Obj } from './types'
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
      await removeOutboxItem(item.id)
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

  if (!custRes.error) await setCachedCustomers((custRes.data as Customer[]) ?? [])
  if (!bvRes.error) await setCachedBvs((bvRes.data as BV[]) ?? [])
  if (!objRes.error) await setCachedObjects((objRes.data as Obj[]) ?? [])
}

export const runSync = async (): Promise<SyncResult> => {
  const pushResult = await processOutbox()
  if (!pushResult.success) return pushResult
  await pullFromServer()
  return { success: true, pendingCount: 0 }
}

export const getPendingCount = (): number => getOutbox().length
