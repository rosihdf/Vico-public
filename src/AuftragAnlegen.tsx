import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import {
  fetchOrders,
  createOrder,
  updateOrderStatus,
  updateOrderAssignedTo,
  updateOrderDate,
  deleteOrder,
  fetchCustomers,
  fetchAllBvs,
  fetchBvs,
  fetchObjects,
} from './lib/dataService'
import { subscribeToOrderChanges } from './lib/orderRealtime'
import { subscribeToProfileChanges } from './lib/profileRealtime'
import { fetchProfiles, getProfileDisplayName } from './lib/userService'
import { getObjectDisplayName } from './lib/objectUtils'
import { OrderCalendar } from './components/OrderCalendar'
import { LoadingSpinner } from './components/LoadingSpinner'
import ConfirmDialog from './components/ConfirmDialog'
import EmptyState from './components/EmptyState'
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

const INITIAL_FORM = {
  customer_id: '',
  bv_id: '',
  object_id: '',
  order_date: new Date().toISOString().slice(0, 10),
  order_time: '',
  order_type: 'wartung' as OrderType,
  status: 'offen' as OrderStatus,
  description: '',
  assigned_to: '',
}

const AuftragAnlegen = () => {
  const { user, userRole } = useAuth()
  const { showError } = useToast()
  const canAssign = userRole === 'admin'
  const canEdit = userRole === 'admin' || userRole === 'mitarbeiter'
  const [orders, setOrders] = useState<Order[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [allBvs, setAllBvs] = useState<BV[]>([])
  const [bvs, setBvs] = useState<BV[]>([])
  const [objects, setObjects] = useState<Obj[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [archiveMode, setArchiveMode] = useState<'active' | 'archive'>('active')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const [orderData, customerData, bvData, profileData] = await Promise.all([
      fetchOrders(),
      fetchCustomers(),
      fetchAllBvs(),
      fetchProfiles(),
    ])
    setOrders(orderData ?? [])
    setCustomers(customerData ?? [])
    setAllBvs(bvData ?? [])
    setProfiles(profileData ?? [])
    setIsLoading(false)
  }, [])

  const loadBvsForCustomer = useCallback(async (customerId: string) => {
    if (!customerId) {
      setBvs([])
      setObjects([])
      return
    }
    const bvData = await fetchBvs(customerId)
    setBvs(bvData ?? [])
    setObjects([])
  }, [])

  const loadObjectsForBv = useCallback(async (bvId: string) => {
    if (!bvId) {
      setObjects([])
      return
    }
    const objData = await fetchObjects(bvId)
    setObjects(objData ?? [])
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
      setFormData((prev) => (prev.bv_id === bvs[0].id ? prev : { ...prev, bv_id: bvs[0].id, object_id: '' }))
    }
    if (bvs.length !== 1 && formData.bv_id) {
      const stillValid = bvs.some((b) => b.id === formData.bv_id)
      if (!stillValid) setFormData((prev) => ({ ...prev, bv_id: '', object_id: '' }))
    }
  }, [bvs, formData.customer_id, formData.bv_id])

  useEffect(() => {
    if (formData.bv_id) loadObjectsForBv(formData.bv_id)
  }, [formData.bv_id, loadObjectsForBv])

  const getCustomerName = (id: string) => customers.find((c) => c.id === id)?.name ?? '-'
  const getBvName = (id: string) => allBvs.find((b) => b.id === id)?.name ?? '-'
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
    setFormData(INITIAL_FORM)
    setFormError(null)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setFormError(null)
  }

  const handleFormChange = (field: keyof typeof formData, value: string | OrderType | OrderStatus) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'customer_id') {
        next.bv_id = ''
        next.object_id = ''
      }
      if (field === 'bv_id') next.object_id = ''
      return next
    })
  }

  const showBvSelect = bvs.length > 1
  const singleBv = bvs.length === 1 ? bvs[0] : null
  const canSubmitOrder = formData.customer_id && (formData.bv_id || singleBv?.id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const effectiveBvId = formData.bv_id || singleBv?.id
    if (!formData.customer_id || !effectiveBvId) {
      setFormError(bvs.length === 0 ? 'Bitte zuerst ein Objekt/BV unter dem Kunden anlegen.' : 'Kunde und Objekt/BV sind erforderlich.')
      return
    }
    if (!formData.order_date) {
      setFormError('Datum ist erforderlich.')
      return
    }
    setIsSaving(true)
    const payload = {
      customer_id: formData.customer_id,
      bv_id: effectiveBvId,
      object_id: formData.object_id.trim() || null,
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

  useEffect(() => {
    if (!showForm) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseForm()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showForm])

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">Aufträge</h2>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setArchiveMode('active')}
              className={`px-3 py-2 text-sm font-medium ${archiveMode === 'active' ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Aktive
            </button>
            <button
              type="button"
              onClick={() => setArchiveMode('archive')}
              className={`px-3 py-2 text-sm font-medium ${archiveMode === 'archive' ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Archiv
            </button>
          </div>
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm font-medium ${viewMode === 'list' ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Liste
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-2 text-sm font-medium ${viewMode === 'calendar' ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Kalender
            </button>
          </div>
          {canEdit && archiveMode === 'active' && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover font-medium border border-slate-300"
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
              className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                !o.assigned_to
                  ? 'bg-amber-50/70 border-amber-300 border-l-4 border-l-amber-500'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div>
                <p className="font-medium text-slate-800">
                  {o.customerName} → {o.bvName}
                  {!o.assigned_to && (
                    <span className="ml-2 text-sm font-normal text-amber-700">(nicht zugewiesen)</span>
                  )}
                </p>
                <p className="text-sm text-slate-600">
                  {o.order_date}{o.order_time ? ` ${o.order_time.slice(0, 5)}` : ''} · {ORDER_TYPE_LABELS[o.order_type]} · {ORDER_STATUS_LABELS[o.status]}
                  {o.assigned_to && (
                    <span className="ml-2 text-slate-500">→ {getProfileLabel(o.assigned_to)}</span>
                  )}
                </p>
                {o.description && (
                  <p className="text-sm text-slate-500 mt-1 truncate max-w-md">{o.description}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canAssign && archiveMode === 'active' && (
                  <select
                    value={profilesAssignable.some((p) => p.id === o.assigned_to) ? o.assigned_to ?? '' : ''}
                    onChange={(e) => handleAssignmentChange(o, e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg min-w-[140px]"
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
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg max-w-[140px]"
                      title="Termin ändern"
                      aria-label="Termin ändern"
                    />
                    <select
                      value={o.status}
                      onChange={(e) => handleStatusChange(o, e.target.value as OrderStatus)}
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                    >
                      {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {ORDER_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {canEdit && (
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
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                    >
                      Löschen
                    </button>
                )}
                <Link
                  to={`/auftrag/${o.id}`}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Abarbeiten
                </Link>
                <Link
                  to={o.object_id ? `/kunden?customerId=${o.customer_id}&bvId=${o.bv_id}&objectId=${o.object_id}` : `/kunden?customerId=${o.customer_id}&bvId=${o.bv_id}`}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Objekte
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ))}

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
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={handleCloseForm}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseForm()}
          role="dialog"
          aria-modal
          aria-labelledby="auftrag-form-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="auftrag-form-title" className="text-lg font-bold text-slate-800 mb-4">
              Neuer Auftrag
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="order-customer" className="block text-sm font-medium text-slate-700 mb-1">
                  Kunde *
                </label>
                <select
                  id="order-customer"
                  value={formData.customer_id}
                  onChange={(e) => handleFormChange('customer_id', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="status">
                      Kein Objekt/BV vorhanden. Bitte zuerst unter Kunden anlegen.
                    </p>
                  )}
                  {showBvSelect && (
                    <div>
                      <label htmlFor="order-bv" className="block text-sm font-medium text-slate-700 mb-1">
                        Objekt/BV *
                      </label>
                      <select
                        id="order-bv"
                        value={formData.bv_id}
                        onChange={(e) => handleFormChange('bv_id', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">Objekt/BV:</span> {singleBv.name}
                    </p>
                  )}
                </>
              )}
              <div>
                <label htmlFor="order-object" className="block text-sm font-medium text-slate-700 mb-1">
                  Tür/Tor (optional)
                </label>
                <select
                  id="order-object"
                  value={formData.object_id}
                  onChange={(e) => handleFormChange('object_id', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  disabled={!formData.bv_id}
                >
                  <option value="">— Keins —</option>
                  {objects.map((obj) => (
                    <option key={obj.id} value={obj.id}>
                      {getObjectDisplayName(obj)}
                    </option>
                  ))}
                </select>
              </div>
              {canAssign && (
                <div>
                  <label htmlFor="order-assign" className="block text-sm font-medium text-slate-700 mb-1">
                    Zugewiesen an
                  </label>
                  <select
                    id="order-assign"
                    value={formData.assigned_to}
                    onChange={(e) => handleFormChange('assigned_to', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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
                <label htmlFor="order-date" className="block text-sm font-medium text-slate-700 mb-1">
                  Datum *
                </label>
                <input
                  id="order-date"
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => handleFormChange('order_date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label htmlFor="order-time" className="block text-sm font-medium text-slate-700 mb-1">
                  Uhrzeit (optional)
                </label>
                <input
                  id="order-time"
                  type="time"
                  value={formData.order_time}
                  onChange={(e) => handleFormChange('order_time', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  aria-label="Uhrzeit optional"
                />
              </div>
              <div>
                <label htmlFor="order-type" className="block text-sm font-medium text-slate-700 mb-1">
                  Art
                </label>
                <select
                  id="order-type"
                  value={formData.order_type}
                  onChange={(e) => handleFormChange('order_type', e.target.value as OrderType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((t) => (
                    <option key={t} value={t}>
                      {ORDER_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="order-desc" className="block text-sm font-medium text-slate-700 mb-1">
                  Beschreibung
                </label>
                <textarea
                  id="order-desc"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Auftragsdetails…"
                />
              </div>
              {formError && (
                <p className="text-sm text-red-600" role="alert">
                  {formError}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!canSubmitOrder || isSaving}
                  className="flex-1 py-2 bg-vico-button text-slate-800 rounded-lg hover:bg-vico-button-hover disabled:opacity-50 font-medium border border-slate-300"
                >
                  {isSaving ? 'Wird gespeichert…' : 'Anlegen'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
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
