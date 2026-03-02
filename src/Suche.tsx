import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomers, fetchAllBvs, fetchAllObjects } from './lib/dataService'
import type { Customer, BV, Object as Obj } from './types'

const matchQuery = (text: string | null, q: string): boolean => {
  if (!text) return false
  return text.toLowerCase().includes(q.toLowerCase())
}

type SearchResult = {
  type: 'customer'
  customer: Customer
  customerId: string
  bvId?: never
  objectId?: never
} | {
  type: 'bv'
  bv: BV
  customer: Customer
  customerId: string
  bvId: string
  objectId?: never
} | {
  type: 'object'
  object: Obj
  bv: BV
  customer: Customer
  customerId: string
  bvId: string
  objectId: string
}

const Suche = () => {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bvs, setBvs] = useState<BV[]>([])
  const [objects, setObjects] = useState<Obj[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      const [cust, bvList, objList] = await Promise.all([
        fetchCustomers(),
        fetchAllBvs(),
        fetchAllObjects(),
      ])
      setCustomers(cust ?? [])
      setBvs(bvList ?? [])
      setObjects(objList ?? [])
      setIsLoading(false)
    }
    load()
  }, [])

  const results = useMemo((): SearchResult[] => {
    const q = query.trim()
    if (!q || q.length < 2) return []

    const custList = customers as Customer[]
    const bvList = bvs as BV[]
    const objList = objects as Obj[]

    const out: SearchResult[] = []

    for (const c of custList) {
      const matchName = matchQuery(c.name, q)
      const matchCity = matchQuery(c.city, q)
      const matchStreet = matchQuery(c.street, q)
      if (matchName || matchCity || matchStreet) {
        out.push({ type: 'customer', customer: c, customerId: c.id })
      }
    }

    for (const b of bvList) {
      const cust = custList.find((c) => c.id === b.customer_id)
      if (!cust) continue
      const matchName = matchQuery(b.name, q)
      const matchCity = matchQuery(b.city, q)
      const matchStreet = matchQuery(b.street, q)
      if (matchName || matchCity || matchStreet) {
        out.push({ type: 'bv', bv: b, customer: cust, customerId: cust.id, bvId: b.id })
      }
    }

    for (const o of objList) {
      const b = bvList.find((b) => b.id === o.bv_id)
      const cust = b ? custList.find((c) => c.id === b.customer_id) : null
      if (!b || !cust) continue
      const matchId = matchQuery(o.internal_id, q)
      const matchRoom = matchQuery(o.room, q)
      const matchFloor = matchQuery(o.floor, q)
      const matchManufacturer = matchQuery(o.manufacturer, q)
      const matchBuildYear = matchQuery(o.build_year, q)
      if (matchId || matchRoom || matchFloor || matchManufacturer || matchBuildYear) {
        out.push({
          type: 'object',
          object: o,
          bv: b,
          customer: cust,
          customerId: cust.id,
          bvId: b.id,
          objectId: o.id,
        })
      }
    }

    return out
  }, [query, customers, bvs, objects])

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

      {isLoading ? (
        <p className="mt-4 text-slate-600">Lade Daten…</p>
      ) : query.trim().length >= 2 ? (
        results.length === 0 ? (
          <p className="mt-4 text-slate-600">Keine Treffer.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {results.map((r) => {
              if (r.type === 'customer') {
                return (
                  <li key={`cust-${r.customer.id}`}>
                    <Link
                      to={`/kunden/${r.customerId}/bvs`}
                      className="block bg-white rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
                    >
                      <span className="text-xs font-medium text-slate-500 uppercase">Kunde</span>
                      <p className="font-medium text-slate-800">{r.customer.name}</p>
                      {(r.customer.city || r.customer.street) && (
                        <p className="text-sm text-slate-500">
                          {[r.customer.street, r.customer.city].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </Link>
                  </li>
                )
              }
              if (r.type === 'bv') {
                return (
                  <li key={`bv-${r.bv.id}`}>
                    <Link
                      to={`/kunden/${r.customerId}/bvs/${r.bvId}/objekte`}
                      className="block bg-white rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
                    >
                      <span className="text-xs font-medium text-slate-500 uppercase">BV</span>
                      <p className="font-medium text-slate-800">{r.bv.name}</p>
                      <p className="text-sm text-slate-500">{r.customer.name}</p>
                    </Link>
                  </li>
                )
              }
              return (
                <li key={`obj-${r.object.id}`}>
                  <Link
                    to={`/kunden/${r.customerId}/bvs/${r.bvId}/objekte?objectId=${r.objectId}`}
                    className="block bg-white rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
                  >
                    <span className="text-xs font-medium text-slate-500 uppercase">Objekt</span>
                    <p className="font-medium text-slate-800">
                      {r.object.internal_id || r.object.id}
                    </p>
                    <p className="text-sm text-slate-500">
                      {[r.object.room, r.object.floor].filter(Boolean).join(' · ') || r.object.manufacturer || r.bv.name}
                    </p>
                    <p className="text-xs text-slate-400">{r.customer.name} → {r.bv.name}</p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )
      ) : (
        <p className="mt-4 text-slate-500 text-sm">
          Tippe mindestens 2 Zeichen ein.
        </p>
      )}
    </div>
  )
}

export default Suche
