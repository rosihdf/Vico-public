import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type MouseEvent,
  type KeyboardEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLicense } from './LicenseContext'
import { useComponentSettings } from './ComponentSettingsContext'
import { hasFeature } from './lib/licenseService'
import { fetchMyProfile, getProfileDisplayName, type Profile } from './lib/userService'
import {
  fetchOrdersAssignedTo,
  fetchCustomers,
  fetchAllBvs,
  fetchMaintenanceReminders,
  fetchRecentEditsForDashboard,
  type DashboardRecentEdit,
} from './lib/dataService'
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
import { useDashboardLayout } from './hooks/useDashboardLayout'
import {
  getResolvedWidgetOrder,
  isDashboardWidgetVisible,
} from './lib/dashboardLayoutPreferences'
import { isOnline } from '../shared/networkUtils'
import { formatTime, formatMinutes, formatDateTimeShort } from '../shared/format'
import {
  type MaintenanceReminderDashboardFilter,
  MAINTENANCE_REMINDER_FILTER_LABELS,
  filterMaintenanceRemindersForDashboard,
  countMaintenanceRemindersByFilter,
} from './lib/maintenanceReminderUtils'
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

const REMINDER_FILTER_STORAGE_KEY = 'vico_maintenance_reminder_filter_v1'

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
  const [recentEdits, setRecentEdits] = useState<DashboardRecentEdit[]>([])
  const [reminderFilter, setReminderFilter] = useState<MaintenanceReminderDashboardFilter>('all')

  const serverDashboardLayoutProp =
    !user ? undefined : isLoading ? undefined : (profile?.dashboard_layout ?? null)

  const {
    layout: dashboardLayout,
    updateRecentEditsOpen,
    dismissRecentEdit,
    resetDismissedRecentEdits,
    updateRecentEditsScope,
    toggleFavoriteRecentEdit,
  } = useDashboardLayout(user?.id ?? null, serverDashboardLayoutProp)

  const recentEditsScope = dashboardLayout.recentEditsScope ?? 'all'

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
      setRecentEdits([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const loadStart = performance.now()
    const includeMaster = isEnabled('kunden')
    const includeOrders = isEnabled('auftrag')
    const recentPromise =
      includeMaster || includeOrders
        ? fetchRecentEditsForDashboard({
            includeMaster,
            includeOrders,
            scope: recentEditsScope,
            userId: user.id,
          })
        : Promise.resolve([])

    const [profileData, assignedData, customerData, bvData, reminderData, recentList] = await Promise.all([
      fetchMyProfile(user.id),
      fetchOrdersAssignedTo(user.id),
      fetchCustomers(),
      fetchAllBvs(),
      fetchMaintenanceReminders(),
      recentPromise,
    ])
    setProfile(profileData ?? null)
    setAssignedOrders(assignedData ?? [])
    setCustomers(customerData ?? [])
    setAllBvs(bvData ?? [])
    setReminders(reminderData ?? [])
    setRecentEdits(recentList)
    setIsLoading(false)
    const loadDataMs = Math.round(performance.now() - loadStart)
    console.info(`[Startseite] loadData: ${loadDataMs}ms`)
    recordStartseiteMetrics(loadDataMs)
  }, [user?.id, isEnabled, recentEditsScope])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const unsub = subscribeToOrderChanges(loadData)
    return unsub
  }, [loadData])

  useEffect(() => {
    if (!user?.id || typeof localStorage === 'undefined') return
    try {
      const raw = localStorage.getItem(`${REMINDER_FILTER_STORAGE_KEY}_${user.id}`)
      if (raw === 'all' || raw === 'overdue' || raw === 'due7' || raw === 'due30') {
        setReminderFilter(raw)
      }
    } catch {
      /* ignore */
    }
  }, [user?.id])

  const handleReminderFilterChange = useCallback(
    (next: MaintenanceReminderDashboardFilter) => {
      setReminderFilter(next)
      if (user?.id && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`${REMINDER_FILTER_STORAGE_KEY}_${user.id}`, next)
        } catch {
          /* ignore */
        }
      }
    },
    [user?.id]
  )

  const handleReminderFilterKeyDown = useCallback(
    (e: KeyboardEvent, next: MaintenanceReminderDashboardFilter) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      handleReminderFilterChange(next)
    },
    [handleReminderFilterChange]
  )

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
  const filteredMaintenanceReminders = useMemo(
    () => filterMaintenanceRemindersForDashboard(reminders, reminderFilter),
    [reminders, reminderFilter]
  )
  const weekDates = getWeekDates()
  const ordersByWeekDay: Record<string, Order[]> = {}
  weekDates.forEach((d) => {
    ordersByWeekDay[d] = assignedOrders.filter((o) => o.order_date === d && o.status !== 'erledigt' && o.status !== 'storniert')
  })
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  const includeRecentMaster = isEnabled('kunden')
  const includeRecentOrders = isEnabled('auftrag')
  const dismissedRecentKeys = useMemo(
    () => new Set(dashboardLayout.dismissedRecentEditKeys ?? []),
    [dashboardLayout.dismissedRecentEditKeys]
  )
  const sortedRecentEdits = useMemo(() => {
    const fav = new Set(dashboardLayout.favoriteRecentEditKeys ?? [])
    const list = [...recentEdits]
    if (fav.size > 0) {
      list.sort((a, b) => {
        const af = fav.has(a.key) ? 0 : 1
        const bf = fav.has(b.key) ? 0 : 1
        if (af !== bf) return af - bf
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
    } else {
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }
    return list
  }, [recentEdits, dashboardLayout.favoriteRecentEditKeys])

  const visibleRecentEdits = useMemo(
    () => sortedRecentEdits.filter((item) => !dismissedRecentKeys.has(item.key)),
    [sortedRecentEdits, dismissedRecentKeys]
  )
  const showRecentEditsWidget =
    !!user &&
    !isLoading &&
    (includeRecentMaster || includeRecentOrders) &&
    isDashboardWidgetVisible(dashboardLayout, 'recentEdits') &&
    (recentEdits.length > 0 ||
      (dashboardLayout.dismissedRecentEditKeys?.length ?? 0) > 0 ||
      recentEditsScope === 'mine')

  const handleRecentDetailsToggle = useCallback(
    (open: boolean) => {
      updateRecentEditsOpen(open)
    },
    [updateRecentEditsOpen]
  )

  const handleDismissRecentClick = useCallback(
    (e: MouseEvent, key: string) => {
      e.preventDefault()
      e.stopPropagation()
      dismissRecentEdit(key)
    },
    [dismissRecentEdit]
  )

  return (
    <div className="p-4 min-w-0">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        {profile
          ? `Hallo, ${getProfileDisplayName(profile)}! Willkommen bei AMRtech Türen & Tore.`
          : 'Willkommen bei AMRtech Türen & Tore.'}
      </p>

      {getResolvedWidgetOrder(dashboardLayout).map((wid) => {
        if (!isDashboardWidgetVisible(dashboardLayout, wid)) return null
        switch (wid) {
          case 'zeiterfassung': {
            if (!user || !canUseZeiterfassung) return null
            return (
        <section key={wid} className="mt-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600" aria-labelledby="zeiterfassung-heading">
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
            )
          }
          case 'weekOrders': {
            if (!user || isLoading) return null
            return (
        <section key={wid} className="mt-6" aria-labelledby="kalender-woche-heading">
          <h3 id="kalender-woche-heading" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
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
            )
          }
          case 'maintenanceReminders': {
            if (!user || reminders.length === 0) return null
            return (
        <section key={wid} className="mt-6" aria-labelledby="wartung-faellig-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
            <h3 id="wartung-faellig-heading" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Wartung fällig / Erinnerungen
            </h3>
            <div className="text-xs text-slate-500 dark:text-slate-400 sm:max-w-xs sm:text-right">
              <p>Filter nach Dringlichkeit. Überfällig = Termin verpasst; Tage = Rest bis zur nächsten Wartung.</p>
              {isEnabled('kunden') && (
                <Link
                  to="/wartungsstatistik"
                  className="inline-block mt-2 text-sm font-medium text-vico-primary hover:underline focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 rounded dark:focus:ring-offset-slate-900"
                >
                  Wartungsstatistik →
                </Link>
              )}
            </div>
          </div>
          <div
            className="flex flex-wrap gap-2 mb-4"
            role="group"
            aria-label="Filter Wartungserinnerungen"
          >
            {(['all', 'overdue', 'due7', 'due30'] as const).map((key) => {
              const count = countMaintenanceRemindersByFilter(reminders, key)
              const isActive = reminderFilter === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleReminderFilterChange(key)}
                  onKeyDown={(e) => handleReminderFilterKeyDown(e, key)}
                  aria-pressed={isActive}
                  aria-label={`${MAINTENANCE_REMINDER_FILTER_LABELS[key]}, ${count} Einträge`}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                    isActive
                      ? 'bg-vico-primary text-white border-vico-primary'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {MAINTENANCE_REMINDER_FILTER_LABELS[key]}
                  <span
                    className={`tabular-nums rounded-full px-1.5 py-0.5 text-xs ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                    aria-hidden
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
          {filteredMaintenanceReminders.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400 py-4 px-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50">
              Keine Einträge für diesen Filter. Andere Filter wählen oder alle anzeigen.
            </p>
          ) : (
            <ul className="space-y-2" aria-label="Gefilterte Wartungserinnerungen">
              {filteredMaintenanceReminders.map((r) => {
                const objName = getObjectDisplayName({
                  name: r.object_name,
                  internal_id: r.internal_id,
                  room: r.object_room,
                  floor: r.object_floor,
                  manufacturer: r.object_manufacturer,
                })
                const urgencyBar =
                  r.status === 'overdue'
                    ? 'border-l-4 border-l-red-600'
                    : r.status === 'due_soon'
                      ? 'border-l-4 border-l-amber-500'
                      : 'border-l-4 border-l-slate-300 dark:border-l-slate-600'
                return (
                  <li key={r.object_id}>
                    <Link
                      to={`/kunden?customerId=${r.customer_id}&bvId=${r.bv_id}&objectId=${r.object_id}`}
                      className={`block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 p-4 pl-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${urgencyBar}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-800 dark:text-slate-100 flex-1 min-w-0">
                          {r.customer_name} → {r.bv_name}
                          {objName !== '–' && (
                            <span className="text-slate-600 dark:text-slate-400 font-normal"> · {objName}</span>
                          )}
                        </p>
                        {r.status === 'overdue' && (
                          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-white bg-red-600 px-2 py-0.5 rounded">
                            Überfällig
                          </span>
                        )}
                        {r.status === 'due_soon' && (
                          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-amber-950 bg-amber-400 px-2 py-0.5 rounded dark:text-amber-950">
                            Bald fällig
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        {r.status === 'overdue' ? (
                          <span className="text-red-700 dark:text-red-300 font-medium">
                            Handlungsbedarf
                            {r.last_maintenance_date
                              ? ` · letzte Wartung: ${r.last_maintenance_date}`
                              : ' · noch keine Wartung erfasst'}
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-200">
                            Fällig bis {r.next_maintenance_date ?? '—'}
                            {r.days_until_due != null && ` · noch ${r.days_until_due} Tag${r.days_until_due === 1 ? '' : 'e'}`}
                          </span>
                        )}
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
            )
          }
          case 'assignedOrders': {
            if (!user) return null
            return (
        <section key={wid} className="mt-6" aria-labelledby="meine-auftraege-heading">
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
            )
          }
          case 'recentEdits': {
            if (!showRecentEditsWidget) return null
            return (
        <section key={wid} className="mt-6" aria-label="Zuletzt bearbeitet">
          <details
            className="group rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40"
            open={dashboardLayout.recentEditsOpen ?? false}
            onToggle={(e) => {
              const el = e.currentTarget
              handleRecentDetailsToggle(el.open)
            }}
          >
            <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 px-4 py-3 font-semibold text-slate-800 dark:text-slate-100 select-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="text-slate-500 group-open:rotate-90 transition-transform inline-block">
                  ▸
                </span>
                Zuletzt bearbeitet
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  ({visibleRecentEdits.length}
                  {recentEdits.length !== visibleRecentEdits.length ? ` / ${recentEdits.length}` : ''})
                </span>
              </span>
              {!isOnline() && (
                <span className="text-xs font-normal text-amber-700 dark:text-amber-300">Offline · Cache</span>
              )}
            </summary>
            <div className="px-4 pb-4 pt-0 border-t border-slate-200/80 dark:border-slate-600/80">
              {includeRecentOrders && (
                <div className="mt-3 mb-3 flex flex-wrap gap-2 items-center" role="group" aria-label="Filter Zuletzt bearbeitet">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Anzeige:</span>
                  <button
                    type="button"
                    onClick={() => updateRecentEditsScope('all')}
                    className={`px-2 py-1 rounded text-sm border focus:outline-none focus:ring-2 focus:ring-vico-primary ${
                      recentEditsScope === 'all'
                        ? 'border-vico-primary bg-vico-primary/10 text-vico-primary font-medium'
                        : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                    }`}
                    aria-pressed={recentEditsScope === 'all'}
                  >
                    Alle
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRecentEditsScope('mine')}
                    className={`px-2 py-1 rounded text-sm border focus:outline-none focus:ring-2 focus:ring-vico-primary ${
                      recentEditsScope === 'mine'
                        ? 'border-vico-primary bg-vico-primary/10 text-vico-primary font-medium'
                        : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                    }`}
                    aria-pressed={recentEditsScope === 'mine'}
                  >
                    Nur meine Aufträge
                  </button>
                </div>
              )}
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 mb-3">
                {recentEditsScope === 'mine'
                  ? 'Nur Aufträge, bei denen Sie erstellend oder zugewiesen sind. Kunden/BV/Objekte ohne Bearbeiter-Zeitstempel erscheinen bei „Alle“.'
                  : 'Sortiert nach letzter Änderung (Kunden, Objekt/BV, Tür/Tor, Auftrag). Favoriten (Stern) oben. „Ausblenden“ blendet nur hier ab – keine Daten werden gelöscht.'}
              </p>
              {(dashboardLayout.dismissedRecentEditKeys?.length ?? 0) > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resetDismissedRecentEdits}
                    className="text-sm font-medium text-vico-primary hover:underline focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 rounded px-1 dark:focus:ring-offset-slate-900"
                    aria-label="Alle ausgeblendeten Zuletzt-bearbeitet-Einträge wieder anzeigen"
                  >
                    Ausgeblendete zurücksetzen
                  </button>
                </div>
              )}
              {visibleRecentEdits.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400 py-2">
                  Alle Einträge sind ausgeblendet oder es gibt keine passenden Daten.
                </p>
              ) : (
                <ul className="space-y-2" aria-label="Zuletzt bearbeitete Einträge">
                  {visibleRecentEdits.map((item) => {
                    const isFav = (dashboardLayout.favoriteRecentEditKeys ?? []).includes(item.key)
                    return (
                    <li key={item.key}>
                      <div className="flex gap-2 items-stretch">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            toggleFavoriteRecentEdit(item.key)
                          }}
                          className="shrink-0 self-center px-2 py-2 rounded-lg text-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                          aria-label={isFav ? 'Favorit entfernen' : 'Als Favorit markieren'}
                          aria-pressed={isFav}
                          title={isFav ? 'Favorit' : 'Favorit'}
                        >
                          {isFav ? '★' : '☆'}
                        </button>
                        <Link
                          to={item.to}
                          className="flex-1 min-w-0 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                        >
                          <p className="font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Geändert {formatDateTimeShort(item.updatedAt)}
                            {item.subtitle ? ` · ${item.subtitle}` : ''}
                          </p>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => handleDismissRecentClick(e, item.key)}
                          className="shrink-0 self-center px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                          aria-label={`Eintrag ausblenden: ${item.title}`}
                        >
                          Ausblenden
                        </button>
                      </div>
                    </li>
                  )})}
                </ul>
              )}
            </div>
          </details>
        </section>
            )
          }
          default:
            return null
        }
      })}
    </div>
  )
}

export default Startseite
