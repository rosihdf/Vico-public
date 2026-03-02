import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo'
import { useAuth } from './AuthContext'
import { fetchMyProfile, getProfileDisplayName, type Profile } from './lib/userService'
import { fetchOrdersAssignedTo, fetchCustomers, fetchAllBvs, fetchMaintenanceReminders } from './lib/dataService'
import { subscribeToOrderChanges } from './lib/orderRealtime'
import type { Order, Customer, BV, OrderType, OrderStatus, MaintenanceReminder } from './types'

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  wartung: 'Wartung',
  reparatur: 'Reparatur',
  montage: 'Montage',
  sonstiges: 'Sonstiges',
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
  storniert: 'Storniert',
}

const DAY_STATUS_COLORS: Record<OrderStatus, string> = {
  offen: '#d97706',
  in_bearbeitung: '#2563eb',
  erledigt: '#64748b',
  storniert: '#94a3b8',
}

const formatDayStatusSummaryLines = (
  orders: Order[]
): { status: OrderStatus; text: string }[] => {
  const counts: Record<OrderStatus, number> = {
    offen: 0,
    in_bearbeitung: 0,
    erledigt: 0,
    storniert: 0,
  }
  orders.forEach((o) => {
    const s = o.status ?? 'offen'
    counts[s] = (counts[s] ?? 0) + 1
  })
  const labels: Record<OrderStatus, string> = {
    offen: 'offen',
    in_bearbeitung: 'in Bearbeitung',
    erledigt: 'erledigt',
    storniert: 'storniert',
  }
  const result: { status: OrderStatus; text: string }[] = []
  ;(['offen', 'in_bearbeitung', 'erledigt', 'storniert'] as OrderStatus[]).forEach(
    (s) => {
      const n = counts[s]
      if (n > 0) result.push({ status: s, text: `${n} ${labels[s]}` })
    }
  )
  return result
}

const getWeekDates = () => {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - start.getDay() + 1)
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

const Startseite = () => {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [allBvs, setAllBvs] = useState<BV[]>([])
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setProfile(null)
      setAssignedOrders([])
      setReminders([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const [profileData, assignedData, customerData, bvData, reminderData] = await Promise.all([
      fetchMyProfile(user.id),
      fetchOrdersAssignedTo(user.id),
      fetchCustomers(),
      fetchAllBvs(),
      fetchMaintenanceReminders(),
    ])
    setProfile(profileData ?? null)
    setAssignedOrders(assignedData ?? [])
    setCustomers(customerData ?? [])
    setAllBvs(bvData ?? [])
    setReminders(reminderData ?? [])
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const unsub = subscribeToOrderChanges(loadData)
    return unsub
  }, [loadData])

  const getCustomerName = (id: string) => customers.find((c) => c.id === id)?.name ?? '-'
  const getBvName = (id: string) => allBvs.find((b) => b.id === id)?.name ?? '-'

  const activeOrders = assignedOrders.filter((o) => o.status !== 'erledigt' && o.status !== 'storniert')
  const weekDates = getWeekDates()
  const ordersByWeekDay: Record<string, Order[]> = {}
  weekDates.forEach((d) => {
    ordersByWeekDay[d] = assignedOrders.filter((o) => o.order_date === d && o.status !== 'erledigt' && o.status !== 'storniert')
  })
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  return (
    <div className="p-4">
      <Logo variant="full" className="mb-6" />
      <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>
      <p className="mt-2 text-slate-600">
        {profile
          ? `Hallo, ${getProfileDisplayName(profile)}! Willkommen bei Vico Türen & Tore.`
          : 'Willkommen bei Vico Türen & Tore.'}
      </p>

      {user && !isLoading && (
        <section className="mt-6" aria-labelledby="kalender-woche-heading">
          <h3 id="kalender-woche-heading" className="text-lg font-semibold text-slate-800 mb-3">
            Aufträge diese Woche
          </h3>
          <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDates.map((d, i) => {
              const dayOrders = ordersByWeekDay[d] ?? []
              const dayNum = new Date(d + 'T12:00:00').getDate()
              const isToday = d === new Date().toISOString().slice(0, 10)
              return (
                <div
                  key={d}
                  className={`bg-white rounded-lg border p-2 text-center ${
                    isToday ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200'
                  }`}
                >
                  <div className="text-xs text-slate-500">{dayNames[i]}</div>
                  <div className="text-lg font-semibold text-slate-800">{dayNum}</div>
                  {dayOrders.length > 0 && (
                    <div className="text-xs font-medium mt-1 flex flex-col items-center gap-0.5">
                      {formatDayStatusSummaryLines(dayOrders).map(({ status, text }) => (
                        <span
                          key={status}
                          style={{ color: DAY_STATUS_COLORS[status] }}
                        >
                          {text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <Link
            to="/auftrag"
            className="text-sm text-vico-primary hover:underline font-medium"
          >
            Kalender & Aufträge →
          </Link>
        </section>
      )}

      {user && reminders.length > 0 && (
        <section className="mt-6" aria-labelledby="wartung-faellig-heading">
          <h3 id="wartung-faellig-heading" className="text-lg font-semibold text-slate-800 mb-3">
            Wartung fällig / Erinnerungen
          </h3>
          <ul className="space-y-2" aria-label="Wartungserinnerungen">
            {reminders.map((r) => (
              <li key={r.object_id}>
                <Link
                  to={`/kunden/${r.customer_id}/bvs/${r.bv_id}/objekte?objectId=${r.object_id}`}
                  className="block bg-white rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors"
                >
                  <p className="font-medium text-slate-800">
                    {r.customer_name} → {r.bv_name}
                    {r.internal_id && <span className="text-slate-600 font-normal"> · {r.internal_id}</span>}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    {r.status === 'overdue' ? (
                      <span className="text-red-600 font-medium">
                        Überfällig
                        {r.last_maintenance_date
                          ? ` (letzte: ${r.last_maintenance_date})`
                          : ' (noch nie gewartet)'}
                      </span>
                    ) : (
                      <span className="text-amber-600">
                        Fällig bis {r.next_maintenance_date}
                        {r.days_until_due != null && ` (${r.days_until_due} Tage)`}
                      </span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {user && (
        <section className="mt-6" aria-labelledby="meine-auftraege-heading">
          <h3 id="meine-auftraege-heading" className="text-lg font-semibold text-slate-800 mb-3">
            Meine zugewiesenen Aufträge
          </h3>
          {isLoading ? (
            <p className="text-slate-600">Lade Aufträge…</p>
          ) : activeOrders.length === 0 ? (
            <div className="p-6 bg-white rounded-xl border border-slate-200 text-center text-slate-600">
              Keine Aufträge zugewiesen.
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Meine Aufträge">
              {activeOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    to={`/kunden/${o.customer_id}/bvs/${o.bv_id}/objekte${o.object_id ? `?objectId=${o.object_id}` : ''}`}
                    className="block bg-white rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors"
                  >
                    <p className="font-medium text-slate-800">
                      {getCustomerName(o.customer_id)} → {getBvName(o.bv_id)}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {o.order_date} · {ORDER_TYPE_LABELS[o.order_type]} ·{' '}
                      <span
                        className={
                          o.status === 'offen'
                            ? 'text-amber-600'
                            : o.status === 'in_bearbeitung'
                              ? 'text-blue-600'
                              : 'text-slate-600'
                        }
                      >
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </p>
                    {o.description && (
                      <p className="text-sm text-slate-500 mt-1 truncate">{o.description}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!isLoading && assignedOrders.length > 0 && (
            <Link
              to="/auftrag"
              className="mt-3 inline-block text-sm text-vico-primary hover:underline font-medium"
            >
              Alle Aufträge anzeigen →
            </Link>
          )}
        </section>
      )}
    </div>
  )
}

export default Startseite
