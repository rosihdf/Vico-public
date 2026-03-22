/**
 * J2: Wartungsstatistik – KPIs, Tabellen, einfache Balken, CSV (Datenquelle = get_maintenance_reminders / Cache).
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { fetchMaintenanceReminders, subscribeToDataChange } from '../lib/dataService'
import {
  computeStatusTotals,
  aggregateRemindersByCustomer,
  aggregateRemindersByBv,
  buildRemindersDetailCsv,
  buildCustomerAggregateCsv,
  buildBvAggregateCsv,
} from '../lib/maintenanceStatsService'
import { downloadTextFile } from '../../shared/csvUtils'
import type { MaintenanceReminder } from '../types'

const StatusBar = ({
  label,
  value,
  total,
  colorClass,
}: {
  label: string
  value: number
  total: number
  colorClass: string
}) => {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-28 text-xs text-slate-600 dark:text-slate-400 shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden min-w-0">
        <div
          className={`h-full rounded ${colorClass} transition-all`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${label}: ${value} von ${total}`}
        />
      </div>
      <span className="w-16 text-xs font-semibold text-slate-800 dark:text-slate-100 text-right shrink-0 tabular-nums">
        {value}
      </span>
    </div>
  )
}

const Kpi = ({ title, value, className }: { title: string; value: number; className?: string }) => (
  <div
    className={`rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 shadow-sm ${className ?? ''}`}
  >
    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">{value}</p>
  </div>
)

const Wartungsstatistik = () => {
  const { userRole } = useAuth()
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchMaintenanceReminders()
    setReminders(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return subscribeToDataChange(() => {
      void load()
    })
  }, [load])

  const totals = useMemo(() => computeStatusTotals(reminders), [reminders])
  const byCustomer = useMemo(() => aggregateRemindersByCustomer(reminders), [reminders])
  const byBv = useMemo(() => aggregateRemindersByBv(reminders), [reminders])

  const handleDownloadDetail = useCallback(() => {
    const csv = buildRemindersDetailCsv(reminders)
    const d = new Date().toISOString().slice(0, 10)
    downloadTextFile(`wartungsstatistik-objekte-${d}.csv`, csv)
  }, [reminders])

  const handleDownloadCustomer = useCallback(() => {
    const csv = buildCustomerAggregateCsv(byCustomer)
    const d = new Date().toISOString().slice(0, 10)
    downloadTextFile(`wartungsstatistik-kunden-${d}.csv`, csv)
  }, [byCustomer])

  const handleDownloadBv = useCallback(() => {
    const csv = buildBvAggregateCsv(byBv)
    const d = new Date().toISOString().slice(0, 10)
    downloadTextFile(`wartungsstatistik-bv-${d}.csv`, csv)
  }, [byBv])

  if (userRole === 'kunde') {
    return (
      <div className="p-4 max-w-lg">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Wartungsstatistik</h2>
        <p className="text-slate-600 dark:text-slate-400">Diese Auswertung steht im Kundenportal nicht zur Verfügung.</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-5xl min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Wartungsstatistik</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Übersicht nach gleicher Datenbasis wie die Wartungserinnerungen (Objekte mit Intervall). Diagramme und Tabellen
            nutzen dieselben Rohdaten wie der CSV-Export.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadDetail}
            disabled={reminders.length === 0}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            aria-label="CSV-Export aller Objektzeilen"
          >
            CSV Objekte
          </button>
          <button
            type="button"
            onClick={handleDownloadCustomer}
            disabled={byCustomer.length === 0}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            aria-label="CSV-Export nach Kunde aggregiert"
          >
            CSV Kunden
          </button>
          <button
            type="button"
            onClick={handleDownloadBv}
            disabled={byBv.length === 0}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            aria-label="CSV-Export nach Objekt BV aggregiert"
          >
            CSV Objekt/BV
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Lade Wartungsdaten…" size="lg" className="py-16" />
      ) : reminders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-8 text-center text-slate-600 dark:text-slate-400">
          Keine Wartungserinnerungen vorhanden (keine Objekte mit Intervall oder keine Daten).
          <p className="mt-3 text-sm">
            <Link to="/" className="text-vico-primary font-medium hover:underline">
              Zurück zum Dashboard
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Kpi title="Objekte gesamt" value={totals.total} />
            <Kpi title="Überfällig" value={totals.overdue} className="border-red-200 dark:border-red-900/50" />
            <Kpi title="Bald fällig" value={totals.dueSoon} className="border-amber-200 dark:border-amber-900/50" />
            <Kpi title="Im Plan" value={totals.ok} className="border-emerald-200 dark:border-emerald-900/50" />
          </div>

          <section
            className="mb-8 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
            aria-labelledby="verteilung-heading"
          >
            <h3 id="verteilung-heading" className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Verteilung nach Status
            </h3>
            <div className="space-y-2 max-w-xl">
              <StatusBar
                label="Überfällig"
                value={totals.overdue}
                total={totals.total}
                colorClass="bg-red-500"
              />
              <StatusBar
                label="Bald fällig"
                value={totals.dueSoon}
                total={totals.total}
                colorClass="bg-amber-400"
              />
              <StatusBar label="Im Plan" value={totals.ok} total={totals.total} colorClass="bg-emerald-500" />
            </div>
          </section>

          <section className="mb-8" aria-labelledby="tbl-kunde-heading">
            <h3 id="tbl-kunde-heading" className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
              Nach Kunde
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">Kunde</th>
                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 text-right">Gesamt</th>
                    <th className="px-3 py-2 font-semibold text-red-700 dark:text-red-300 text-right">Überfällig</th>
                    <th className="px-3 py-2 font-semibold text-amber-700 dark:text-amber-200 text-right">Bald fällig</th>
                    <th className="px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-300 text-right">OK</th>
                  </tr>
                </thead>
                <tbody>
                  {byCustomer.map((row) => (
                    <tr
                      key={row.customer_id}
                      className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/80"
                    >
                      <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                        <Link
                          to={`/kunden?customerId=${row.customer_id}`}
                          className="text-vico-primary hover:underline font-medium"
                        >
                          {row.customer_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {row.total}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{row.overdue}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-300">
                        {row.dueSoon}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{row.ok}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="tbl-bv-heading">
            <h3 id="tbl-bv-heading" className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
              Nach Objekt / BV
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600 max-h-[28rem] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/95 z-10 text-left shadow-sm">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">Kunde</th>
                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">Objekt/BV</th>
                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 text-right">Gesamt</th>
                    <th className="px-3 py-2 font-semibold text-red-700 dark:text-red-300 text-right">Überfällig</th>
                    <th className="px-3 py-2 font-semibold text-amber-700 dark:text-amber-200 text-right">Bald fällig</th>
                    <th className="px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-300 text-right">OK</th>
                  </tr>
                </thead>
                <tbody>
                  {byBv.map((row) => (
                    <tr
                      key={`${row.customer_id}-${row.bv_id}`}
                      className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/80"
                    >
                      <td className="px-3 py-2 text-slate-800 dark:text-slate-100 whitespace-nowrap">{row.customer_name}</td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/kunden?customerId=${row.customer_id}&bvId=${row.bv_id}`}
                          className="text-vico-primary hover:underline font-medium"
                        >
                          {row.bv_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {row.total}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{row.overdue}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-300">
                        {row.dueSoon}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{row.ok}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default Wartungsstatistik
