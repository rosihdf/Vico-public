/**
 * J3: Buchhaltungs-Export – CSV aus Aufträgen (+ Monteursbericht-Daten wenn online).
 * Basis-Export; kundenspezifische APIs (z. B. SevDesk) bewusst später.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { DateInputLeftAligned } from '../components/DateInputLeftAligned'
import {
  fetchOrders,
  fetchCustomers,
  fetchAllBvs,
  fetchAllOrderCompletions,
} from '../lib/dataService'
import { fetchProfiles } from '../lib/userService'
import {
  filterOrdersForAccountingExport,
  buildAccountingOrdersCsv,
} from '../lib/accountingExportService'
import { downloadTextFile } from '../../shared/csvUtils'
import { isOnline } from '../../shared/networkUtils'
import type { Order, Customer, BV, OrderCompletion } from '../types'
import type { Profile } from '../lib/userService'

const defaultDateFrom = (): string => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10)
}

const defaultDateTo = (): string => new Date().toISOString().slice(0, 10)

const ALLOWED_ROLES = new Set(['admin', 'mitarbeiter', 'teamleiter'])

const BuchhaltungExport = () => {
  const { userRole } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bvs, setBvs] = useState<BV[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [completions, setCompletions] = useState<OrderCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)
  const [includeStorniert, setIncludeStorniert] = useState(false)

  const allowed = userRole != null && ALLOWED_ROLES.has(userRole)

  const load = useCallback(async () => {
    if (!allowed) return
    setLoading(true)
    const [o, c, b, p, comp] = await Promise.all([
      fetchOrders(),
      fetchCustomers(),
      fetchAllBvs(),
      fetchProfiles(),
      fetchAllOrderCompletions(),
    ])
    setOrders(o ?? [])
    setCustomers(c ?? [])
    setBvs(b ?? [])
    setProfiles(p ?? [])
    setCompletions(comp ?? [])
    setLoading(false)
  }, [allowed])

  useEffect(() => {
    void load()
  }, [load])

  const completionByOrderId = useMemo(() => {
    const m = new Map<string, OrderCompletion>()
    for (const x of completions) m.set(x.order_id, x)
    return m
  }, [completions])

  const dateRangeInvalid = dateFrom > dateTo

  const filteredOrders = useMemo(
    () =>
      dateRangeInvalid
        ? []
        : filterOrdersForAccountingExport(orders, dateFrom, dateTo, includeStorniert),
    [orders, dateFrom, dateTo, includeStorniert, dateRangeInvalid]
  )

  const handleDownload = useCallback(() => {
    const csv = buildAccountingOrdersCsv(filteredOrders, customers, bvs, profiles, completionByOrderId)
    const d = new Date().toISOString().slice(0, 10)
    downloadTextFile(`buchhaltung-auftraege-${dateFrom}_${dateTo}-${d}.csv`, csv)
  }, [filteredOrders, customers, bvs, profiles, completionByOrderId, dateFrom, dateTo])

  if (!allowed) {
    return (
      <div className="p-4 max-w-lg">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Buchhaltungs-Export</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Nur für Admin, Mitarbeiter oder Teamleiter verfügbar.
        </p>
        <Link to="/auftrag" className="mt-4 inline-block text-vico-primary font-medium hover:underline">
          Zu den Aufträgen
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl w-full min-w-0 overflow-x-hidden mx-auto">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 text-center">
        Buchhaltungs-Export
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 text-center max-w-xl mx-auto">
        Export aller Aufträge im gewählten Zeitraum als CSV (Semikolon, Excel-kompatibel). Spalten aus Auftragstabelle;
        bei Verbindung zusätzlich Daten aus dem Monteursbericht (Arbeitszeit, Kurztexte).{' '}
        <strong className="text-slate-700 dark:text-slate-300">
          Kein Ersatz für Rechnung/Steuerberatung
        </strong>
        – Schnittstellen zu Buchhaltungssoftware (z. B. SevDesk) sind ein separates Thema.
      </p>

      {dateRangeInvalid && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-900 dark:text-red-100 text-center"
        >
          „Von“ darf nicht nach „Bis“ liegen – bitte Zeitraum korrigieren.
        </div>
      )}

      {!isOnline() && (
        <div
          role="status"
          className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100 text-center"
        >
          Offline: Export nutzt zwischengespeicherte Aufträge; Monteursberichte-Spalten können leer sein (Abfrage nur
          online).
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Lade Daten…" className="py-12" />
      ) : (
        <>
          <div className="space-y-4 mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 min-w-0 max-w-full">
            <div className="w-full max-w-lg mx-auto text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                <DateInputLeftAligned
                  id="acc-date-from"
                  label="Von (Auftragsdatum)"
                  value={dateFrom}
                  onChange={setDateFrom}
                />
                <DateInputLeftAligned
                  id="acc-date-to"
                  label="Bis (Auftragsdatum)"
                  value={dateTo}
                  onChange={setDateTo}
                />
              </div>
            </div>
            <label className="flex w-full max-w-lg mx-auto items-center justify-start gap-2 cursor-pointer flex-wrap px-1 text-left">
              <input
                type="checkbox"
                checked={includeStorniert}
                onChange={(e) => setIncludeStorniert(e.target.checked)}
                className="w-4 h-4 shrink-0 rounded border-slate-300 dark:border-slate-600 text-vico-primary focus:ring-vico-primary"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                Stornierte Aufträge einschließen
              </span>
            </label>
            <p className="w-full max-w-lg mx-auto text-left text-sm text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{filteredOrders.length}</span>{' '}
              Aufträge im Filter.
            </p>
            <div className="w-full max-w-lg mx-auto text-left">
              <button
                type="button"
                onClick={handleDownload}
                disabled={dateRangeInvalid || filteredOrders.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                aria-label="CSV-Datei herunterladen"
              >
                CSV herunterladen
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            <Link to="/auftrag" className="text-vico-primary hover:underline font-medium">
              ← Zurück zu Aufträgen
            </Link>
          </p>
        </>
      )}
    </div>
  )
}

export default BuchhaltungExport
