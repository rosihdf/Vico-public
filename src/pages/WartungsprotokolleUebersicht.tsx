/**
 * Zentrale Liste aller Wartungsberichte (maintenance_reports) mit Direktversand – ohne Navigation durch Kundenbaum.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import EmptyState from '../../shared/EmptyState'
import {
  fetchCustomer,
  fetchBv,
  fetchObject,
  fetchCustomers,
  fetchMaintenanceReportSmokeDetectors,
  fetchMaintenanceReportPhotos,
  fetchMaintenanceReportsCentralList,
  resolveMaintenanceReportRecipientEmail,
  sendMaintenanceReportEmailOrQueue,
  subscribeToDataChange,
  type MaintenanceReportCentralRow,
} from '../lib/dataService'
import {
  fetchBriefbogenLetterheadPagesForPdf,
  fetchBriefbogenPdfTextLayout,
} from '../lib/briefbogenService'
import { getObjectDisplayName } from '../lib/objectUtils'
import type { BV, Customer } from '../types'
import { isOnline } from '../../shared/networkUtils'

const buildSyntheticBvFromCustomer = (customer: Customer): BV =>
  ({
    id: '',
    customer_id: customer.id,
    name: '–',
    street: customer.street,
    house_number: customer.house_number,
    postal_code: customer.postal_code,
    city: customer.city,
    email: customer.email,
    phone: customer.phone,
    contact_name: customer.contact_name,
    contact_email: customer.contact_email,
    contact_phone: customer.contact_phone,
    maintenance_report_email: customer.maintenance_report_email,
    maintenance_report_email_address: customer.maintenance_report_email_address,
    uses_customer_report_delivery: true,
    maintenance_report_portal: customer.maintenance_report_portal,
    monteur_report_portal: customer.monteur_report_portal,
    monteur_report_internal_only: customer.monteur_report_internal_only,
    created_at: '',
    updated_at: '',
  }) as BV

const wartungDeepLink = (row: MaintenanceReportCentralRow): string | null => {
  const cid = row.customerIdForRoutes
  const oid = row.embeddedObject.id
  if (!cid || !oid) return null
  const bid = row.embeddedObject.bv_id
  if (bid) return `/kunden/${cid}/bvs/${bid}/objekte/${oid}/wartung`
  return `/kunden/${cid}/objekte/${oid}/wartung`
}

const WartungsprotokolleUebersicht = () => {
  const { userRole } = useAuth()
  const canSend = userRole === 'admin' || userRole === 'mitarbeiter' || userRole === 'operator'
  const [rows, setRows] = useState<MaintenanceReportCentralRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [customerNameById, setCustomerNameById] = useState<Map<string, string>>(() => new Map())
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null)
  const [filterCustomerId, setFilterCustomerId] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterPdf, setFilterPdf] = useState<'all' | 'with_pdf' | 'without_pdf'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const [{ rows: list, errorMessage }, customers] = await Promise.all([
      fetchMaintenanceReportsCentralList(),
      isOnline() ? fetchCustomers() : Promise.resolve([]),
    ])
    setRows(list)
    setLoadError(errorMessage)
    setCustomerNameById(new Map(customers.map((c) => [c.id, c.name])))
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

  const customerFilterOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of rows) {
      const id = row.customerIdForRoutes
      if (!id) continue
      let label = row.customerName?.trim() ? row.customerName : ''
      if (!label || label === '–') label = customerNameById.get(id) ?? '–'
      if (!m.has(id)) m.set(id, label)
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'de'))
  }, [rows, customerNameById])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filterCustomerId && row.customerIdForRoutes !== filterCustomerId) return false
      const d = row.report.maintenance_date ?? ''
      if (filterDateFrom && d < filterDateFrom) return false
      if (filterDateTo && d > filterDateTo) return false
      const hasPdf = Boolean(row.report.pdf_path?.trim())
      if (filterPdf === 'with_pdf' && !hasPdf) return false
      if (filterPdf === 'without_pdf' && hasPdf) return false
      return true
    })
  }, [rows, filterCustomerId, filterDateFrom, filterDateTo, filterPdf])

  const handleSendEmail = async (row: MaintenanceReportCentralRow) => {
    const r = row.report
    const recipient = resolveMaintenanceReportRecipientEmail(row)
    if (!recipient) {
      window.alert(
        'Keine E-Mail-Adresse hinterlegt. Bitte unter Kunde oder BV „E-Mail für Prüfbericht“ eintragen.'
      )
      return
    }
    const cid = row.customerIdForRoutes
    if (!cid) {
      window.alert('Kein Kundenbezug für dieses Protokoll.')
      return
    }

    const customer = await fetchCustomer(cid)
    if (!customer) {
      window.alert('Kunde konnte nicht geladen werden.')
      return
    }

    const bvId = row.embeddedObject.bv_id
    const bvLoaded = bvId ? await fetchBv(bvId) : null
    const object = await fetchObject(row.embeddedObject.id)
    if (!object) {
      window.alert('Tür/Tor konnte nicht geladen werden.')
      return
    }

    const bvForPdf = bvLoaded ?? buildSyntheticBvFromCustomer(customer)

    setSendingEmailFor(r.id)
    try {
      const [letterheadPages, pdfTextLayout, smokeDetectors, photos] = await Promise.all([
        fetchBriefbogenLetterheadPagesForPdf(),
        fetchBriefbogenPdfTextLayout(),
        fetchMaintenanceReportSmokeDetectors(r.id),
        fetchMaintenanceReportPhotos(r.id),
      ])
      const { generateMaintenancePdf } = await import('../lib/generateMaintenancePdf')
      const blob = await generateMaintenancePdf({
        report: r,
        customer,
        bv: bvForPdf,
        object,
        smokeDetectors: smokeDetectors.map((sd) => ({
          label: sd.smoke_detector_label,
          status: sd.status,
        })),
        photos: photos.map((p) => ({
          id: p.id,
          storage_path: p.storage_path,
          caption: p.caption,
          localDataUrl: (p as { localDataUrl?: string }).localDataUrl,
        })),
        technicianSignaturePath: r.technician_signature_path,
        customerSignaturePath: r.customer_signature_path,
        letterheadPages: letterheadPages ?? undefined,
        letterheadContentMargins: pdfTextLayout.margins,
        letterheadFollowPageCompactTop: pdfTextLayout.followPageCompactTop,
      })
      const objectLabel = getObjectDisplayName(object)
      const filename = `Pruefbericht_${r.maintenance_date}_${objectLabel}.pdf`
      const subject = `Prüfbericht ${objectLabel} – ${r.maintenance_date}`
      const { error: sendError } = await sendMaintenanceReportEmailOrQueue(blob, r.id, recipient, subject, filename)
      if (sendError) {
        window.alert(`E-Mail konnte nicht gesendet werden: ${sendError.message}`)
        return
      }
      window.alert(
        isOnline()
          ? `Prüfbericht wurde an ${recipient} gesendet.`
          : `E-Mail wird beim nächsten Sync gesendet (${recipient}).`
      )
    } finally {
      setSendingEmailFor(null)
    }
  }

  const offline = !isOnline()

  return (
    <div id="main-content" className="p-4 min-w-0 max-w-[1400px] mx-auto">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Wartungsprotokolle</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Alle Berichte im Überblick – Versand ohne Umweg über Kunden → BV → Auftrag → Tür.
        </p>
      </header>

      {offline && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
        >
          Offline: Die zentrale Liste wird nur online geladen.
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-900 dark:text-red-100"
        >
          <p className="font-medium">Daten konnten nicht vollständig geladen werden</p>
          <p className="mt-1 whitespace-pre-wrap">{loadError}</p>
        </div>
      )}

      <section className="mb-4 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          Kunde
          <select
            value={filterCustomerId}
            onChange={(e) => setFilterCustomerId(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2 min-w-[12rem]"
            aria-label="Nach Kunde filtern"
          >
            <option value="">Alle</option>
            {customerFilterOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          Von Datum
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2"
            aria-label="Wartungsdatum von"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          Bis Datum
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2"
            aria-label="Wartungsdatum bis"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          PDF / Versandstand
          <select
            value={filterPdf}
            onChange={(e) => setFilterPdf(e.target.value as 'all' | 'with_pdf' | 'without_pdf')}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2"
            aria-label="Nach gespeichertem PDF filtern"
          >
            <option value="all">Alle</option>
            <option value="with_pdf">Mit PDF</option>
            <option value="without_pdf">Ohne PDF</option>
          </select>
        </label>
      </section>

      {loading ? (
        <LoadingSpinner message="Lade Wartungsprotokolle…" className="py-16" />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? 'Keine Einträge' : 'Keine Treffer'}
          description={
            rows.length === 0
              ? offline
                ? 'Mit Verbindung erneut öffnen, um die Liste zu laden.'
                : loadError
                  ? 'Keine Wartungsprotokolle geladen. Siehe Fehlermeldung oben.'
                  : 'Keine Wartungsprotokolle gefunden.'
              : 'Filter anpassen oder zurücksetzen.'
          }
        />
      ) : (
        <>
          <div className="hidden xl:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50">
                  <th scope="col" className="w-10 px-2 py-3 text-center">
                    <span className="sr-only">Mehrfachauswahl</span>
                  </th>
                  <th scope="col" className="text-left px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Datum
                  </th>
                  <th scope="col" className="text-left px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Kunde
                  </th>
                  <th scope="col" className="text-left px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Bauvorhaben
                  </th>
                  <th scope="col" className="text-left px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Auftrag
                  </th>
                  <th scope="col" className="text-left px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Tür / Tor
                  </th>
                  <th scope="col" className="text-left px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Status
                  </th>
                  <th scope="col" className="text-right px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const r = row.report
                  const hasPdf = Boolean(r.pdf_path?.trim())
                  const recipient = resolveMaintenanceReportRecipientEmail(row)
                  const deep = wartungDeepLink(row)
                  const syncBlocked = r.synced === false || r.id.startsWith('temp-')
                  const sending = sendingEmailFor === r.id
                  const sendDisabled =
                    !canSend || !recipient || syncBlocked || sending || offline

                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 dark:border-slate-700/80 hover:bg-slate-50/80 dark:hover:bg-slate-900/40"
                    >
                      <td className="px-2 py-2 text-center align-middle">
                        <input
                          type="checkbox"
                          disabled
                          className="rounded border-slate-300 dark:border-slate-600 opacity-40 cursor-not-allowed"
                          title="Mehrfachauswahl folgt"
                          aria-label="Mehrfachauswahl (in Kürze)"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap align-middle text-slate-900 dark:text-slate-100">
                        {r.maintenance_date}
                        {r.maintenance_time ? (
                          <span className="text-slate-500 dark:text-slate-400"> {r.maintenance_time.slice(0, 5)}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-800 dark:text-slate-100">{row.customerName}</td>
                      <td className="px-3 py-2 align-middle text-slate-700 dark:text-slate-200">{row.bvName}</td>
                      <td className="px-3 py-2 align-middle text-slate-600 dark:text-slate-300 max-w-[14rem] truncate">
                        {row.orderLabel}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-700 dark:text-slate-200 max-w-[12rem] truncate">
                        {getObjectDisplayName(row.embeddedObject)}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span
                          title={
                            hasPdf
                              ? 'PDF liegt vor (gespeicherter Versand/Pfad). Ob bereits per E-Mail versendet wurde, wird hier nicht separat geführt.'
                              : 'Noch kein gespeichertes PDF.'
                          }
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            hasPdf
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100'
                              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100'
                          }`}
                        >
                          {hasPdf ? 'Gesendet' : 'Offen'}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
                        <div className="flex flex-wrap gap-2 justify-end">
                          {deep ? (
                            <Link
                              to={deep}
                              className="px-2 py-1 text-xs font-medium text-vico-primary hover:underline"
                            >
                              Details
                            </Link>
                          ) : null}
                          {canSend ? (
                            <button
                              type="button"
                              onClick={() => void handleSendEmail(row)}
                              disabled={sendDisabled}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-45 disabled:cursor-not-allowed"
                              aria-label={hasPdf ? 'Erneut senden' : 'Senden'}
                            >
                              {sending ? '…' : syncBlocked ? 'Sync …' : hasPdf ? 'Erneut senden' : 'Senden'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500 dark:text-slate-400">Nur Lesen</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="xl:hidden space-y-3">
            {filteredRows.map((row) => {
              const r = row.report
              const hasPdf = Boolean(r.pdf_path?.trim())
              const recipient = resolveMaintenanceReportRecipientEmail(row)
              const deep = wartungDeepLink(row)
              const syncBlocked = r.synced === false || r.id.startsWith('temp-')
              const sending = sendingEmailFor === r.id
              const sendDisabled = !canSend || !recipient || syncBlocked || sending || offline

              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      disabled
                      className="mt-1 rounded border-slate-300 opacity-40"
                      aria-label="Mehrfachauswahl (in Kürze)"
                      title="Mehrfachauswahl folgt"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {r.maintenance_date}
                        {r.maintenance_time ? ` · ${r.maintenance_time.slice(0, 5)}` : ''}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        <span className="text-slate-500 dark:text-slate-400">Kunde:</span> {row.customerName}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        <span className="text-slate-500 dark:text-slate-400">BV:</span> {row.bvName}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        <span className="text-slate-500 dark:text-slate-400">Auftrag:</span> {row.orderLabel}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        <span className="text-slate-500 dark:text-slate-400">Tür/Tor:</span>{' '}
                        {getObjectDisplayName(row.embeddedObject)}
                      </p>
                      <span
                        className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                          hasPdf
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100'
                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100'
                        }`}
                      >
                        {hasPdf ? 'Gesendet' : 'Offen'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 justify-end">
                    {deep ? (
                      <Link
                        to={deep}
                        className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-vico-primary"
                      >
                        Details
                      </Link>
                    ) : null}
                    {canSend ? (
                      <button
                        type="button"
                        onClick={() => void handleSendEmail(row)}
                        disabled={sendDisabled}
                        className="px-3 py-1.5 text-sm rounded-lg bg-vico-primary text-white hover:opacity-90 disabled:opacity-45"
                      >
                        {sending ? '…' : syncBlocked ? 'Sync …' : hasPdf ? 'Erneut senden' : 'Senden'}
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

export default WartungsprotokolleUebersicht
