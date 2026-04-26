import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { fetchObject, fetchBvs } from '../lib/dataService'
import ObjectFormModal from '../components/ObjectFormModal'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { Object as Obj } from '../types'
import type { BV } from '../types'

/**
 * Tür/Tor bearbeiten ohne die volle Kundenliste (z. B. Sprung aus Aufträge).
 * Query: returnTo (z. B. /auftrag) – Ziel nach Schließen des Modals.
 */
const ObjektBearbeiten = () => {
  const { objectId } = useParams<{ objectId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { userRole } = useAuth()
  const canEdit = userRole === 'admin' || userRole === 'mitarbeiter' || userRole === 'demo'
  const canDelete = userRole === 'admin' || userRole === 'demo'

  const [obj, setObj] = useState<Obj | null | undefined>(undefined)
  const [customerBvs, setCustomerBvs] = useState<BV[]>([])

  const customerIdFromOrder = searchParams.get('customerId')?.trim() || null
  const bvIdFromOrder = searchParams.get('bvId')?.trim() || null

  const returnToRaw = searchParams.get('returnTo')?.trim() ?? ''
  const returnPath =
    returnToRaw.length > 0
      ? (() => {
          const dec = decodeURIComponent(returnToRaw)
          return dec.startsWith('/') ? dec : `/${dec}`
        })()
      : '/kunden'

  const handleClose = useCallback(() => {
    navigate(returnPath, { replace: true })
  }, [navigate, returnPath])

  const load = useCallback(async () => {
    if (!objectId) {
      setObj(null)
      return
    }
    const o = await fetchObject(objectId)
    if (!o) {
      setObj(null)
      setCustomerBvs([])
      return
    }
    const customerForContext = o.customer_id ?? customerIdFromOrder
    const bvs = customerForContext ? await fetchBvs(customerForContext) : []
    setCustomerBvs(bvs ?? [])
    setObj(o)
  }, [objectId, customerIdFromOrder])

  useEffect(() => {
    void load()
  }, [load])

  if (obj === undefined) {
    return <LoadingSpinner message="Lade Tür/Tor…" className="p-8" />
  }

  if (!objectId || !obj) {
    return (
      <div className="p-4 max-w-md">
        <p className="text-slate-600 dark:text-slate-400">Tür/Tor nicht gefunden.</p>
        <Link to={returnPath} className="mt-4 inline-block text-vico-primary hover:underline">
          Zurück
        </Link>
      </div>
    )
  }

  const resolvedCustomerId = obj.customer_id ?? customerIdFromOrder
  const resolvedBvId = obj.bv_id ?? bvIdFromOrder

  if (!resolvedCustomerId) {
    return (
      <div className="p-4 max-w-md">
        <p className="text-slate-600 dark:text-slate-400">Tür/Tor hat keine Kunden-Zuordnung.</p>
        <Link to={returnPath} className="mt-4 inline-block text-vico-primary hover:underline">
          Zurück
        </Link>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="p-4 max-w-md">
        <p className="text-slate-600 dark:text-slate-400">Keine Berechtigung zum Bearbeiten.</p>
        <Link to={returnPath} className="mt-4 inline-block text-vico-primary hover:underline">
          Zurück
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 min-h-[40vh]">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
        <Link to={returnPath} className="text-vico-primary hover:underline">
          ← Zurück
        </Link>
      </p>
      <ObjectFormModal
        bvId={resolvedBvId}
        customerId={resolvedCustomerId}
        customerBvs={customerBvs}
        object={obj}
        canEdit={canEdit}
        canDelete={canDelete}
        onClose={handleClose}
        onSuccess={async () => {
          await load()
          handleClose()
        }}
      />
    </div>
  )
}

export default ObjektBearbeiten
