import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import {
  fetchOrders,
  createOrder,
  updateOrder,
  updateOrderStatus,
  updateOrderAssignedTo,
  updateOrderDate,
  deleteOrder,
  fetchCustomers,
  fetchAllBvs,
  fetchBvs,
  fetchObjects,
  fetchObjectsDirectUnderCustomer,
  fetchAllObjects,
  fetchCompletionByOrderId,
  fetchPruefprotokollPdfPathForOrderObject,
  getMaintenancePhotoUrl,
} from './lib/dataService'
import { isOnline } from '../shared/networkUtils'
import { subscribeToOrderChanges } from './lib/orderRealtime'
import { subscribeToProfileChanges } from './lib/profileRealtime'
import { fetchProfiles, getProfileDisplayName } from './lib/userService'
import { getObjectDisplayName } from './lib/objectUtils'
import {
  findActiveOrderConflictsAmong,
  getOrderObjectIds,
  isOrderActivePerObjectError,
  type ActiveOrderObjectConflict,
} from './lib/orderUtils'
import { OrderCalendar } from './components/OrderCalendar'
import { LoadingSpinner } from './components/LoadingSpinner'
import ConfirmDialog from './components/ConfirmDialog'
import PdfPreviewOverlay, { type PdfPreviewState } from './components/PdfPreviewOverlay'
import OrderActiveConflictCallout from './components/OrderActiveConflictCallout'
import EmptyState from '../shared/EmptyState'
import { useLicense } from './LicenseContext'
import { isAssignedChannelReleaseAtLeast } from './lib/releaseGate'
import type { Order, Customer, BV, Object as Obj, OrderType, OrderStatus } from './types'
import type { Profile } from './lib/userService'

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

type OrderFormState = {
  customer_id: string
  bv_id: string
  selectedObjectIds: string[]
  order_date: string
  order_time: string
  order_type: OrderType
  status: OrderStatus
  description: string
  assigned_to: string
}

const INITIAL_FORM: OrderFormState = {
  customer_id: '',
  bv_id: '',
  selectedObjectIds: [],
  order_date: new Date().toISOString().slice(0, 10),
  order_time: '',
  order_type: 'wartung',
  status: 'offen',
  description: '',
  assigned_to: '',
}

const orderToFormState = (o: Order): OrderFormState => ({
  customer_id: o.customer_id,
  bv_id: o.bv_id ?? '',
  selectedObjectIds: getOrderObjectIds(o),
  order_date: o.order_date,
  order_time: o.order_time ?? '',
  order_type: o.order_type,
  status: o.status,
  description: o.description ?? '',
  assigned_to: o.assigned_to ?? '',
})

/** Direkt Tür/Tor-Modal ohne Kundenliste; nach Schließen zurück zu Aufträgen (oder returnTo). */
const buildObjektBearbeitenUrl = (o: Order): string => {
  const ids = getOrderObjectIds(o)
  const firstId = ids[0] ?? o.object_id
  if (!firstId) {
    const params = new URLSearchParams()
    params.set('customerId', o.customer_id)
    params.set('returnTo', '/auftrag')
    if (o.bv_id) params.set('bvId', o.bv_id)
    return `/kunden?${params.toString()}`
  }
  const params = new URLSearchParams()
  params.set('returnTo', '/auftrag')
  return `/objekt/${firstId}/bearbeiten?${params.toString()}`
}

const AuftragAnlegen = () => {
  const { user, userRole } = useAuth()
  const { mandantenReleases } = useLicense()
  const { showError } = useToast()
  const isRelease110Enabled = isAssignedChannelReleaseAtLeast(mandantenReleases, '1.1.0')
  const canAssign = userRole === 'admin'
  const canEdit = userRole === 'admin' || userRole === 'mitarbeiter'
  const canBuchhaltungExport =
    userRole === 'admin' || userRole === 'mitarbeiter' || userRole === 'teamleiter'
  const [orders, setOrders] = useState<Order[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [allBvs, setAllBvs] = useState<BV[]>([])
  const [allObjects, setAllObjects] = useState<Obj[]>([])
  const [bvs, setBvs] = useState<BV[]>([])
  const [objectsUnderBv, setObjectsUnderBv] = useState<Obj[]>([])
  const [directObjects, setDirectObjects] = useState<Obj[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [archiveMode, setArchiveMode] = useState<'active' | 'archive'>('active')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [formData, setFormData] = useState<OrderFormState>(INITIAL_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })
  const [pdfViewer, setPdfViewer] = useState<PdfPreviewState>(null)
  const [berichteLoadingOrderId, setBerichteLoadingOrderId] = useState<string | null>(null)
  /** Server-/Cache-Abweichung: Konflikt erst nach Speichern erkannt */
  const [serverConflictDoors, setServerConflictDoors] = useState<ActiveOrderObjectConflict[] | null>(null)

  const handleCloseForm = useCallback(() => {
    setShowForm(false)
    setFormError(null)
    setFormMode('create')
    setEditingOrderId(null)
    setServerConflictDoors(null)
  }, [])

  const handleClosePdfViewer = () => {
    setPdfViewer((prev) => {
      if (prev?.revokeOnClose && prev.url.startsWith('blob:')) {
        URL.revokeObjectURL(prev.url)
      }
      return null
    })
  }

  const handleListMonteursbericht = async (o: Order) => {
    setBerichteLoadingOrderId(o.id)
    try {
      const comp = await fetchCompletionByOrderId(o.id)
      const path = comp?.monteur_pdf_path?.trim()
      if (!path) {
        showError('Noch kein Monteursbericht-PDF. Öffnen Sie den Auftrag und tippen Sie auf „Monteursbericht“.')
        return
      }
      setPdfViewer({
        url: getMaintenancePhotoUrl(path),
        title: 'Monteursbericht',
        revokeOnClose: false,
      })
    } finally {
      setBerichteLoadingOrderId(null)
    }
  }

  const handleListPruefprotokoll = async (o: Order, objectId: string) => {
    if (!isOnline()) {
      showError('Prüfprotokoll ist nur mit Verbindung abrufbar.')
      return
    }
    setBerichteLoadingOrderId(o.id)
    try {
      const path = await fetchPruefprotokollPdfPathForOrderObject(o.id, objectId)
      if (!path) {
        showError('Kein gespeichertes Prüfprotokoll für diese Tür. Ggf. Auftrag noch nicht abgeschlossen.')
        return
      }
      const obj = allObjects.find((x) => x.id === objectId)
      const label = obj ? getObjectDisplayName(obj) : objectId.slice(0, 8)
      setPdfViewer({
        url: getMaintenancePhotoUrl(path),
        title: `Prüfprotokoll – ${label}`,
        revokeOnClose: false,
      })
    } finally {
      setBerichteLoadingOrderId(null)
    }
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const [orderData, customerData, bvData, profileData, objectData] = await Promise.all([
      fetchOrders(),
      fetchCustomers(),
      fetchAllBvs(),
      fetchProfiles(),
      fetchAllObjects(),
    ])
    setOrders(orderData ?? [])
    setCustomers(customerData ?? [])
    setAllBvs(bvData ?? [])
    setProfiles(profileData ?? [])
    setAllObjects(objectData ?? [])
    setIsLoading(false)
  }, [])

  const loadBvsForCustomer = useCallback(async (customerId: string) => {
    if (!customerId) {
      setBvs([])
      setObjectsUnderBv([])
      setDirectObjects([])
      return
    }
    const bvData = await fetchBvs(customerId)
    setBvs(bvData ?? [])
    setObjectsUnderBv([])
    if (!bvData?.length) {
      const direct = await fetchObjectsDirectUnderCustomer(customerId)
      setDirectObjects(direct ?? [])
    } else {
      setDirectObjects([])
    }
  }, [])

  const loadObjectsForBv = useCallback(async (bvId: string) => {
    if (!bvId) {
      setObjectsUnderBv([])
      return
    }
    const objData = await fetchObjects(bvId)
    setObjectsUnderBv(objData ?? [])
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const unsubOrders = subscribeToOrderChanges(loadData)
    const unsubProfiles = subscribeToProfileChanges(loadData)
    return () => {
      unsubOrders()
      unsubProfiles()
    }
  }, [loadData])

  useEffect(() => {
    const handleProfilesChanged = () => loadData()
    window.addEventListener('vico-profiles-changed', handleProfilesChanged)
    return () => window.removeEventListener('vico-profiles-changed', handleProfilesChanged)
  }, [loadData])

  useEffect(() => {
    if (formData.customer_id) loadBvsForCustomer(formData.customer_id)
  }, [formData.customer_id, loadBvsForCustomer])

  useEffect(() => {
    if (bvs.length === 1 && formData.customer_id) {
      setFormData((prev) =>
        prev.bv_id === bvs[0].id ? prev : { ...prev, bv_id: bvs[0].id, selectedObjectIds: [] }
      )
    }
    if (bvs.length !== 1 && formData.bv_id) {
      const stillValid = bvs.some((b) => b.id === formData.bv_id)
      if (!stillValid) setFormData((prev) => ({ ...prev, bv_id: '', selectedObjectIds: [] }))
    }
  }, [bvs, formData.customer_id, formData.bv_id])

  useEffect(() => {
    if (formData.bv_id) loadObjectsForBv(formData.bv_id)
  }, [formData.bv_id, loadObjectsForBv])

  useEffect(() => {
    if (!showForm) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseForm()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showForm, handleCloseForm])

  const orderObjectSummary = useCallback(
    (o: Order) => {
      const ids = getOrderObjectIds(o)
      if (ids.length === 0) return null
      if (ids.length === 1) {
        const obj = allObjects.find((x) => x.id === ids[0])
        return ` · ${obj ? getObjectDisplayName(obj) : ids[0].slice(0, 8)}`
      }
      return ` · ${ids.length} Türen/Tore`
    },
    [allObjects]
  )

  const getCustomerName = (id: string) => customers.find((c) => c.id === id)?.name ?? '-'
  const getBvName = (id: string | null | undefined) => {
    if (!id) return '—'
    return allBvs.find((b) => b.id === id)?.name ?? '-'
  }
  const profilesAssignable = profiles.filter((p) => p.role !== 'demo' && p.role !== 'kunde')
  const getProfileLabel = (id: string | null) => {
    if (!id) return '-'
    const p = profiles.find((p) => p.id === id)
    if (!p) return id.slice(0, 8)
    return p.first_name || p.last_name
      ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
      : (p.email ?? id.slice(0, 8))
  }

  const handleOpenCreate = () => {
    setFormMode('create')
    setEditingOrderId(null)
    setFormData(INITIAL_FORM)
    setFormError(null)
    setServerConflictDoors(null)
    setShowForm(true)
  }

  const handleOpenEdit = (o: Order) => {
    setFormMode('edit')
    setEditingOrderId(o.id)
    setFormData(orderToFormState(o))
    setFormError(null)
    setServerConflictDoors(null)
    setShowForm(true)
  }

  const handleFormChange = (field: keyof OrderFormState, value: string | OrderType | OrderStatus) => {
    if (field === 'customer_id' || field === 'bv_id' || field === 'status') {
      setServerConflictDoors(null)
    }
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'customer_id') {
        next.bv_id = ''
        next.selectedObjectIds = []
      }
      if (field === 'bv_id') next.selectedObjectIds = []
      return next
    })
  }

  const handleToggleObject = (objectId: string) => {
    setServerConflictDoors(null)
    setFormData((prev) => {
      const has = prev.selectedObjectIds.includes(objectId)
      const selectedObjectIds = has
        ? prev.selectedObjectIds.filter((id) => id !== objectId)
        : [...prev.selectedObjectIds, objectId]
      return { ...prev, selectedObjectIds }
    })
  }

  const showBvSelect = bvs.length > 1
  const singleBv = bvs.length === 1 ? bvs[0] : null
  const effectiveBvId = bvs.length === 0 ? null : formData.bv_id || singleBv?.id || null
  const pickerObjects = bvs.length > 0 ? objectsUnderBv : directObjects
  const hasDoorsToPick = pickerObjects.length > 0

  const showTuerTorSection =
    !!formData.customer_id &&
    (bvs.length === 0 || !!effectiveBvId)

  /** Zuweisung erst, wenn Tür/Tor gewählt – oder wenn es keine Türen zur Auswahl gibt. */
  const showZuweisungSection =
    showTuerTorSection && (!hasDoorsToPick || formData.selectedObjectIds.length > 0)

  const doorsRequirementMet = !hasDoorsToPick || formData.selectedObjectIds.length > 0

  const canSubmitOrder =
    !!formData.customer_id &&
    (bvs.length === 0 || !!effectiveBvId) &&
    doorsRequirementMet

  const activeDoorConflicts = useMemo(() => {
    if (!showForm || !canEdit) return []
    const exclude = formMode === 'edit' && editingOrderId ? editingOrderId : null
    return findActiveOrderConflictsAmong(
      orders,
      exclude,
      formData.selectedObjectIds,
      formData.status
    )
  }, [showForm, canEdit, formMode, editingOrderId, orders, formData.selectedObjectIds, formData.status])

  const saveBlockedByDoorConflict =
    activeDoorConflicts.length > 0 &&
    (formData.status === 'offen' || formData.status === 'in_bearbeitung')

  const conflictCalloutRows =
    serverConflictDoors ?? (saveBlockedByDoorConflict ? activeDoorConflicts : [])

  const resolveConflictDoorLabel = useCallback(
    (objectId: string) => {
      const obj =
        pickerObjects.find((x) => x.id === objectId) ?? allObjects.find((x) => x.id === objectId)
      return obj ? getObjectDisplayName(obj) : `Tür ${objectId.slice(0, 8)}…`
    },
    [pickerObjects, allObjects]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setServerConflictDoors(null)
    if (!formData.customer_id || (bvs.length > 0 && !effectiveBvId)) {
      setFormError(
        bvs.length === 0
          ? 'Kunde ist erforderlich.'
          : 'Kunde und Objekt/BV sind erforderlich.'
      )
      return
    }
    if (!formData.order_date) {
      setFormError('Datum ist erforderlich.')
      return
    }
    if (pickerObjects.length > 0 && formData.selectedObjectIds.length === 0) {
      setFormError('Bitte mindestens eine Tür/Tor auswählen.')
      return
    }
    setIsSaving(true)
    const object_ids = formData.selectedObjectIds
    const object_id = object_ids[0] ?? null

    if (formMode === 'edit' && editingOrderId) {
      const { error } = await updateOrder(editingOrderId, {
        customer_id: formData.customer_id,
        bv_id: effectiveBvId,
        object_ids,
        order_date: formData.order_date,
        order_time: formData.order_time.trim() || null,
        order_type: formData.order_type,
        status: formData.status,
        description: formData.description.trim() || null,
        assigned_to: formData.assigned_to.trim() || null,
      })
      setIsSaving(false)
      if (error) {
        if (isOrderActivePerObjectError(error)) {
          setServerConflictDoors(error.conflicts)
          setFormError(error.message)
          showError(error.message)
          return
        }
        const msg = getSupabaseErrorMessage(error)
        setFormError(msg)
        showError(msg)
        return
      }
      handleCloseForm()
      loadData()
      return
    }

    const payload = {
      customer_id: formData.customer_id,
      bv_id: effectiveBvId,
      object_id,
      object_ids: object_ids.length > 0 ? object_ids : null,
      order_date: formData.order_date,
      order_time: formData.order_time.trim() || null,
      order_type: formData.order_type,
      status: formData.status,
      description: formData.description.trim() || null,
      assigned_to: formData.assigned_to.trim() || null,
    }
    const { data, error } = await createOrder(payload, user?.id ?? null)
    setIsSaving(false)
    if (error) {
      if (isOrderActivePerObjectError(error)) {
        setServerConflictDoors(error.conflicts)
        setFormError(error.message)
        showError(error.message)
        return
      }
      const msg = getSupabaseErrorMessage(error)
      setFormError(msg)
      showError(msg)
      return
    }
    if (data) {
      handleCloseForm()
      loadData()
    }
  }

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    const { error } = await updateOrderStatus(order.id, newStatus)
    if (error) showError(getSupabaseErrorMessage(error))
    else loadData()
  }

  const handleAssignmentChange = async (order: Order, assignedTo: string) => {
    const { error } = await updateOrderAssignedTo(order.id, assignedTo.trim() || null)
    if (error) showError(getSupabaseErrorMessage(error))
    else loadData()
  }

  const handleDateChange = async (order: Order, newDate: string) => {
    const { error } = await updateOrderDate(order.id, newDate)
    if (error) showError(getSupabaseErrorMessage(error))
    else loadData()
  }

  const handleDelete = async (order: Order) => {
    const { error } = await deleteOrder(order.id)
    if (error) showError(getSupabaseErrorMessage(error))
    else loadData()
  }

  const statusFilter = archiveMode === 'active'
    ? (o: Order) => o.status === 'offen' || o.status === 'in_bearbeitung'
    : (o: Order) => o.status === 'erledigt' || o.status === 'storniert'

  const filteredByRole =
    userRole === 'admin' || userRole === 'leser'
      ? orders
      : user
        ? orders.filter((o) => o.assigned_to === user.id)
        : []

  const displayOrders = filteredByRole.filter(statusFilter)
  const ordersWithNames = displayOrders.map((o) => ({
    ...o,
    customerName: getCustomerName(o.customer_id),
    bvName: getBvName(o.bv_id),
  }))

  return (
    <div className="p-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Aufträge</h2>
          {canBuchhaltungExport && (
            <Link
              to="/buchhaltung-export"
              className="mt-1 inline-block text-sm font-medium text-vico-primary hover:underline focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 rounded dark:focus:ring-offset-slate-900"
            >
              Buchhaltungs-Export (CSV) →
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
            <button
              type="button"
              onClick={() => setArchiveMode('active')}
              className={`px-3 py-2 text-sm font-medium ${
                archiveMode === 'active'
                  ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              Aktive
            </button>
            <button
              type="button"
              onClick={() => setArchiveMode('archive')}
              className={`px-3 py-2 text-sm font-medium ${
                archiveMode === 'archive'
                  ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              Archiv
            </button>
          </div>
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === 'list'
                  ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              Liste
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === 'calendar'
                  ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              Kalender
            </button>
          </div>
          {canEdit && archiveMode === 'active' && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 font-medium border border-slate-300 dark:border-slate-600"
            >
              + Auftrag anlegen
            </button>
          )}
        </div>
      </div>

      {viewMode === 'calendar' && (
        <div className="mb-6">
          <OrderCalendar
            orders={displayOrders}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            currentMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
            getCustomerName={getCustomerName}
            getBvName={getBvName}
          />
        </div>
      )}

      {viewMode === 'list' && (isLoading ? (
        <LoadingSpinner message="Lade Aufträge…" className="py-8" />
      ) : displayOrders.length === 0 ? (
        <EmptyState
          title={archiveMode === 'archive' ? 'Keine archivierten Aufträge.' : 'Noch keine Aufträge.'}
          description={archiveMode === 'active' ? 'Klicke auf „Auftrag anlegen“, um zu starten.' : 'Erledigte und stornierte Aufträge erscheinen hier.'}
          className="py-8"
        />
      ) : (
        <ul className="space-y-2">
          {ordersWithNames.map((o) => (
            <li
              key={o.id}
              className={`rounded-lg border p-4 flex flex-col gap-3 ${
                !o.assigned_to
                  ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 border-l-4 border-l-amber-500'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600'
              }`}
            >
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {o.customerName} → {o.bvName}
                  {!o.assigned_to && (
                    <span className="ml-2 text-sm font-normal text-amber-700 dark:text-amber-300">(nicht zugewiesen)</span>
                  )}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {o.order_date}{o.order_time ? ` ${o.order_time.slice(0, 5)}` : ''} · {ORDER_TYPE_LABELS[o.order_type]} · {ORDER_STATUS_LABELS[o.status]}
                  {orderObjectSummary(o)}
                  {o.assigned_to && (
                    <span className="ml-2 text-slate-500 dark:text-slate-400">→ {getProfileLabel(o.assigned_to)}</span>
                  )}
                </p>
                {o.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate max-w-md">{o.description}</p>
                )}
              </div>
              <div className="flex flex-nowrap gap-2 overflow-x-auto pb-0.5 w-full items-center justify-end">
                {o.status === 'erledigt' && (
                  <>
                    <button
                      type="button"
                      disabled={berichteLoadingOrderId === o.id}
                      onClick={() => void handleListMonteursbericht(o)}
                      className="px-3 py-1.5 text-sm shrink-0 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                      title="Gespeicherten Monteursbericht anzeigen"
                    >
                      Monteursbericht
                    </button>
                    {o.order_type === 'wartung'
                      ? getOrderObjectIds(o)
                          .filter(Boolean)
                          .map((oid) => {
                            const obj = allObjects.find((x) => x.id === oid)
                            return (
                              <button
                                key={oid}
                                type="button"
                                disabled={berichteLoadingOrderId === o.id}
                                onClick={() => void handleListPruefprotokoll(o, oid)}
                                className="px-3 py-1.5 text-sm shrink-0 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 max-w-[140px] truncate"
                                title={`Prüfprotokoll anzeigen: ${obj ? getObjectDisplayName(obj) : oid.slice(0, 8)}`}
                                aria-label={`Prüfprotokoll anzeigen: ${obj ? getObjectDisplayName(obj) : oid.slice(0, 8)}`}
                              >
                                Prüfprotokoll
                              </button>
                            )
                          })
                      : null}
                  </>
                )}
                {canAssign && archiveMode === 'active' && (
                  <select
                    value={profilesAssignable.some((p) => p.id === o.assigned_to) ? o.assigned_to ?? '' : ''}
                    onChange={(e) => handleAssignmentChange(o, e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg min-w-[140px] shrink-0 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    title="Nutzer zuweisen"
                    aria-label="Nutzer zuweisen"
                  >
                    <option value="">— Zuweisen —</option>
                    {profilesAssignable.map((p) => (
                      <option key={p.id} value={p.id}>
                        {getProfileDisplayName(p)}
                        {(p.first_name || p.last_name) && p.email ? ` (${p.email})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {canEdit && archiveMode === 'active' && (
                  <>
                    <input
                      type="date"
                      value={o.order_date}
                      onChange={(e) => handleDateChange(o, e.target.value)}
                      className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg max-w-[140px] shrink-0 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                      title="Termin ändern"
                      aria-label="Termin ändern"
                    />
                    <select
                      value={o.status}
                      onChange={(e) => handleStatusChange(o, e.target.value as OrderStatus)}
                      className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg shrink-0 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                      aria-label="Auftragsstatus"
                    >
                      {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {ORDER_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {canEdit && archiveMode === 'active' && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(o)}
                    className="px-3 py-1.5 text-sm shrink-0 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Bearbeiten
                  </button>
                )}
                <Link
                  to={`/auftrag/${o.id}`}
                  className="px-3 py-1.5 text-sm shrink-0 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-block text-center"
                  aria-label={o.status === 'erledigt' ? 'Erledigten Auftrag ansehen' : 'Auftrag bearbeiten'}
                >
                  {o.status === 'erledigt' ? 'Ansehen' : 'Abarbeiten'}
                </Link>
                <Link
                  to={buildObjektBearbeitenUrl(o)}
                  className="px-3 py-1.5 text-sm shrink-0 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-block text-center"
                >
                  Tür/Tor
                </Link>
                {canEdit && o.status !== 'erledigt' && o.status !== 'storniert' && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDialog({
                        open: true,
                        title: 'Auftrag löschen',
                        message: `Auftrag am ${o.order_date} wirklich löschen?`,
                        onConfirm: () => {
                          setConfirmDialog((c) => ({ ...c, open: false }))
                          handleDelete(o)
                        },
                      })
                    }
                    className="px-3 py-1.5 text-sm shrink-0 ml-auto text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    Löschen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ))}

      {isRelease110Enabled ? <PdfPreviewOverlay state={pdfViewer} onClose={handleClosePdfViewer} /> : null}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((c) => ({ ...c, open: false }))}
      />

      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto overscroll-contain"
          style={{ padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))' }}
          onClick={handleCloseForm}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseForm()}
          role="dialog"
          aria-modal
          aria-labelledby="auftrag-form-title"
        >
        <div
          className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full min-w-0 my-auto max-h-[min(90vh,90dvh)] overflow-y-auto p-6 border border-slate-200 dark:border-slate-600"
          onClick={(e) => e.stopPropagation()}
        >
            <h3 id="auftrag-form-title" className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
              {formMode === 'edit' ? 'Auftrag bearbeiten' : 'Neuer Auftrag'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="order-customer" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Kunde *
                </label>
                <select
                  id="order-customer"
                  value={formData.customer_id}
                  onChange={(e) => handleFormChange('customer_id', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  required
                >
                  <option value="">— Auswählen —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {formData.customer_id && (
                <>
                  {bvs.length === 0 && (
                    <p
                      className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2"
                      role="status"
                    >
                      Kein Objekt/BV – Türen/Tore direkt unter dem Kunden (falls vorhanden) können gewählt werden.
                    </p>
                  )}
                  {showBvSelect && (
                    <div>
                      <label htmlFor="order-bv" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                        Objekt/BV *
                      </label>
                      <select
                        id="order-bv"
                        value={formData.bv_id}
                        onChange={(e) => handleFormChange('bv_id', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                        required
                        aria-label="Objekt/BV auswählen"
                      >
                        <option value="">— Auswählen —</option>
                        {bvs.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {singleBv && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      <span className="font-medium">Objekt/BV:</span> {singleBv.name}
                    </p>
                  )}
                </>
              )}
              {showTuerTorSection && (
                <fieldset className="space-y-2 min-w-0 border-0 p-0 m-0">
                  <legend className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Tür/Tor (Mehrfachauswahl)
                  </legend>
                  {hasDoorsToPick ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                      Mindestens eine Tür/Tor wählen, damit die Zuweisung und das Speichern möglich sind.
                    </p>
                  ) : null}
                  {formData.order_type !== 'wartung' && formData.selectedObjectIds.length > 1 ? (
                    <p
                      className="text-xs text-slate-600 dark:text-slate-400 border-l-2 border-amber-400 pl-2 py-1 mb-2"
                      role="note"
                    >
                      Hinweis: Bei Auftragstypen außer „Wartung“ dient die Mehrfachauswahl der Zuordnung mehrerer
                      Türen zu <span className="font-medium">einem</span> Termin; der Monteurbericht wird nicht wie bei
                      der Wartung automatisch türweise in getrennte Prüfprotokolle aufgeteilt.
                    </p>
                  ) : null}
                  {formData.order_type === 'wartung' && formData.selectedObjectIds.length > 1 ? (
                    <p
                      className="text-xs text-slate-600 dark:text-slate-400 border-l-2 border-slate-300 dark:border-slate-600 pl-2 py-1 mb-2"
                      role="note"
                    >
                      Bei „Wartung“ wird im Auftrag für <span className="font-medium">jede</span> gewählte Tür eine
                      Prüf-Checkliste erwartet; Ausnahmen beim Abschluss werden im erledigten Auftrag dokumentiert.
                    </p>
                  ) : null}
                  {pickerObjects.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Keine Türen/Tore für diese Auswahl.</p>
                  ) : (
                    <ul
                      className="max-h-44 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-600 divide-y divide-slate-200 dark:divide-slate-600"
                      aria-label="Türen und Tore auswählen"
                    >
                      {pickerObjects.map((obj) => {
                        const checked = formData.selectedObjectIds.includes(obj.id)
                        return (
                          <li key={obj.id}>
                            <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleObject(obj.id)}
                                className="rounded border-slate-300 dark:border-slate-600"
                                aria-checked={checked}
                              />
                              <span className="text-sm text-slate-800 dark:text-slate-100">{getObjectDisplayName(obj)}</span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </fieldset>
              )}
              {showZuweisungSection && canAssign && (
                <div>
                  <label htmlFor="order-assign" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Zugewiesen an
                  </label>
                  <select
                    id="order-assign"
                    value={formData.assigned_to}
                    onChange={(e) => handleFormChange('assigned_to', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    aria-label="Nutzer zuweisen"
                  >
                    <option value="">— Keine Zuweisung —</option>
                    {profilesAssignable.map((p) => (
                      <option key={p.id} value={p.id}>
                        {getProfileDisplayName(p)}
                        {(p.first_name || p.last_name) && p.email ? ` (${p.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="order-date" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Datum *
                </label>
                <input
                  id="order-date"
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => handleFormChange('order_date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  required
                />
              </div>
              <div>
                <label htmlFor="order-time" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Uhrzeit (optional)
                </label>
                <input
                  id="order-time"
                  type="time"
                  value={formData.order_time}
                  onChange={(e) => handleFormChange('order_time', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  aria-label="Uhrzeit optional"
                />
              </div>
              <div>
                <label htmlFor="order-type" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Art
                </label>
                <select
                  id="order-type"
                  value={formData.order_type}
                  onChange={(e) => handleFormChange('order_type', e.target.value as OrderType)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                >
                  {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((t) => (
                    <option key={t} value={t}>
                      {ORDER_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              {formMode === 'edit' && (
                <div>
                  <label htmlFor="order-status" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Status
                  </label>
                  <select
                    id="order-status"
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  >
                    {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {ORDER_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="order-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Beschreibung
                </label>
                <textarea
                  id="order-desc"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  placeholder="Auftragsdetails…"
                />
              </div>
              {isRelease110Enabled && conflictCalloutRows.length > 0 ? (
                <div className="pt-1">
                  <OrderActiveConflictCallout
                    conflicts={conflictCalloutRows}
                    resolveDoorLabel={resolveConflictDoorLabel}
                  />
                </div>
              ) : null}
              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              )}
              <div className="flex flex-nowrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!canSubmitOrder || isSaving || saveBlockedByDoorConflict}
                  className="flex-1 min-w-0 py-2 bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 disabled:opacity-50 font-medium border border-slate-300 dark:border-slate-600 shrink"
                >
                  {isSaving ? 'Wird gespeichert…' : formMode === 'edit' ? 'Speichern' : 'Anlegen'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 shrink-0 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuftragAnlegen
