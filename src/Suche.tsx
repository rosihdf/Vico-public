import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabase'
import { LoadingSpinner } from './components/LoadingSpinner'

type SearchResult =
  | {
      type: 'customer'
      customerId: string
      customerName: string
      customerStreet: string | null
      customerHouseNumber: string | null
      customerCity: string | null
    }
  | {
      type: 'bv'
      customerId: string
      customerName: string
      bvId: string
      bvName: string
      bvStreet: string | null
      bvHouseNumber: string | null
      bvCity: string | null
    }
  | {
      type: 'object'
      customerId: string
      customerName: string
      bvId: string | null
      bvName: string
      objectId: string
      objectName: string | null
      objectInternalId: string | null
      objectRoom: string | null
      objectFloor: string | null
    }

const Suche = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!q || q.length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    let cancelled = false
    setIsSearching(true)

    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_entities', { q })
      if (cancelled) return
      setIsSearching(false)
      setHasSearched(true)
      if (error || !Array.isArray(data)) {
        setResults([])
        return
      }
      const mapped: SearchResult[] = data.map((row: any) => {
        if (row.entity_type === 'customer') {
          return {
            type: 'customer',
            customerId: row.customer_id,
            customerName: row.customer_name,
            customerStreet: row.customer_street,
            customerHouseNumber: row.customer_house_number,
            customerCity: row.customer_city,
          }
        }
        if (row.entity_type === 'bv') {
          return {
            type: 'bv',
            customerId: row.customer_id,
            customerName: row.customer_name,
            bvId: row.bv_id,
            bvName: row.bv_name,
            bvStreet: row.bv_street,
            bvHouseNumber: row.bv_house_number,
            bvCity: row.bv_city,
          }
        }
        return {
          type: 'object',
          customerId: row.customer_id,
          customerName: row.customer_name,
          bvId: row.bv_id,
          bvName: row.bv_name,
          objectId: row.object_id,
          objectName: row.object_name,
          objectInternalId: row.object_internal_id,
          objectRoom: row.object_room,
          objectFloor: row.object_floor,
        }
      })
      setResults(mapped)
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-slate-800">Suche</h2>
      <p className="mt-1 text-sm text-slate-600">
        Durchsuche Kunden, BVs und Objekte (min. 2 Zeichen).
      </p>

      <input
        type="search"
        value={query}
        onChange={handleQueryChange}
        placeholder="Name, Ort, interne ID, Raum…"
        className="mt-4 w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400"
        aria-label="Suchbegriff"
        autoFocus
      />

      {query.trim().length < 2 ? (
        <p className="mt-4 text-slate-500 text-sm">
          Tippe mindestens 2 Zeichen ein.
        </p>
      ) : isSearching ? (
        <LoadingSpinner message="Suche…" className="mt-4 py-8" />
      ) : hasSearched && results.length === 0 ? (
        <p className="mt-4 text-slate-600">Keine Treffer.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {results.map((r) => {
            if (r.type === 'customer') {
              const addressParts = [
                [r.customerStreet, r.customerHouseNumber].filter(Boolean).join(' '),
                r.customerCity,
              ]
                .filter(Boolean)
                .join(', ')
              return (
                <li key={`cust-${r.customerId}`}>
                  <Link
                    to={`/kunden?customerId=${r.customerId}`}
                    className="block bg-white rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
                  >
                    <span className="text-xs font-medium text-slate-500 uppercase">Kunde</span>
                    <p className="font-medium text-slate-800">{r.customerName}</p>
                    {addressParts && (
                      <p className="text-sm text-slate-500">
                        {addressParts}
                      </p>
                    )}
                  </Link>
                </li>
              )
            }
            if (r.type === 'bv') {
              const addressParts = [
                [r.bvStreet, r.bvHouseNumber].filter(Boolean).join(' '),
                r.bvCity,
              ]
                .filter(Boolean)
                .join(', ')
              return (
                <li key={`bv-${r.bvId}`}>
                  <Link
                    to={`/kunden?customerId=${r.customerId}&bvId=${r.bvId}`}
                    className="block bg-white rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
                  >
                    <span className="text-xs font-medium text-slate-500 uppercase">Objekt/BV</span>
                    <p className="font-medium text-slate-800">{r.bvName}</p>
                    <p className="text-sm text-slate-500">{r.customerName}</p>
                    {addressParts && (
                      <p className="text-xs text-slate-400">
                        {addressParts}
                      </p>
                    )}
                  </Link>
                </li>
              )
            }
            const roomFloorParts = [r.objectRoom, r.objectFloor].filter(Boolean).join(' / ')
            const subtitle = roomFloorParts || r.bvName
            const title = r.objectName || r.objectInternalId || 'Objekt'
            const objectHref = r.bvId
              ? `/kunden?customerId=${r.customerId}&bvId=${r.bvId}&objectId=${r.objectId}`
              : `/kunden?customerId=${r.customerId}&objectId=${r.objectId}`
            return (
              <li key={`obj-${r.objectId}`}>
                <Link
                  to={objectHref}
                  className="block bg-white rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
                >
                  <span className="text-xs font-medium text-slate-500 uppercase">Objekt</span>
                  <p className="font-medium text-slate-800">
                    {title}
                  </p>
                  <p className="text-sm text-slate-500">
                    {subtitle}
                  </p>
                  <p className="text-xs text-slate-400">
                    {r.customerName}{r.bvName ? ` → ${r.bvName}` : ''}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default Suche
