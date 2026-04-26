import { useCallback, useMemo } from 'react'
import type { Customer, BV } from '../types'
import type { Object as Obj } from '../types'

export type KundenWartungsstatusFilter = 'all' | 'overdue' | 'due_soon' | 'ok' | 'none'

export type UseKundenListFiltersParams = {
  customers: Customer[]
  searchQuery: string
  filterPlz: string
  filterWartungsstatus: KundenWartungsstatusFilter
  filterBvMin: string
  filterBvMax: string
  customerWartungsstatus: Map<string, 'overdue' | 'due_soon' | 'ok' | 'none'>
  bvCountByCustomerId: Map<string, number>
  expandedBvs: BV[]
  expandedObjects: Obj[]
}

export function useKundenListFilters({
  customers,
  searchQuery,
  filterPlz,
  filterWartungsstatus,
  filterBvMin,
  filterBvMax,
  customerWartungsstatus,
  bvCountByCustomerId,
  expandedBvs,
  expandedObjects,
}: UseKundenListFiltersParams) {
  const searchLower = searchQuery.trim().toLowerCase()
  const matchStr = useCallback(
    (v: string | null | undefined) => (v ?? '').toLowerCase().includes(searchLower),
    [searchLower]
  )

  const filteredCustomers = useMemo(() => {
    let list = customers
    if (searchLower) {
      list = list.filter(
        (c) =>
          matchStr(c.name) ||
          matchStr(c.street) ||
          matchStr(c.house_number) ||
          matchStr(c.postal_code) ||
          matchStr(c.city) ||
          matchStr(c.email) ||
          matchStr(c.phone) ||
          matchStr(c.contact_name) ||
          matchStr(c.contact_email) ||
          matchStr(c.contact_phone)
      )
    }
    if (filterPlz.trim()) {
      const plzLower = filterPlz.trim().toLowerCase()
      list = list.filter((c) => (c.postal_code ?? '').toLowerCase().includes(plzLower))
    }
    if (filterWartungsstatus !== 'all') {
      list = list.filter((c) => customerWartungsstatus.get(c.id) === filterWartungsstatus)
    }
    const bvMin = filterBvMin.trim() ? parseInt(filterBvMin, 10) : null
    const bvMax = filterBvMax.trim() ? parseInt(filterBvMax, 10) : null
    if (bvMin != null && !Number.isNaN(bvMin)) {
      list = list.filter((c) => (bvCountByCustomerId.get(c.id) ?? 0) >= bvMin)
    }
    if (bvMax != null && !Number.isNaN(bvMax)) {
      list = list.filter((c) => (bvCountByCustomerId.get(c.id) ?? 0) <= bvMax)
    }
    return list
  }, [
    customers,
    searchLower,
    filterPlz,
    filterWartungsstatus,
    filterBvMin,
    filterBvMax,
    customerWartungsstatus,
    bvCountByCustomerId,
    matchStr,
  ])

  const filteredBvs =
    searchLower && expandedBvs.length > 0
      ? expandedBvs.filter(
          (b) =>
            matchStr(b.name) ||
            matchStr(b.street) ||
            matchStr(b.house_number) ||
            matchStr(b.postal_code) ||
            matchStr(b.city) ||
            matchStr(b.email) ||
            matchStr(b.phone) ||
            matchStr(b.contact_name)
        )
      : expandedBvs

  const filteredObjects =
    searchLower && expandedObjects.length > 0
      ? expandedObjects.filter(
          (o) =>
            matchStr(o.name) ||
            matchStr(o.internal_id) ||
            matchStr(o.room) ||
            matchStr(o.floor) ||
            matchStr(o.manufacturer)
        )
      : expandedObjects

  const hasActiveFilters =
    filterPlz.trim() !== '' ||
    filterWartungsstatus !== 'all' ||
    filterBvMin.trim() !== '' ||
    filterBvMax.trim() !== ''

  return {
    searchLower,
    filteredCustomers,
    filteredBvs,
    filteredObjects,
    hasActiveFilters,
  }
}
