import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
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
  order_type: 'wartung' as OrderType,
  status: 'offen' as OrderStatus,
  description: '',
  assigned_to: '',
}

const AuftragAnlegen = () => {
  const { user, userRole } = useAuth()
  const canAssign = userRole === 'admin'
  const canEdit = userRole !== 'leser'
  const [orders, setOrders] = useState<Order[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [allBvs, setAllBvs] = useState<BV[]>([])
  const [bvs, setBvs] = useState<BV[]>([])
  const [objects, setObjects] = useState<Obj[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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
    if (formData.bv_id) loadObjectsForBv(formData.bv_id)
  }, [formData.bv_id, loadObjectsForBv])

  const getCustomerName = (id: string) => customers.find((c) => c.id === id)?.name ?? '-'
  const getBvName = (id: string) => allBvs.find((b) => b.id === id)?.name ?? '-'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formData.customer_id || !formData.bv_id) {
      setFormError('Kunde und BV sind erforderlich.')
      return
    }
    if (!formData.order_date) {
      setFormError('Datum ist erforderlich.')
      return
    }
    setIsSaving(true)
    const payload = {
      customer_id: formData.customer_id,
      bv_id: formData.bv_id,
      object_id: formData.object_id.trim() || null,
      order_date: formData.order_date,
      order_type: formData.order_type,
      status: formData.status,
      description: formData.description.trim() || null,
      assigned_to: formData.assigned_to.trim() || null,
    }
    const { data, error } = await createOrder(payload, user?.id ?? null)
    setIsSaving(false)
    if (error) {
      setFormError(getSupabaseErrorMessage(error))
      return
    }
    if (data) {
      handleCloseForm()
      loadData()
    }
  }

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    const { error } = await updateOrderStatus(order.id, newStatus)
    if (!error) loadData()
  }

  const handleAssignmentChange = async (order: Order, assignedTo: string) => {
    const { error } = await updateOrderAssignedTo(order.id, assignedTo.trim() || null)
    if (!error) loadData()
  }

  const handleDateChange = async (order: Order, newDate: string) => {
    const { error } = await updateOrderDate(order.id, newDate)
    if (!error) loadData()
  }

  const handleDelete = async (order: Order) => {
    if (!window.confirm(`Auftrag am ${order.order_date} wirklich löschen?`)) return
    const { error } = await deleteOrder(order.id)
    if (!error) loadData()
  }

  const displayOrders =
    userRole === 'admin' || userRole === 'leser'
      ? orders
      : user
        ? orders.filter((o) => o.assigned_to === user.id)
        : []
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
        <div className="flex gap-2">
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
          {canEdit && (
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
        <p className="text-slate-600">Lade Aufträge…</p>
      ) : displayOrders.length === 0 ? (
        <div className="p-6 bg-white rounded-xl border border-slate-200 text-center text-slate-600">
          Noch keine Aufträge. Klicke auf „Auftrag anlegen“.
        </div>
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
                  {o.order_date} · {ORDER_TYPE_LABELS[o.order_type]} · {ORDER_STATUS_LABELS[o.status]}
                  {o.assigned_to && (
                    <span className="ml-2 text-slate-500">→ {getProfileLabel(o.assigned_to)}</span>
                  )}
                </p>
                {o.description && (
                  <p className="text-sm text-slate-500 mt-1 truncate max-w-md">{o.description}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canAssign && (
                  <select
                    value={o.assigned_to ?? ''}
                    onChange={(e) => handleAssignmentChange(o, e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg min-w-[140px]"
                    title="Nutzer zuweisen"
                    aria-label="Nutzer zuweisen"
                  >
                    <option value="">— Zuweisen —</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {getProfileDisplayName(p)}
                        {(p.first_name || p.last_name) && p.email ? ` (${p.email})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {canEdit && (
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
                    <button
                      type="button"
                      onClick={() => handleDelete(o)}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                    >
                      Löschen
                    </button>
                  </>
                )}
                <Link
                  to={`/kunden/${o.customer_id}/bvs/${o.bv_id}/objekte${o.object_id ? `?objectId=${o.object_id}` : ''}`}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Objekte
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ))}

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
              <div>
                <label htmlFor="order-bv" className="block text-sm font-medium text-slate-700 mb-1">
                  BV *
                </label>
                <select
                  id="order-bv"
                  value={formData.bv_id}
                  onChange={(e) => handleFormChange('bv_id', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                  disabled={!formData.customer_id}
                >
                  <option value="">— Auswählen —</option>
                  {bvs.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="order-object" className="block text-sm font-medium text-slate-700 mb-1">
                  Objekt (optional)
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
                    {profiles.map((p) => (
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
                  disabled={isSaving}
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
