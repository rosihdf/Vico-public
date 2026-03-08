import { Navigate, useParams } from 'react-router-dom'

/**
 * Redirects /kunden/:customerId/bvs to /kunden?customerId=...
 * Die BV-Übersicht wird nicht mehr benötigt – alle Links führen zu Kunden.
 */
const BVRedirect = () => {
  const { customerId } = useParams<{ customerId: string }>()

  if (!customerId) return <Navigate to="/kunden" replace />

  return <Navigate to={`/kunden?customerId=${customerId}`} replace />
}

export default BVRedirect
