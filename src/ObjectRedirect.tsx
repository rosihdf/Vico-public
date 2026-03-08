import { Navigate, useParams, useSearchParams } from 'react-router-dom'

/**
 * Redirects /kunden/:customerId/bvs/:bvId/objekte to /kunden?customerId=...&bvId=...&objectId=...
 * Die Objekte-Übersicht wird nicht mehr benötigt – alle Links führen zu Kunden mit Modal.
 */
const ObjectRedirect = () => {
  const { customerId, bvId } = useParams<{ customerId: string; bvId: string }>()
  const [searchParams] = useSearchParams()
  const objectId = searchParams.get('objectId')

  if (!customerId || !bvId) return <Navigate to="/kunden" replace />

  const params = new URLSearchParams()
  params.set('customerId', customerId)
  params.set('bvId', bvId)
  if (objectId) params.set('objectId', objectId)

  return <Navigate to={`/kunden?${params.toString()}`} replace />
}

export default ObjectRedirect
