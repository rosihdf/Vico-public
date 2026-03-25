import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useToast } from '../ToastContext'
import { getSupabaseErrorMessage } from '../supabaseErrors'
import {
  fetchObject,
  fetchCustomers,
  fetchAllBvs,
  createOrder,
} from '../lib/dataService'
import { getObjectDisplayName, objectAccessoriesDisplayString } from '../lib/objectUtils'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { Object as Obj, Customer, BV, OrderType } from '../types'

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
  const { showError } = useToast()

  const customerId = searchParams.get('customerId') ?? ''
  const bvId = searchParams.get('bvId')
  const objectId = searchParams.get('objectId') ?? ''

  const [obj, setObj] = useState<Obj | null | 'loading'>('loading')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bvs, setBvs] = useState<BV[]>([])
  const [orderType, setOrderType] = useState<OrderType>('wartung')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    if (!objectId) {
      setObj(null)
      return
    }
    setObj('loading')
    const [o, c, b] = await Promise.all([fetchObject(objectId), fetchCustomers(), fetchAllBvs()])
    setObj(o)
    setCustomers(c ?? [])
    setBvs(b ?? [])
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

  const handleCreate = async (andOpen: boolean) => {
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
      showError(getSupabaseErrorMessage(error))
      return
    }
    if (!data) return
    if (andOpen) navigate(`/auftrag/${data.id}`)
    else navigate('/auftrag')
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
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Link to="/scan" className="text-vico-primary hover:underline text-sm">
          ← Scan
        </Link>
        <Link to="/auftrag" className="text-vico-primary hover:underline text-sm">
          Aufträge
        </Link>
      </div>

      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Tür/Tor aus QR</h2>

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
          disabled={isSaving}
          onClick={() => handleCreate(false)}
          className="px-4 py-2 rounded-lg font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          Nur anlegen
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => handleCreate(true)}
          className="px-4 py-2 rounded-lg font-medium bg-vico-primary text-white hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? 'Wird angelegt…' : 'Anlegen & Abarbeiten'}
        </button>
      </div>
    </div>
  )
}

export default AuftragAusQr
