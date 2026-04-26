import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import { supabase } from './supabase'
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

const MONTEUR_BERICHT_STORAGE_BUCKET = 'maintenance-photos'
import { subscribeToOrderChanges } from './lib/orderRealtime'
import { subscribeToProfileChanges } from './lib/profileRealtime'
import { fetchProfiles } from './lib/userService'
import { getObjectDisplayName } from './lib/objectUtils'
import {
  findActiveOrderConflictsAmong,
  isOrderActivePerObjectError,
  type ActiveOrderObjectConflict,
} from './lib/orderUtils'
import { OrderCalendar } from './components/OrderCalendar'
import { LoadingSpinner } from './components/LoadingSpinner'
import ConfirmDialog from './components/ConfirmDialog'
import PdfPreviewOverlay, { type PdfPreviewState } from './components/PdfPreviewOverlay'
import { AuftragAnlegenPageToolbar } from './components/auftraege/AuftragAnlegenPageToolbar'
import { AuftragAnlegenOrderListRow } from './components/auftraege/AuftragAnlegenOrderListRow'
import { AuftragAnlegenOrderFormModal } from './components/auftraege/AuftragAnlegenOrderFormModal'
import EmptyState from '../shared/EmptyState'
import { useLicense } from './LicenseContext'
import { useComponentSettings } from './ComponentSettingsContext'
import { hasFeature } from './lib/licenseService'
import { isAssignedChannelReleaseAtLeast } from './lib/releaseGate'
import {
  deriveAuftragListView,
  mapOrdersWithListLabels,
  getCustomerDisplayName,
  getBvDisplayName,
} from './lib/auftragAnlegenListDerive'
import { INITIAL_FORM, orderToFormState, type OrderFormState } from './lib/auftragAnlegenFormModel'
import type { Order, Customer, BV, Object as Obj, OrderType, OrderStatus } from './types'
import type { Profile } from './lib/userService'

const AuftragAnlegen = () => {
  const { user, userRole } = useAuth()
  const { mandantenReleases, license } = useLicense()
  const { isEnabled } = useComponentSettings()
  const { showError } = useToast()
  const isRelease110Enabled = isAssignedChannelReleaseAtLeast(mandantenReleases, '1.1.0')
  const canAssign = userRole === 'admin'
  const canEdit = userRole === 'admin' || userRole === 'mitarbeiter'
  const canBuchhaltungExport =
    userRole === 'admin' || userRole === 'mitarbeiter' || userRole === 'teamleiter'
  const checklistAssistantAvailable =
    Boolean(license && hasFeature(license, 'checklist_assistant')) &&
    isEnabled('wartung_checklist_assistant')
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
  const [relationFilter, setRelationFilter] = useState<'all' | 'linked' | 'unlinked'>('all')
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
      if (!isOnline()) {
        showError('Monteurbericht ist nur mit Verbindung abrufbar.')
        return
      }
      const { data, error: dlErr } = await supabase.storage.from(MONTEUR_BERICHT_STORAGE_BUCKET).download(path)
      if (dlErr || !data) {
        showError(dlErr?.message ?? 'Monteurbericht konnte nicht geladen werden.')
        return
      }
      const oid = o.object_ids?.[0] ?? o.object_id
      const obj = oid ? allObjects.find((x) => x.id === oid) : undefined
      const label = obj ? getObjectDisplayName(obj) : o.id.slice(0, 8)
      const previewTitle = ['Monteurbericht', label, o.order_date].filter(Boolean).join(' – ')
      const url = URL.createObjectURL(data)
      setPdfViewer({
        url,
        title: previewTitle || 'Monteurbericht',
        revokeOnClose: true,
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

  const getCustomerName = (id: string) => getCustomerDisplayName(customers, id)
  const getBvName = (id: string | null | undefined) => getBvDisplayName(allBvs, id)
  const profilesAssignable = profiles.filter((p) => p.role !== 'demo' && p.role !== 'kunde')

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

  const { displayOrders, parentOrderIdsWithChildren } = deriveAuftragListView(
    orders,
    userRole,
    user,
    archiveMode,
    relationFilter,
  )
  const ordersWithNames = mapOrdersWithListLabels(
    displayOrders,
    customers,
    allBvs,
    parentOrderIdsWithChildren,
  )

  return (
    <div className="p-4 min-w-0">
      <AuftragAnlegenPageToolbar
        canBuchhaltungExport={canBuchhaltungExport}
        canEdit={canEdit}
        archiveMode={archiveMode}
        viewMode={viewMode}
        relationFilter={relationFilter}
        onArchiveActive={() => setArchiveMode('active')}
        onArchiveArchive={() => setArchiveMode('archive')}
        onViewList={() => setViewMode('list')}
        onViewCalendar={() => setViewMode('calendar')}
        onRelationAll={() => setRelationFilter('all')}
        onRelationLinked={() => setRelationFilter('linked')}
        onRelationUnlinked={() => setRelationFilter('unlinked')}
        onCreateClick={handleOpenCreate}
      />

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
            <AuftragAnlegenOrderListRow
              key={o.id}
              row={o}
              allObjects={allObjects}
              profiles={profiles}
              profilesAssignable={profilesAssignable}
              berichteLoadingOrderId={berichteLoadingOrderId}
              canAssign={canAssign}
              canEdit={canEdit}
              archiveMode={archiveMode}
              checklistAssistantAvailable={checklistAssistantAvailable}
              onMonteursberichtClick={() => void handleListMonteursbericht(o)}
              onPruefprotokollClick={(objectId) => void handleListPruefprotokoll(o, objectId)}
              onAssignmentChange={(assignedTo) => handleAssignmentChange(o, assignedTo)}
              onDateChange={(newDate) => handleDateChange(o, newDate)}
              onStatusChange={(status) => handleStatusChange(o, status)}
              onEditClick={() => handleOpenEdit(o)}
              onDeleteClick={() =>
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
            />
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
        <AuftragAnlegenOrderFormModal
          onBackdropClick={handleCloseForm}
          formMode={formMode}
          formData={formData}
          customers={customers}
          bvs={bvs}
          showBvSelect={showBvSelect}
          singleBv={singleBv}
          showTuerTorSection={showTuerTorSection}
          hasDoorsToPick={hasDoorsToPick}
          pickerObjects={pickerObjects}
          showZuweisungSection={showZuweisungSection}
          canAssign={canAssign}
          profilesAssignable={profilesAssignable}
          onFormChange={handleFormChange}
          onToggleObject={handleToggleObject}
          isRelease110Enabled={isRelease110Enabled}
          conflictCalloutRows={conflictCalloutRows}
          resolveConflictDoorLabel={resolveConflictDoorLabel}
          formError={formError}
          canSubmitOrder={canSubmitOrder}
          isSaving={isSaving}
          saveBlockedByDoorConflict={saveBlockedByDoorConflict}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
        />
      )}
    </div>
  )
}

export default AuftragAnlegen
