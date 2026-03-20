import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLicense } from './LicenseContext'
import { useComponentSettings } from './ComponentSettingsContext'
import { hasFeature } from './lib/licenseService'
import { fetchMyProfile, getProfileDisplayName, type Profile } from './lib/userService'
import { fetchOrdersAssignedTo, fetchCustomers, fetchAllBvs, fetchMaintenanceReminders } from './lib/dataService'
import { getObjectDisplayName } from './lib/objectUtils'
import {
  fetchTimeEntriesForUser,
  fetchTimeBreaksForEntry,
  startTimeEntry,
  endTimeEntry,
  startBreak,
  endBreak,
  getActiveEntry,
  getActiveBreak,
  calcWorkMinutes,
} from './lib/timeService'
import { getCurrentPosition } from './lib/geolocation'
import { LoadingSpinner } from './components/LoadingSpinner'
import { subscribeToOrderChanges } from './lib/orderRealtime'
import { recordStartseiteMetrics } from './lib/performanceMetricsService'
import { useToast } from './ToastContext'
import { formatTime, formatMinutes } from '../shared/format'
import type { Order, Customer, BV, OrderType, OrderStatus, MaintenanceReminder } from './types'
import type { TimeEntry, TimeBreak } from './types'

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
  const abbrev: Record<OrderStatus, string> = {
    offen: 'offen',
    in_bearbeitung: 'i.B.',
    erledigt: 'erl.',
    storniert: 'storn.',
  }
  const result: { status: OrderStatus; text: string }[] = []
  ;(['offen', 'in_bearbeitung', 'erledigt', 'storniert'] as OrderStatus[]).forEach(
    (s) => {
      const n = counts[s]
      if (n > 0) result.push({ status: s, text: `${n} ${abbrev[s]}` })
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

const toDateStr = (d: Date): string => d.toISOString().slice(0, 10)

const Startseite = () => {
  const { user, userRole } = useAuth()
  const { license } = useLicense()
  const { isEnabled } = useComponentSettings()
  const { showError, showToast } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [allBvs, setAllBvs] = useState<BV[]>([])
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([])
  const [breaksMap, setBreaksMap] = useState<Record<string, TimeBreak[]>>({})
  const [timeActionLoading, setTimeActionLoading] = useState(false)

  const canUseZeiterfassung =
    license &&
    hasFeature(license, 'arbeitszeiterfassung') &&
    isEnabled('arbeitszeiterfassung') &&
    userRole !== 'leser' &&
    userRole !== 'kunde'

  const todayStr = toDateStr(new Date())
  const activeEntry = useMemo(() => getActiveEntry(todayEntries), [todayEntries])
  const activeBreaks = activeEntry ? (breaksMap[activeEntry.id] ?? []) : []
  const activeBreak = activeEntry ? getActiveBreak(activeEntry, activeBreaks) : null
  const todayWorkMinutes = useMemo(
    () =>
      todayEntries.reduce((sum, e) => {
        const breaks = breaksMap[e.id] ?? []
        return sum + calcWorkMinutes(e, breaks)
      }, 0),
    [todayEntries, breaksMap]
  )

  const loadTimeEntries = useCallback(async () => {
    if (!user?.id || !canUseZeiterfassung) return
    const data = await fetchTimeEntriesForUser(user.id, todayStr, todayStr)
    setTodayEntries(data)
    const map: Record<string, TimeBreak[]> = {}
    for (const e of data) {
      map[e.id] = await fetchTimeBreaksForEntry(e.id)
    }
    setBreaksMap(map)
  }, [user?.id, canUseZeiterfassung, todayStr])

  useEffect(() => {
    loadTimeEntries()
  }, [loadTimeEntries])

  const handleTimeStart = async () => {
    if (!user?.id || timeActionLoading) return
    setTimeActionLoading(true)
    let location: { lat: number; lon: number } | null = null
    const myProfile = user?.id ? await fetchMyProfile(user.id) : null
    const hasGpsConsent =
      myProfile?.gps_consent_at != null && myProfile?.gps_consent_revoked_at == null
    if (hasGpsConsent) {
      location = await getCurrentPosition()
      if (!location) {
        showError('Standort konnte nicht ermittelt werden. Bitte Browser-Berechtigung für Standort prüfen.')
      }
    }
    const { data, error } = await startTimeEntry(user.id, location)
    setTimeActionLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    if (data) {
      setTodayEntries((prev) => [data, ...prev])
      setBreaksMap((prev) => ({ ...prev, [data.id]: [] }))
    }
  }

  const handleTimeEnd = async () => {
    if (!activeEntry || timeActionLoading) return
    const endIso = new Date().toISOString()
    setTimeActionLoading(true)
    let location: { lat: number; lon: number } | null = null
    const myProfile = user?.id ? await fetchMyProfile(user.id) : null
    const hasGpsConsent =
      myProfile?.gps_consent_at != null && myProfile?.gps_consent_revoked_at == null
    if (hasGpsConsent) {
      location = await getCurrentPosition()
      if (!location) {
        showToast('Stempelung gespeichert, aber Standort konnte nicht ermittelt werden. Prüfen Sie die Browser-Berechtigung.', 'info')
      }
    }
    const { error } = await endTimeEntry(activeEntry.id, user!.id, location)
    setTimeActionLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    setTodayEntries((prev) =>
      prev.map((e) =>
        e.id === activeEntry.id ? { ...e, end: endIso, updated_at: endIso } : e
      )
    )
  }

  const handlePauseStart = async () => {
    if (!activeEntry || timeActionLoading) return
    setTimeActionLoading(true)
    const { data, error } = await startBreak(activeEntry.id, user!.id)
    setTimeActionLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    if (data) {
      setBreaksMap((prev) => ({
        ...prev,
        [activeEntry.id]: [...(prev[activeEntry.id] ?? []), data],
      }))
    }
  }

  const handlePauseEnd = async () => {
    if (!activeEntry || !activeBreak || timeActionLoading) return
    setTimeActionLoading(true)
    const { error } = await endBreak(activeBreak.id, activeEntry.id, user!.id)
    setTimeActionLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    setBreaksMap((prev) => ({
      ...prev,
      [activeEntry.id]: (prev[activeEntry.id] ?? []).map((b) =>
        b.id === activeBreak.id ? { ...b, end: new Date().toISOString() } : b
      ),
    }))
  }

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setProfile(null)
      setAssignedOrders([])
      setReminders([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const loadStart = performance.now()
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
    const loadDataMs = Math.round(performance.now() - loadStart)
    console.info(`[Startseite] loadData: ${loadDataMs}ms`)
    recordStartseiteMetrics(loadDataMs)
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const unsub = subscribeToOrderChanges(loadData)
    return unsub
  }, [loadData])

  const getCustomerName = useCallback(
    (id: string) => customers.find((c) => c.id === id)?.name ?? '-',
    [customers]
  )
  const getBvName = useCallback(
    (id: string) => allBvs.find((b) => b.id === id)?.name ?? '-',
    [allBvs]
  )

  const activeOrders = useMemo(
    () => assignedOrders.filter((o) => o.status !== 'erledigt' && o.status !== 'storniert'),
    [assignedOrders]
  )
  const weekDates = getWeekDates()
  const ordersByWeekDay: Record<string, Order[]> = {}
  weekDates.forEach((d) => {
    ordersByWeekDay[d] = assignedOrders.filter((o) => o.order_date === d && o.status !== 'erledigt' && o.status !== 'storniert')
  })
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  return (
    <div className="p-4 min-w-0">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        {profile
          ? `Hallo, ${getProfileDisplayName(profile)}! Willkommen bei AMRtech Türen & Tore.`
          : 'Willkommen bei AMRtech Türen & Tore.'}
      </p>

      {user && canUseZeiterfassung && (
        <section className="mt-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600" aria-labelledby="zeiterfassung-heading">
          <h3 id="zeiterfassung-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Arbeitszeit
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            {!activeEntry && (
              <button
                type="button"
                onClick={handleTimeStart}
                disabled={timeActionLoading}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                aria-label="Arbeitsbeginn"
              >
                Start
              </button>
            )}
            {activeEntry && !activeBreak && (
              <>
                <button
                  type="button"
                  onClick={handlePauseStart}
                  disabled={timeActionLoading}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  aria-label="Pause starten"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={handleTimeEnd}
                  disabled={timeActionLoading}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  aria-label="Feierabend"
                >
                  Ende
                </button>
              </>
            )}
            {activeEntry && activeBreak && (
              <button
                type="button"
                onClick={handlePauseEnd}
                disabled={timeActionLoading}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                aria-label="Pause beenden"
              >
                Weiter
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Heute: {formatMinutes(todayWorkMinutes)}
            {activeEntry && (
              <span className="ml-2 text-green-600 dark:text-green-400">
                · Läuft seit {formatTime(activeEntry.start)}
              </span>
            )}
          </p>
          <Link to="/arbeitszeit" className="mt-2 inline-block text-sm text-vico-primary hover:underline">
            Zeiterfassung →
          </Link>
        </section>
      )}

      {user && !isLoading && (
        <section className="mt-6" aria-labelledby="kalender-woche-heading">
          <h3 id="kalender-woche-heading" className="text-lg font-semibold text-slate-800 mb-3">
            Aufträge diese Woche
          </h3>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="grid grid-cols-7 gap-2 mb-4 min-w-[280px]">
            {weekDates.map((d, i) => {
              const dayOrders = ordersByWeekDay[d] ?? []
              const dayNum = new Date(d + 'T12:00:00').getDate()
              const isToday = d === new Date().toISOString().slice(0, 10)
              return (
                <div
                  key={d}
                  className={`bg-white dark:bg-slate-800 rounded-lg border p-2 text-center ${
                    isToday ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <div className="text-xs text-slate-500 dark:text-slate-400">{dayNames[i]}</div>
                  <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{dayNum}</div>
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
          <h3 id="wartung-faellig-heading" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Wartung fällig / Erinnerungen
          </h3>
          <ul className="space-y-2" aria-label="Wartungserinnerungen">
            {reminders.map((r) => {
              const objName = getObjectDisplayName({
                name: r.object_name,
                internal_id: r.internal_id,
                room: r.object_room,
                floor: r.object_floor,
                manufacturer: r.object_manufacturer,
              })
              return (
              <li key={r.object_id}>
                <Link
                  to={`/kunden?customerId=${r.customer_id}&bvId=${r.bv_id}&objectId=${r.object_id}`}
                  className="block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {r.customer_name} → {r.bv_name}
                    {objName !== '–' && (
                      <span className="text-slate-600 dark:text-slate-400 font-normal"> · {objName}</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
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
            )})}
          </ul>
        </section>
      )}

      {user && (
        <section className="mt-6" aria-labelledby="meine-auftraege-heading">
          <h3 id="meine-auftraege-heading" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Meine zugewiesenen Aufträge
          </h3>
          {isLoading ? (
            <LoadingSpinner message="Lade Aufträge…" size="sm" className="py-4" />
          ) : activeOrders.length === 0 ? (
            <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 text-center text-slate-600 dark:text-slate-400">
              Keine Aufträge zugewiesen.
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Meine Aufträge">
              {activeOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    to={`/auftrag/${o.id}`}
                    className="block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {getCustomerName(o.customer_id)} → {getBvName(o.bv_id)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {o.order_date} · {ORDER_TYPE_LABELS[o.order_type]} ·{' '}
                      <span
                        className={
                          o.status === 'offen'
                            ? 'text-amber-600'
                            : o.status === 'in_bearbeitung'
                              ? 'text-blue-600'
                              : 'text-slate-600 dark:text-slate-400'
                        }
                      >
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </p>
                    {o.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-500 mt-1 truncate">{o.description}</p>
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
