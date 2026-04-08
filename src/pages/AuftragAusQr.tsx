import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useLicense } from '../LicenseContext'
import { useToast } from '../ToastContext'
import { getSupabaseErrorMessage } from '../supabaseErrors'
import {
  fetchObject,
  fetchCustomers,
  fetchAllBvs,
  createOrder,
  fetchOrders,
  fetchOrdersForQrMergeCandidates,
  fetchOrderById,
  updateOrder,
  QR_MERGE_DOOR_WARNING_THRESHOLD,
} from '../lib/dataService'
import {
  findActiveOrderConflictsAmong,
  getOrderObjectIds,
  isOrderActivePerObjectError,
  type ActiveOrderObjectConflict,
} from '../lib/orderUtils'
import { getObjectDisplayName, objectAccessoriesDisplayString } from '../lib/objectUtils'
import { LoadingSpinner } from '../components/LoadingSpinner'
import OrderActiveConflictCallout from '../components/OrderActiveConflictCallout'
import { isAssignedChannelReleaseAtLeast } from '../lib/releaseGate'
import { isOnline } from '../../shared/networkUtils'
import type { Object as Obj, Customer, BV, OrderType, Order } from '../types'

const todayIso = () => new Date().toISOString().slice(0, 10)

const FIELD_ROWS: { key: keyof Obj; label: string }[] = [
  { key: 'name', label: 'Bezeichnung' },
  { key: 'internal_id', label: 'Interne ID' },
  { key: 'door_position', label: 'Türposition' },
  { key: 'internal_door_number', label: 'Interne Türnr.' },
  { key: 'floor', label: 'Etage' },
  { key: 'room', label: 'Raum' },
  { key: 'manufacturer', label: 'Hersteller' },
  { key: 'build_year', label: 'Baujahr' },
  { key: 'lock_manufacturer', label: 'Schloss-Hersteller' },
  { key: 'lock_type', label: 'Schloss-Typ' },
  { key: 'type_freitext', label: 'Art (Freitext)' },
  { key: 'wing_count', label: 'Flügelanzahl' },
  { key: 'panic_function', label: 'Panikfunktion' },
  { key: 'accessories', label: 'Zubehör' },
  { key: 'defects', label: 'Mängel' },
  { key: 'remarks', label: 'Bemerkungen' },
]

const boolLabel = (v: boolean | null | undefined) => (v ? 'Ja' : 'Nein')

const AuftragAusQr = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { mandantenReleases } = useLicense()
  const { showError, showToast } = useToast()
  const isRelease110Enabled = isAssignedChannelReleaseAtLeast(mandantenReleases, '1.1.0')

  const customerId = searchParams.get('customerId') ?? ''
  const bvId = searchParams.get('bvId')
  const objectId = searchParams.get('objectId') ?? ''
  const skipMerge = searchParams.get('skipMerge') === '1'

  const [obj, setObj] = useState<Obj | null | 'loading'>('loading')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bvs, setBvs] = useState<BV[]>([])
  const [orderType, setOrderType] = useState<OrderType>('wartung')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeCandidates, setMergeCandidates] = useState<Order[]>([])
  const [pendingAndOpen, setPendingAndOpen] = useState(false)
  const [selectedMergeOrderId, setSelectedMergeOrderId] = useState<string | null>(null)
  const [merge15Open, setMerge15Open] = useState(false)
  const [merge15Context, setMerge15Context] = useState<{ targetId: string; nextCount: number } | null>(null)
  const [ordersSnapshot, setOrdersSnapshot] = useState<Order[]>([])
  const [createConflictDoors, setCreateConflictDoors] = useState<ActiveOrderObjectConflict[] | null>(null)

  const load = useCallback(async () => {
    if (!objectId) {
      setObj(null)
      setOrdersSnapshot([])
      return
    }
    setObj('loading')
    setCreateConflictDoors(null)
    const [o, c, b, ord] = await Promise.all([
      fetchObject(objectId),
      fetchCustomers(),
      fetchAllBvs(),
      fetchOrders(),
    ])
    setObj(o)
    setCustomers(c ?? [])
    setBvs(b ?? [])
    setOrdersSnapshot(ord ?? [])
  }, [objectId])

  useEffect(() => {
    void load()
  }, [load])

  const customerName = useMemo(() => customers.find((c) => c.id === customerId)?.name ?? '—', [customers, customerId])
  const bvName = useMemo(() => {
    if (obj === 'loading' || !obj) return '—'
    const id = bvId ?? obj.bv_id
    if (!id) return '— (direkt unter Kunde)'
    return bvs.find((b) => b.id === id)?.name ?? '—'
  }, [bvs, bvId, obj])

  const qrSameDoorConflicts = useMemo(() => {
    if (!objectId) return []
    return findActiveOrderConflictsAmong(ordersSnapshot, null, [objectId], 'in_bearbeitung')
  }, [ordersSnapshot, objectId])

  const hasActiveOrderOnThisDoor =
    (createConflictDoors?.length ?? 0) > 0 || qrSameDoorConflicts.length > 0

  const doCreateNew = async (andOpen: boolean) => {
    if (!customerId || !objectId || obj === 'loading' || !obj) {
      showError('Kunde oder Tür/Tor fehlt.')
      return
    }
    const effectiveBvId = bvId ?? obj.bv_id ?? null
    setIsSaving(true)
    const payload = {
      customer_id: customerId,
      bv_id: effectiveBvId,
      object_id: objectId,
      object_ids: [objectId],
      order_date: todayIso(),
      order_time: null as string | null,
      order_type: orderType,
      status: 'in_bearbeitung' as const,
      description: description.trim() || null,
      assigned_to: user?.id ?? null,
    }
    const { data, error } = await createOrder(payload, user?.id ?? null)
    setIsSaving(false)
    if (error) {
      if (isOrderActivePerObjectError(error)) {
        setCreateConflictDoors(error.conflicts)
        showError(error.message)
        return
      }
      showError(getSupabaseErrorMessage(error))
      return
    }
    if (!data) return
    if (andOpen) navigate(`/auftrag/${data.id}`)
    else navigate('/auftrag')
  }

  const handleCreate = async (andOpen: boolean) => {
    if (!customerId || !objectId || obj === 'loading' || !obj) {
      showError('Kunde oder Tür/Tor fehlt.')
      return
    }
    setCreateConflictDoors(null)
    if (!isOnline()) {
      showError('Auftrag anlegen ist nur bei Verbindung möglich.')
      return
    }
    if (hasActiveOrderOnThisDoor) {
      return
    }
    if (skipMerge) {
      await doCreateNew(andOpen)
      return
    }
    const effectiveBvId = bvId ?? obj.bv_id ?? null
    const candidates = await fetchOrdersForQrMergeCandidates({
      customerId,
      bvId: effectiveBvId,
      newObjectId: objectId,
      orderType,
    })
    if (candidates.length === 0) {
      await doCreateNew(andOpen)
      return
    }
    setMergeCandidates(candidates)
    setPendingAndOpen(andOpen)
    setSelectedMergeOrderId(candidates.length === 1 ? candidates[0].id : null)
    setMergeOpen(true)
  }

  const closeMerge = () => {
    setMergeOpen(false)
    setMergeCandidates([])
    setSelectedMergeOrderId(null)
  }

  const runMergeInto = async (targetOrderId: string, andOpen: boolean, skip15Warn: boolean) => {
    if (!objectId || obj === 'loading' || !obj) return
    const target = await fetchOrderById(targetOrderId)
    if (!target) {
      showError('Ziel-Auftrag nicht gefunden.')
      return
    }
    const ids = [...new Set([...getOrderObjectIds(target), objectId])]
    if (!skip15Warn && ids.length >= QR_MERGE_DOOR_WARNING_THRESHOLD) {
      setMerge15Context({ targetId: targetOrderId, nextCount: ids.length })
      setMerge15Open(true)
      return
    }
    setMerge15Open(false)
    setMerge15Context(null)
    setIsSaving(true)
    const { error } = await updateOrder(targetOrderId, {
      customer_id: target.customer_id,
      bv_id: target.bv_id ?? null,
      object_ids: ids,
      order_date: target.order_date,
      order_time: target.order_time ?? null,
      order_type: target.order_type,
      status: target.status,
      description: target.description ?? null,
      assigned_to: target.assigned_to ?? null,
    })
    setIsSaving(false)
    if (error) {
      showError(getSupabaseErrorMessage(error))
      return
    }
    closeMerge()
    showToast('Tür zum bestehenden Auftrag hinzugefügt.', 'success')
    if (andOpen) navigate(`/auftrag/${targetOrderId}`)
    else navigate('/auftrag')
  }

  const handleConfirmMerge = async () => {
    const id =
      mergeCandidates.length === 1 ? mergeCandidates[0].id : selectedMergeOrderId
    if (!id) {
      showError('Bitte einen Auftrag wählen.')
      return
    }
    await runMergeInto(id, pendingAndOpen, false)
  }

  const handleConfirm15 = async () => {
    if (!merge15Context) return
    await runMergeInto(merge15Context.targetId, pendingAndOpen, true)
  }

  if (!customerId || !objectId) {
    return (
      <div className="p-4 max-w-lg">
        <p className="text-slate-600 dark:text-slate-400">Ungültiger Link (customerId / objectId).</p>
        <Link to="/scan" className="mt-4 inline-block text-vico-primary hover:underline">
          Zurück zum Scan
        </Link>
      </div>
    )
  }

  if (obj === 'loading') {
    return <LoadingSpinner message="Lade Tür/Tor…" className="p-8" />
  }

  if (!obj) {
    return (
      <div className="p-4">
        <p className="text-slate-600">Tür/Tor nicht gefunden.</p>
        <Link to="/scan" className="mt-2 inline-block text-vico-primary hover:underline">
          Scan
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl min-w-0 mx-auto space-y-4">
      {mergeOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-merge-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 max-w-md w-full p-4 shadow-lg space-y-3">
            <h3 id="qr-merge-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Bestehenden Auftrag erweitern?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Es gibt {mergeCandidates.length === 1 ? 'einen' : mergeCandidates.length} passenden offenen Auftrag
              gleichen Typs ohne Monteursbericht. Sie können diese Tür hinzufügen oder einen neuen Auftrag anlegen.
            </p>
            {mergeCandidates.length > 1 && (
              <div>
                <label htmlFor="qr-merge-order" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Auftrag wählen
                </label>
                <select
                  id="qr-merge-order"
                  value={selectedMergeOrderId ?? ''}
                  onChange={(e) => setSelectedMergeOrderId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
                  aria-label="Ziel-Auftrag für Zusammenführung"
                >
                  <option value="">— Bitte wählen —</option>
                  {mergeCandidates.map((o) => {
                    const n = getOrderObjectIds(o).length
                    return (
                      <option key={o.id} value={o.id}>
                        {o.order_date} · {n} Tür{n === 1 ? '' : 'en'} · {o.description?.slice(0, 40) || o.id.slice(0, 8)}
                      </option>
                    )
                  })}
                </select>
              </div>
            )}
            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  closeMerge()
                  void doCreateNew(pendingAndOpen)
                }}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                Neuer Auftrag
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleConfirmMerge()}
                className="px-3 py-2 text-sm rounded-lg bg-vico-primary text-white hover:opacity-90 disabled:opacity-50"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {merge15Open && merge15Context && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-merge-15-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-800 max-w-md w-full p-4 shadow-lg space-y-3">
            <h3 id="qr-merge-15-title" className="text-lg font-semibold text-amber-900 dark:text-amber-100">
              Viele Türen am Auftrag
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Nach dem Hinzufügen hat dieser Auftrag {merge15Context.nextCount} Türen (Hinweis ab{' '}
              {QR_MERGE_DOOR_WARNING_THRESHOLD}). Trotzdem fortfahren?
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setMerge15Open(false)
                  setMerge15Context(null)
                }}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleConfirm15()}
                className="px-3 py-2 text-sm rounded-lg bg-amber-700 text-white disabled:opacity-50"
              >
                Trotzdem hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Link to="/scan" className="text-vico-primary hover:underline text-sm">
          ← Scan
        </Link>
        <Link to="/auftrag" className="text-vico-primary hover:underline text-sm">
          Aufträge
        </Link>
      </div>

      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Tür/Tor aus QR</h2>

      {isRelease110Enabled && hasActiveOrderOnThisDoor ? (
        <OrderActiveConflictCallout
          conflicts={createConflictDoors ?? qrSameDoorConflicts}
          resolveDoorLabel={() => getObjectDisplayName(obj)}
          intro="Für diese Tür/Tor gibt es bereits einen Auftrag mit Status „Offen“ oder „In Bearbeitung“. Öffnen Sie diesen Auftrag, um weiterzuarbeiten oder ihn abzuschließen. Ein zweiter paralleler Auftrag ist nicht möglich."
        />
      ) : null}

      {skipMerge && (
        <p className="text-xs text-slate-500 dark:text-slate-400" role="status">
          Zusammenführung übersprungen (Link-Parameter). Es wird immer ein neuer Auftrag angelegt.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOrderType('wartung')}
          className={`px-4 py-2 rounded-lg font-medium border ${
            orderType === 'wartung'
              ? 'bg-vico-primary text-white border-vico-primary'
              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100'
          }`}
        >
          Wartung
        </button>
        <button
          type="button"
          onClick={() => setOrderType('reparatur')}
          className={`px-4 py-2 rounded-lg font-medium border ${
            orderType === 'reparatur'
              ? 'bg-vico-primary text-white border-vico-primary'
              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100'
          }`}
        >
          Reparatur
        </button>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        <span className="font-medium">Kunde:</span> {customerName}
        <br />
        <span className="font-medium">Objekt/BV:</span> {bvName}
        <br />
        <span className="font-medium">Tür/Tor:</span> {getObjectDisplayName(obj)}
      </p>

      <details open className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4">
        <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
          Alle Stammdaten (einklappbar)
        </summary>
        <dl className="mt-3 grid gap-2 text-sm">
          {FIELD_ROWS.map(({ key, label }) => {
            let str: string
            if (key === 'accessories') {
              str = objectAccessoriesDisplayString(obj) || '—'
            } else {
              const v = obj[key]
              str =
                typeof v === 'boolean'
                  ? boolLabel(v)
                  : v == null || v === ''
                    ? '—'
                    : typeof v === 'number'
                      ? String(v)
                      : String(v)
            }
            return (
              <div key={key} className="grid sm:grid-cols-[140px_1fr] gap-1">
                <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="text-slate-800 dark:text-slate-100 break-words whitespace-pre-line">{str}</dd>
              </div>
            )
          })}
          <div className="grid sm:grid-cols-[140px_1fr] gap-1">
            <dt className="text-slate-500 dark:text-slate-400">Art (Typen)</dt>
            <dd className="text-slate-800 dark:text-slate-100">
              {[obj.type_tuer && 'Tür', obj.type_sektionaltor && 'Sektionaltor', obj.type_schiebetor && 'Schiebetor']
                .filter(Boolean)
                .join(', ') || '—'}
            </dd>
          </div>
          <div className="grid sm:grid-cols-[140px_1fr] gap-1">
            <dt className="text-slate-500 dark:text-slate-400">Rauchmelder</dt>
            <dd className="text-slate-800 dark:text-slate-100">{obj.smoke_detector_count ?? 0}</dd>
          </div>
        </dl>
      </details>

      <div>
        <label htmlFor="qr-auftrag-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Auftragsdetails
        </label>
        <textarea
          id="qr-auftrag-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          placeholder="Details zum Auftrag…"
        />
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Beim Anlegen wird das Datum auf heute gesetzt und der Auftrag Ihnen zugewiesen. Anschließend können Sie im
        Abarbeiten-Modus den Monteursbericht erfassen.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSaving || hasActiveOrderOnThisDoor}
          onClick={() => void handleCreate(false)}
          className="px-4 py-2 rounded-lg font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          Nur anlegen
        </button>
        <button
          type="button"
          disabled={isSaving || hasActiveOrderOnThisDoor}
          onClick={() => void handleCreate(true)}
          className="px-4 py-2 rounded-lg font-medium bg-vico-primary text-white hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? 'Wird angelegt…' : 'Anlegen & Abarbeiten'}
        </button>
        {!skipMerge && (
          <button
            type="button"
            disabled={isSaving || hasActiveOrderOnThisDoor}
            onClick={() => void doCreateNew(true)}
            className="px-4 py-2 rounded-lg font-medium border border-vico-primary text-vico-primary hover:bg-vico-primary/10 disabled:opacity-50"
            title="Ohne Prüfung auf bestehende Aufträge"
          >
            Sofort neu anlegen & öffnen
          </button>
        )}
      </div>
    </div>
  )
}

export default AuftragAusQr
