import { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { getSupabaseErrorMessage } from './supabaseErrors'
import {
  fetchOrderById,
  fetchCompletionByOrderId,
  createOrderCompletion,
  updateOrderCompletion,
  updateOrderStatus,
  fetchCustomers,
  fetchAllBvs,
} from './lib/dataService'
import { fetchMyProfile } from './lib/userService'
import { LoadingSpinner } from './components/LoadingSpinner'
import type { Order, OrderCompletion, Customer, BV, OrderType, OrderStatus } from './types'

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

const Auftragsdetail = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showError } = useToast()
  const [order, setOrder] = useState<Order | null>(null)
  const [completion, setCompletion] = useState<OrderCompletion | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [allBvs, setAllBvs] = useState<BV[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    ausgeführte_arbeiten: '',
    material: '',
    arbeitszeit_minuten: '',
    unterschrift_mitarbeiter_name: '',
    unterschrift_mitarbeiter_date: '',
    unterschrift_kunde_name: '',
    unterschrift_kunde_date: '',
  })

  const getCustomerName = (id: string) => customers.find((c) => c.id === id)?.name ?? '-'
  const getBvName = (id: string) => allBvs.find((b) => b.id === id)?.name ?? '-'

  const loadData = useCallback(async () => {
    if (!orderId) return
    setIsLoading(true)
    setFormError(null)
    const [orderData, completionData, customerData, bvData, profileData] = await Promise.all([
      fetchOrderById(orderId),
      fetchCompletionByOrderId(orderId),
      fetchCustomers(),
      fetchAllBvs(),
      user ? fetchMyProfile(user.id) : Promise.resolve(null),
    ])
    setOrder(orderData ?? null)
    setCompletion(completionData ?? null)
    setCustomers(customerData ?? [])
    setAllBvs(bvData ?? [])
    if (completionData) {
      setForm({
        ausgeführte_arbeiten: completionData['ausgeführte_arbeiten'] ?? '',
        material: completionData.material ?? '',
        arbeitszeit_minuten: completionData.arbeitszeit_minuten != null ? String(completionData.arbeitszeit_minuten) : '',
        unterschrift_mitarbeiter_name: completionData.unterschrift_mitarbeiter_name ?? '',
        unterschrift_mitarbeiter_date: completionData.unterschrift_mitarbeiter_date ? completionData.unterschrift_mitarbeiter_date.slice(0, 16) : '',
        unterschrift_kunde_name: completionData.unterschrift_kunde_name ?? '',
        unterschrift_kunde_date: completionData.unterschrift_kunde_date ? completionData.unterschrift_kunde_date.slice(0, 16) : '',
      })
    } else if (profileData) {
      const name = [profileData.first_name, profileData.last_name].filter(Boolean).join(' ')
      setForm((prev) => ({
        ...prev,
        unterschrift_mitarbeiter_name: name,
      }))
    }
    setIsLoading(false)
  }, [orderId, user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleFormChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!order) return
    setFormError(null)
    setIsSaving(true)
    const payload = {
      order_id: order.id,
      ausgeführte_arbeiten: form.ausgeführte_arbeiten.trim() || null,
      material: form.material.trim() || null,
      arbeitszeit_minuten: form.arbeitszeit_minuten.trim() ? parseInt(form.arbeitszeit_minuten, 10) : null,
      unterschrift_mitarbeiter_name: form.unterschrift_mitarbeiter_name.trim() || null,
      unterschrift_mitarbeiter_date: form.unterschrift_mitarbeiter_date ? new Date(form.unterschrift_mitarbeiter_date).toISOString() : null,
      unterschrift_kunde_name: form.unterschrift_kunde_name.trim() || null,
      unterschrift_kunde_date: form.unterschrift_kunde_date ? new Date(form.unterschrift_kunde_date).toISOString() : null,
      unterschrift_mitarbeiter_path: null,
      unterschrift_kunde_path: null,
    }
    if (completion) {
      const { error } = await updateOrderCompletion(completion.id, {
        ausgeführte_arbeiten: payload.ausgeführte_arbeiten,
        material: payload.material,
        arbeitszeit_minuten: payload.arbeitszeit_minuten,
        unterschrift_mitarbeiter_name: payload.unterschrift_mitarbeiter_name,
        unterschrift_mitarbeiter_date: payload.unterschrift_mitarbeiter_date,
        unterschrift_kunde_name: payload.unterschrift_kunde_name,
        unterschrift_kunde_date: payload.unterschrift_kunde_date,
      })
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
        showError(getSupabaseErrorMessage(error))
      } else {
        setCompletion({ ...completion, ...payload })
      }
    } else {
      const { data, error } = await createOrderCompletion(payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
        showError(getSupabaseErrorMessage(error))
      } else if (data) {
        setCompletion(data)
      }
    }
    setIsSaving(false)
  }

  const handleMarkDone = async () => {
    if (!order) return
    const { error } = await updateOrderStatus(order.id, 'erledigt')
    if (error) showError(getSupabaseErrorMessage(error))
    else setOrder((o) => (o ? { ...o, status: 'erledigt' as OrderStatus } : null))
  }

  if (!orderId) {
    navigate('/auftrag')
    return null
  }

  if (isLoading) {
    return <LoadingSpinner message="Auftrag wird geladen…" className="p-8" />
  }

  if (!order) {
    return (
      <div className="p-4">
        <p className="text-slate-600">Auftrag nicht gefunden.</p>
        <Link to="/auftrag" className="mt-2 inline-block text-vico-primary hover:underline">
          ← Zurück zu Aufträgen
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl min-w-0 mx-auto">
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <Link
          to="/auftrag"
          className="text-vico-primary hover:underline"
          aria-label="Zurück zu Aufträgen"
        >
          ← Aufträge
        </Link>
        <span className="text-sm text-slate-600">
          {ORDER_TYPE_LABELS[order.order_type]} · {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Auftrag</h2>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Kunde</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-100">{getCustomerName(order.customer_id)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Objekt/BV</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-100">{getBvName(order.bv_id)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Datum</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-100">
              {order.order_date}
              {order.order_time ? ` ${order.order_time.slice(0, 5)}` : ''}
            </dd>
          </div>
          {order.description && (
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Beschreibung</dt>
              <dd className="text-slate-700 dark:text-slate-300">{order.description}</dd>
            </div>
          )}
        </dl>
      </div>

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Monteursbericht</h2>
        {formError && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-2" role="alert">
            {formError}
          </p>
        )}
        <div>
          <label htmlFor="completion-arbeiten" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Ausgeführte Arbeiten
          </label>
          <textarea
            id="completion-arbeiten"
            value={form.ausgeführte_arbeiten}
            onChange={(e) => handleFormChange('ausgeführte_arbeiten', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            placeholder="Beschreibung der durchgeführten Arbeiten"
          />
        </div>
        <div>
          <label htmlFor="completion-material" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Material
          </label>
          <textarea
            id="completion-material"
            value={form.material}
            onChange={(e) => handleFormChange('material', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            placeholder="Verwendetes Material"
          />
        </div>
        <div>
          <label htmlFor="completion-time" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Arbeitszeit (Minuten)
          </label>
          <input
            id="completion-time"
            type="number"
            min={0}
            value={form.arbeitszeit_minuten}
            onChange={(e) => handleFormChange('arbeitszeit_minuten', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            placeholder="z.B. 60"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="completion-sig-mitarbeiter-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Unterschrift Mitarbeiter (Name)
            </label>
            <input
              id="completion-sig-mitarbeiter-name"
              type="text"
              value={form.unterschrift_mitarbeiter_name}
              onChange={(e) => handleFormChange('unterschrift_mitarbeiter_name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              placeholder="Name"
            />
            <label htmlFor="completion-sig-mitarbeiter-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mt-2 mb-1">
              Datum/Uhrzeit
            </label>
            <input
              id="completion-sig-mitarbeiter-date"
              type="datetime-local"
              value={form.unterschrift_mitarbeiter_date}
              onChange={(e) => handleFormChange('unterschrift_mitarbeiter_date', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="completion-sig-kunde-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Unterschrift Kunde (Name)
            </label>
            <input
              id="completion-sig-kunde-name"
              type="text"
              value={form.unterschrift_kunde_name}
              onChange={(e) => handleFormChange('unterschrift_kunde_name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              placeholder="Name des Kunden"
            />
            <label htmlFor="completion-sig-kunde-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mt-2 mb-1">
              Datum/Uhrzeit
            </label>
            <input
              id="completion-sig-kunde-date"
              type="datetime-local"
              value={form.unterschrift_kunde_date}
              onChange={(e) => handleFormChange('unterschrift_kunde_date', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-lg font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
          >
            {isSaving ? 'Speichern…' : 'Bericht speichern'}
          </button>
          {order.status !== 'erledigt' && order.status !== 'storniert' && (
            <button
              type="button"
              onClick={handleMarkDone}
              className="px-4 py-2 rounded-lg font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Als erledigt markieren
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default Auftragsdetail
