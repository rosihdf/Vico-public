/**
 * Layout der Startseite (Widgets sichtbar/versteckt, Zuletzt-bearbeitet-Zustand).
 * Speicherung: `profiles.dashboard_layout` (Multi-Gerät) + localStorage als Offline-Cache.
 */

export type DashboardWidgetId =
  | 'zeiterfassung'
  | 'weekOrders'
  | 'maintenanceReminders'
  | 'assignedOrders'
  | 'recentEdits'

export type DashboardLayoutStored = {
  /** Sichtbarkeit; fehlende Keys = Standard sichtbar */
  widgets: Partial<Record<DashboardWidgetId, boolean>>
  /** Reihenfolge der Widgets auf der Startseite (von oben nach unten); fehlend = Standardreihenfolge */
  widgetOrder?: DashboardWidgetId[]
  /** Ob „Zuletzt bearbeitet“ aufgeklappt ist (nur wenn Widget sichtbar) */
  recentEditsOpen?: boolean
  /** Aus der Liste entfernte Einträge (nur Anzeige, kein Löschen in der DB) */
  dismissedRecentEditKeys?: string[]
  /** „Nur meine Aufträge“: nur Aufträge mit Zuweisung/Erstellung durch den aktuellen Nutzer (kein Stammdaten-Filter ohne Audit) */
  recentEditsScope?: 'all' | 'mine'
  /** Favoriten (oben sortiert); Keys wie bei Zuletzt bearbeitet */
  favoriteRecentEditKeys?: string[]
}

const STORAGE_VERSION = 1
const storageKey = (userId: string) => `vico_dashboard_layout_v${STORAGE_VERSION}_${userId}`

export const DASHBOARD_WIDGET_OPTIONS: {
  id: DashboardWidgetId
  label: string
  description: string
}[] = [
  {
    id: 'zeiterfassung',
    label: 'Arbeitszeit',
    description: 'Stempeln (Start/Pause/Ende) und Link zur Zeiterfassung',
  },
  {
    id: 'weekOrders',
    label: 'Aufträge diese Woche',
    description: 'Wochenübersicht mit Status-Kurzinfos',
  },
  {
    id: 'maintenanceReminders',
    label: 'Wartung fällig / Erinnerungen',
    description: 'Liste der Wartungserinnerungen (wenn Daten vorhanden)',
  },
  {
    id: 'assignedOrders',
    label: 'Meine zugewiesenen Aufträge',
    description: 'Aktive Aufträge, die Ihnen zugewiesen sind',
  },
  {
    id: 'recentEdits',
    label: 'Zuletzt bearbeitet',
    description: 'Zuletzt geänderte Kunden, BV, Objekte und Aufträge',
  },
]

export const DEFAULT_WIDGET_VISIBLE: Record<DashboardWidgetId, boolean> = {
  zeiterfassung: true,
  weekOrders: true,
  maintenanceReminders: true,
  assignedOrders: true,
  recentEdits: true,
}

const KNOWN_WIDGET_IDS: DashboardWidgetId[] = DASHBOARD_WIDGET_OPTIONS.map((o) => o.id)

/** Aufgelöste Reihenfolge (alle bekannten IDs, keine Duplikate); fehlende aus Standard angehängt */
export const getResolvedWidgetOrder = (layout: DashboardLayoutStored): DashboardWidgetId[] => {
  const raw = layout.widgetOrder
  const base =
    raw && raw.length > 0
      ? raw.filter((id): id is DashboardWidgetId =>
          KNOWN_WIDGET_IDS.includes(id as DashboardWidgetId)
        )
      : [...KNOWN_WIDGET_IDS]
  const seen = new Set<DashboardWidgetId>()
  const merged: DashboardWidgetId[] = []
  for (const id of base) {
    if (!seen.has(id)) {
      seen.add(id)
      merged.push(id)
    }
  }
  for (const id of KNOWN_WIDGET_IDS) {
    if (!seen.has(id)) merged.push(id)
  }
  return merged
}

export const isDashboardWidgetVisible = (
  layout: DashboardLayoutStored,
  id: DashboardWidgetId
): boolean => {
  const v = layout.widgets[id]
  if (v === undefined) return DEFAULT_WIDGET_VISIBLE[id]
  return v
}

/** Parst JSON aus Supabase / API; bei Fehler `null`. */
export const parseDashboardLayoutFromUnknown = (raw: unknown): DashboardLayoutStored | null => {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const widgetsRaw = o.widgets
  const widgets =
    widgetsRaw && typeof widgetsRaw === 'object'
      ? (widgetsRaw as Partial<Record<DashboardWidgetId, boolean>>)
      : {}
  const dismissed =
    Array.isArray(o.dismissedRecentEditKeys) &&
    o.dismissedRecentEditKeys.every((k) => typeof k === 'string')
      ? (o.dismissedRecentEditKeys as string[])
      : undefined
  let widgetOrder: DashboardWidgetId[] | undefined
  if (Array.isArray(o.widgetOrder)) {
    const filtered = o.widgetOrder.filter(
      (k): k is DashboardWidgetId =>
        typeof k === 'string' && KNOWN_WIDGET_IDS.includes(k as DashboardWidgetId)
    )
    widgetOrder = filtered.length > 0 ? filtered : undefined
  }
  const scopeRaw = o.recentEditsScope
  const recentEditsScope =
    scopeRaw === 'all' || scopeRaw === 'mine' ? scopeRaw : undefined
  const favRaw = o.favoriteRecentEditKeys
  const favoriteRecentEditKeys =
    Array.isArray(favRaw) && favRaw.every((k) => typeof k === 'string') ? favRaw : undefined
  return {
    widgets,
    widgetOrder,
    recentEditsOpen: typeof o.recentEditsOpen === 'boolean' ? o.recentEditsOpen : undefined,
    dismissedRecentEditKeys: dismissed,
    recentEditsScope,
    favoriteRecentEditKeys,
  }
}

export const loadDashboardLayout = (userId: string | null): DashboardLayoutStored => {
  if (!userId || typeof localStorage === 'undefined') {
    return { widgets: {} }
  }
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return { widgets: {} }
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return { widgets: {} }
    const o = parsed as Record<string, unknown>
    const widgets = (o.widgets && typeof o.widgets === 'object' ? o.widgets : {}) as Partial<
      Record<DashboardWidgetId, boolean>
    >
    const dismissed =
      Array.isArray(o.dismissedRecentEditKeys) &&
      o.dismissedRecentEditKeys.every((k) => typeof k === 'string')
        ? (o.dismissedRecentEditKeys as string[])
        : undefined
    let widgetOrder: DashboardWidgetId[] | undefined
    if (Array.isArray(o.widgetOrder)) {
      const filtered = o.widgetOrder.filter(
        (k): k is DashboardWidgetId =>
          typeof k === 'string' && KNOWN_WIDGET_IDS.includes(k as DashboardWidgetId)
      )
      widgetOrder = filtered.length > 0 ? filtered : undefined
    }
    const scopeRaw = o.recentEditsScope
    const recentEditsScope =
      scopeRaw === 'all' || scopeRaw === 'mine' ? scopeRaw : undefined
    const favRaw = o.favoriteRecentEditKeys
    const favoriteRecentEditKeys =
      Array.isArray(favRaw) && favRaw.every((k) => typeof k === 'string') ? favRaw : undefined
    return {
      widgets,
      widgetOrder,
      recentEditsOpen: typeof o.recentEditsOpen === 'boolean' ? o.recentEditsOpen : undefined,
      dismissedRecentEditKeys: dismissed,
      recentEditsScope,
      favoriteRecentEditKeys,
    }
  } catch {
    return { widgets: {} }
  }
}

const notifyDashboardLayoutChanged = (userId: string) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<{ userId: string }>('vico-dashboard-layout-changed', { detail: { userId } })
  )
}

export const saveDashboardLayout = (userId: string, layout: DashboardLayoutStored): void => {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(layout))
    notifyDashboardLayoutChanged(userId)
  } catch {
    /* Quota oder Private Mode */
  }
}

export const setWidgetVisible = (
  userId: string,
  prev: DashboardLayoutStored,
  id: DashboardWidgetId,
  visible: boolean
): DashboardLayoutStored => {
  const next: DashboardLayoutStored = {
    ...prev,
    widgets: { ...prev.widgets, [id]: visible },
  }
  saveDashboardLayout(userId, next)
  return next
}

export const moveWidgetInOrder = (
  userId: string,
  prev: DashboardLayoutStored,
  id: DashboardWidgetId,
  direction: 'up' | 'down'
): DashboardLayoutStored => {
  const order = getResolvedWidgetOrder(prev)
  const idx = order.indexOf(id)
  if (idx < 0) return prev
  const swapWith = direction === 'up' ? idx - 1 : idx + 1
  if (swapWith < 0 || swapWith >= order.length) return prev
  const nextOrder = [...order]
  ;[nextOrder[idx], nextOrder[swapWith]] = [nextOrder[swapWith], nextOrder[idx]]
  const next: DashboardLayoutStored = { ...prev, widgetOrder: nextOrder }
  saveDashboardLayout(userId, next)
  return next
}

export const setRecentEditsOpen = (
  userId: string,
  prev: DashboardLayoutStored,
  open: boolean
): DashboardLayoutStored => {
  const next: DashboardLayoutStored = { ...prev, recentEditsOpen: open }
  saveDashboardLayout(userId, next)
  return next
}

export const dismissRecentEditKey = (
  userId: string,
  prev: DashboardLayoutStored,
  key: string
): DashboardLayoutStored => {
  const set = new Set(prev.dismissedRecentEditKeys ?? [])
  set.add(key)
  const next: DashboardLayoutStored = {
    ...prev,
    dismissedRecentEditKeys: [...set],
  }
  saveDashboardLayout(userId, next)
  return next
}

export const clearDismissedRecentEdits = (userId: string, prev: DashboardLayoutStored): DashboardLayoutStored => {
  const next: DashboardLayoutStored = { ...prev, dismissedRecentEditKeys: [] }
  saveDashboardLayout(userId, next)
  return next
}

export const setRecentEditsScope = (
  userId: string,
  prev: DashboardLayoutStored,
  scope: 'all' | 'mine'
): DashboardLayoutStored => {
  const next: DashboardLayoutStored = { ...prev, recentEditsScope: scope }
  saveDashboardLayout(userId, next)
  return next
}

export const toggleFavoriteRecentEditKey = (
  userId: string,
  prev: DashboardLayoutStored,
  key: string
): DashboardLayoutStored => {
  const cur = new Set(prev.favoriteRecentEditKeys ?? [])
  if (cur.has(key)) cur.delete(key)
  else cur.add(key)
  const next: DashboardLayoutStored = { ...prev, favoriteRecentEditKeys: [...cur] }
  saveDashboardLayout(userId, next)
  return next
}
