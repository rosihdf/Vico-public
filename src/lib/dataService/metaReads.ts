import { supabase } from '../../supabase'
import type {
  Customer,
  BV,
  Object as Obj,
  Order,
  MaintenanceReminder,
} from '../../types'
import { isOnline } from '../../../shared/networkUtils'
import {
  getCachedReminders,
  setCachedReminders,
  getCachedAuditLog,
  getCachedCustomers,
  getCachedBvs,
  getCachedObjects,
  getCachedOrders,
} from '../offlineStorage'

/** Gleiche Semantik wie in dataService (archived_at); hier dupliziert, um Zirkelimporte zu vermeiden. */
const isActiveCustomer = (c: Customer) => !c.archived_at
const isActiveBv = (b: BV) => !b.archived_at
const isActiveObject = (o: Obj) => !o.archived_at

const mapReminderRow = (row: Record<string, unknown>): MaintenanceReminder => ({
  object_id: row.object_id as string,
  customer_id: row.customer_id as string,
  customer_name: (row.customer_name as string) ?? '',
  bv_id: row.bv_id as string,
  bv_name: (row.bv_name as string) ?? '',
  internal_id: (row.internal_id as string) ?? null,
  object_name: (row.object_name as string) ?? null,
  object_room: (row.object_room as string) ?? null,
  object_floor: (row.object_floor as string) ?? null,
  object_manufacturer: (row.object_manufacturer as string) ?? null,
  maintenance_interval_months: (row.maintenance_interval_months as number) ?? 0,
  last_maintenance_date: row.last_maintenance_date ? String(row.last_maintenance_date).slice(0, 10) : null,
  next_maintenance_date: row.next_maintenance_date ? String(row.next_maintenance_date).slice(0, 10) : null,
  status: (row.status as MaintenanceReminder['status']) ?? 'ok',
  days_until_due: row.days_until_due != null ? Number(row.days_until_due) : null,
})

export const fetchMaintenanceReminders = async (): Promise<MaintenanceReminder[]> => {
  if (!isOnline()) return (getCachedReminders() as MaintenanceReminder[]) ?? []
  const { data, error } = await supabase.rpc('get_maintenance_reminders')
  if (error || !Array.isArray(data)) return []
  const reminders = data.map((row: Record<string, unknown>) => mapReminderRow(row))
  setCachedReminders(reminders)
  return reminders
}

export type AuditLogEntry = {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  table_name: string
  record_id: string | null
  created_at: string
}

const mapAuditRow = (row: Record<string, unknown>): AuditLogEntry => ({
  id: row.id as string,
  user_id: (row.user_id as string) ?? null,
  user_email: (row.user_email as string) ?? null,
  action: (row.action as string) ?? '',
  table_name: (row.table_name as string) ?? '',
  record_id: (row.record_id as string) ?? null,
  created_at: row.created_at ? new Date(row.created_at as string).toISOString() : '',
})

export const fetchAuditLog = async (limit = 200, offset = 0): Promise<AuditLogEntry[]> => {
  if (!isOnline()) {
    return (getCachedAuditLog() as AuditLogEntry[]) ?? []
  }
  const { data, error } = await supabase.rpc('get_audit_log', { limit_rows: limit, offset_rows: offset })
  if (error || !Array.isArray(data)) return []
  return data.map((row: Record<string, unknown>) => mapAuditRow(row))
}

export type AuditLogDetailEntry = AuditLogEntry & { user_name?: string | null }

export const fetchAuditLogDetail = async (id: string): Promise<AuditLogDetailEntry | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase.rpc('get_audit_log_detail', { entry_id: id })
  if (error || !Array.isArray(data) || data.length === 0) return null
  const row = data[0] as Record<string, unknown>
  return {
    ...mapAuditRow(row),
    user_name: (row.user_name as string) ?? null,
  }
}

/** Eintrag für „Zuletzt bearbeitet“ auf der Startseite (nach DB-Spalte updated_at). */
export type DashboardRecentEdit = {
  key: string
  to: string
  title: string
  subtitle: string
  updatedAt: string
}

const ORDER_TYPE_LABELS_SHORT: Record<string, string> = {
  wartung: 'Wartung',
  reparatur: 'Reparatur',
  montage: 'Montage',
  sonstiges: 'Sonstiges',
}

const sortByUpdatedAtDesc = <T extends { updated_at: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

/**
 * Baut „Zuletzt bearbeitet“ aus lokalem Cache (Offline, gleiche Sichtbarkeit wie zuletzt synchronisiert).
 */
export const buildRecentEditsFromCache = (options: {
  includeMaster: boolean
  includeOrders: boolean
  scope?: 'all' | 'mine'
  userId?: string
}): DashboardRecentEdit[] => {
  const scope = options.scope ?? 'all'
  const uid = options.userId
  const perTable = 10
  const maxTotal = 10
  const raw: DashboardRecentEdit[] = []

  const includeMaster = options.includeMaster && scope !== 'mine'

  if (includeMaster) {
    const customers = sortByUpdatedAtDesc((getCachedCustomers() as Customer[]).filter(isActiveCustomer)).slice(
      0,
      perTable
    )
    for (const c of customers) {
      raw.push({
        key: `customer-${c.id}`,
        to: `/kunden?customerId=${c.id}`,
        title: `Kunde: ${c.name?.trim() || 'Ohne Namen'}`,
        subtitle: '',
        updatedAt: c.updated_at,
      })
    }
    const bvs = sortByUpdatedAtDesc((getCachedBvs() as BV[]).filter(isActiveBv)).slice(0, perTable)
    for (const b of bvs) {
      raw.push({
        key: `bv-${b.id}`,
        to: `/kunden?customerId=${b.customer_id}&bvId=${b.id}`,
        title: `Objekt/BV: ${b.name?.trim() || 'Ohne Namen'}`,
        subtitle: '',
        updatedAt: b.updated_at,
      })
    }
    const objs = sortByUpdatedAtDesc((getCachedObjects() as Obj[]).filter(isActiveObject)).slice(0, perTable)
    for (const o of objs) {
      const cid = o.customer_id
      if (!cid) continue
      const params = new URLSearchParams()
      params.set('customerId', cid)
      if (o.bv_id) params.set('bvId', o.bv_id)
      params.set('objectId', o.id)
      raw.push({
        key: `object-${o.id}`,
        to: `/kunden?${params.toString()}`,
        title: `Tür/Tor: ${o.name?.trim() || o.internal_id?.trim() || 'Ohne Namen'}`,
        subtitle: '',
        updatedAt: o.updated_at,
      })
    }
  }

  if (options.includeOrders) {
    let orders = sortByUpdatedAtDesc(getCachedOrders() as Order[])
    if (scope === 'mine' && uid) {
      orders = orders.filter((o) => o.assigned_to === uid || o.created_by === uid)
    }
    for (const o of orders.slice(0, perTable)) {
      const typeLabel = ORDER_TYPE_LABELS_SHORT[o.order_type] ?? o.order_type
      raw.push({
        key: `order-${o.id}`,
        to: `/auftrag/${o.id}`,
        title: `Auftrag: ${typeLabel} · ${o.order_date}`,
        subtitle: o.status ? `Status: ${o.status}` : '',
        updatedAt: o.updated_at,
      })
    }
  }

  raw.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return raw.slice(0, maxTotal)
}

/**
 * Liefert die zuletzt geänderten Stammdaten/Aufträge, die der Nutzer per RLS sehen darf.
 * @param options.includeMaster – Kunden, BVs, Objekte (Menü „Kunden“)
 * @param options.includeOrders – Aufträge (Menü „Auftrag“)
 * @param options.scope – „mine“: nur Aufträge mit assigned_to/created_by = userId (Stammdaten entfallen)
 */
export const fetchRecentEditsForDashboard = async (options: {
  includeMaster: boolean
  includeOrders: boolean
  scope?: 'all' | 'mine'
  userId?: string
}): Promise<DashboardRecentEdit[]> => {
  if (!isOnline()) return buildRecentEditsFromCache(options)
  const scope = options.scope ?? 'all'
  const uid = options.userId
  const perTable = 10
  const maxTotal = 10
  /** Supabase-Query-Builder sind thenable, aber kein `Promise` im TS-Sinne. */
  const promises: PromiseLike<unknown>[] = []
  let fetchCustomers = false
  let fetchBvs = false
  let fetchObjects = false
  let fetchOrders = false

  const includeMaster = options.includeMaster && scope !== 'mine'

  if (includeMaster) {
    fetchCustomers = true
    fetchBvs = true
    fetchObjects = true
    promises.push(
      supabase
        .from('customers')
        .select('id,name,updated_at')
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(perTable)
    )
    promises.push(
      supabase
        .from('bvs')
        .select('id,name,customer_id,updated_at')
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(perTable)
    )
    promises.push(
      supabase
        .from('objects')
        .select('id,name,internal_id,room,floor,manufacturer,bv_id,customer_id,updated_at')
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(perTable)
    )
  }
  if (options.includeOrders) {
    fetchOrders = true
    let orderQ = supabase
      .from('orders')
      .select('id,customer_id,bv_id,order_date,order_type,status,updated_at,assigned_to,created_by')
      .order('updated_at', { ascending: false })
      .limit(perTable)
    if (scope === 'mine' && uid) {
      orderQ = orderQ.or(`assigned_to.eq.${uid},created_by.eq.${uid}`)
    }
    promises.push(orderQ)
  }
  if (promises.length === 0) return []

  const results = await Promise.all(promises)
  const raw: DashboardRecentEdit[] = []
  let idx = 0

  if (fetchCustomers) {
    const { data, error } = results[idx++] as {
      data: { id: string; name: string; updated_at: string }[] | null
      error: { message: string } | null
    }
    if (!error && data) {
      for (const c of data) {
        raw.push({
          key: `customer-${c.id}`,
          to: `/kunden?customerId=${c.id}`,
          title: `Kunde: ${c.name?.trim() || 'Ohne Namen'}`,
          subtitle: '',
          updatedAt: c.updated_at,
        })
      }
    }
  }
  if (fetchBvs) {
    const { data, error } = results[idx++] as {
      data: { id: string; name: string; customer_id: string; updated_at: string }[] | null
      error: { message: string } | null
    }
    if (!error && data) {
      for (const b of data) {
        raw.push({
          key: `bv-${b.id}`,
          to: `/kunden?customerId=${b.customer_id}&bvId=${b.id}`,
          title: `Objekt/BV: ${b.name?.trim() || 'Ohne Namen'}`,
          subtitle: '',
          updatedAt: b.updated_at,
        })
      }
    }
  }
  if (fetchObjects) {
    const { data, error } = results[idx++] as {
      data: {
        id: string
        name: string | null
        internal_id: string | null
        room: string | null
        floor: string | null
        manufacturer: string | null
        bv_id: string | null
        customer_id: string | null
        updated_at: string
      }[] | null
      error: { message: string } | null
    }
    if (!error && data) {
      for (const o of data) {
        const cid = o.customer_id
        if (!cid) continue
        const params = new URLSearchParams()
        params.set('customerId', cid)
        if (o.bv_id) params.set('bvId', o.bv_id)
        params.set('objectId', o.id)
        raw.push({
          key: `object-${o.id}`,
          to: `/kunden?${params.toString()}`,
          title: `Tür/Tor: ${o.name?.trim() || o.internal_id?.trim() || 'Ohne Namen'}`,
          subtitle: '',
          updatedAt: o.updated_at,
        })
      }
    }
  }
  if (fetchOrders) {
    const { data, error } = results[idx] as {
      data: {
        id: string
        customer_id: string
        bv_id: string
        order_date: string
        order_type: string
        status: string
        updated_at: string
      }[] | null
      error: { message: string } | null
    }
    if (!error && data) {
      for (const o of data) {
        const typeLabel = ORDER_TYPE_LABELS_SHORT[o.order_type] ?? o.order_type
        raw.push({
          key: `order-${o.id}`,
          to: `/auftrag/${o.id}`,
          title: `Auftrag: ${typeLabel} · ${o.order_date}`,
          subtitle: o.status ? `Status: ${o.status}` : '',
          updatedAt: o.updated_at,
        })
      }
    }
  }

  raw.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return raw.slice(0, maxTotal)
}
