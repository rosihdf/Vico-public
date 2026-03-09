import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { fetchPortalReports, getPortalPdfUrl, getPortalPdfPath } from '../lib/portalService'
import type { PortalReport } from '../lib/portalService'

type BerichteProps = {
  user: User | null
}

const REASON_LABELS: Record<string, string> = {
  regelwartung: 'Regelwartung',
  reparatur: 'Reparatur',
  nachpruefung: 'Nachprüfung',
  sonstiges: 'Sonstiges',
}

const URGENCY_LABELS: Record<string, { label: string; className: string }> = {
  hoch: { label: 'Hoch', className: 'bg-red-100 text-red-700' },
  mittel: { label: 'Mittel', className: 'bg-amber-100 text-amber-700' },
  niedrig: { label: 'Niedrig', className: 'bg-green-100 text-green-700' },
}

const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const Berichte = ({ user }: BerichteProps) => {
  const [reports, setReports] = useState<PortalReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const loadReports = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const data = await fetchPortalReports(user.id)
    setReports(data)
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleToggle = (reportId: string) => {
    setExpandedId((prev) => (prev === reportId ? null : reportId))
  }

  const handleDownloadPdf = async (report: PortalReport) => {
    if (!report.pdf_path) return

    setDownloadingId(report.report_id)
    try {
      const pdfPath = await getPortalPdfPath(report.report_id)
      if (!pdfPath) {
        alert('PDF nicht verfügbar.')
        return
      }
      const url = getPortalPdfUrl(pdfPath)
      window.open(url, '_blank')
    } catch {
      alert('Fehler beim Laden des PDFs.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const searchLower = searchQuery.trim().toLowerCase()
  const filteredReports = searchLower
    ? reports.filter((r) =>
        (r.customer_name ?? '').toLowerCase().includes(searchLower) ||
        (r.bv_name ?? '').toLowerCase().includes(searchLower) ||
        (r.object_name ?? '').toLowerCase().includes(searchLower) ||
        (r.object_internal_id ?? '').toLowerCase().includes(searchLower) ||
        formatDate(r.maintenance_date).includes(searchLower) ||
        (r.reason ? (REASON_LABELS[r.reason] ?? r.reason) : '').toLowerCase().includes(searchLower)
      )
    : reports

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Lade Wartungsberichte…</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Wartungsberichte</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {reports.length} {reports.length === 1 ? 'Bericht' : 'Berichte'} verfügbar
          </p>
        </div>
        <input
          type="search"
          placeholder="Suchen…"
          value={searchQuery}
          onChange={handleSearchChange}
          className="sm:w-64 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vico-primary"
          aria-label="Berichte durchsuchen"
        />
      </div>

      {filteredReports.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-slate-500">
            {searchQuery ? 'Keine Berichte gefunden.' : 'Noch keine Wartungsberichte vorhanden.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredReports.map((report) => {
            const isExpanded = expandedId === report.report_id
            const objectLabel = report.object_internal_id ?? report.object_name ?? 'Objekt'
            const locationParts = [report.object_floor, report.object_room].filter(Boolean)

            return (
              <li
                key={report.report_id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(report.report_id)}
                  className="w-full p-4 flex items-start justify-between gap-3 text-left"
                  aria-expanded={isExpanded}
                  aria-label={`Bericht vom ${formatDate(report.maintenance_date)} ${isExpanded ? 'einklappen' : 'ausklappen'}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">
                        {formatDate(report.maintenance_date)}
                      </span>
                      {report.reason && (
                        <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                          {REASON_LABELS[report.reason] ?? report.reason}
                        </span>
                      )}
                      {report.deficiencies_found && report.urgency && URGENCY_LABELS[report.urgency] && (
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${URGENCY_LABELS[report.urgency].className}`}>
                          Mangel: {URGENCY_LABELS[report.urgency].label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {report.customer_name} – {report.bv_name} – {objectLabel}
                      {locationParts.length > 0 && (
                        <span className="text-slate-400"> ({locationParts.join(', ')})</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {report.pdf_path && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); handleDownloadPdf(report) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); handleDownloadPdf(report) } }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-vico-primary text-white rounded-lg hover:bg-vico-primary-hover transition-colors"
                        aria-label="PDF herunterladen"
                      >
                        {downloadingId === report.report_id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        PDF
                      </span>
                    )}
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-4 bg-slate-50">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div>
                        <dt className="text-slate-500 font-medium">Kunde</dt>
                        <dd className="text-slate-800">{report.customer_name ?? '–'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 font-medium">BV</dt>
                        <dd className="text-slate-800">{report.bv_name ?? '–'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 font-medium">Objekt</dt>
                        <dd className="text-slate-800">
                          {objectLabel}
                          {locationParts.length > 0 && (
                            <span className="text-slate-500"> ({locationParts.join(', ')})</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 font-medium">Prüfgrund</dt>
                        <dd className="text-slate-800">
                          {report.reason ? (REASON_LABELS[report.reason] ?? report.reason) : '–'}
                          {report.reason === 'sonstiges' && report.reason_other && (
                            <span className="text-slate-500"> ({report.reason_other})</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 font-medium">Herstellerwartung</dt>
                        <dd className="text-slate-800">{report.manufacturer_maintenance_done ? 'Ja' : 'Nein'}</dd>
                      </div>
                      {report.hold_open_checked !== null && (
                        <div>
                          <dt className="text-slate-500 font-medium">Feststellanlage geprüft</dt>
                          <dd className="text-slate-800">{report.hold_open_checked ? 'Ja' : 'Nein'}</dd>
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <dt className="text-slate-500 font-medium">Mängel</dt>
                        <dd className="text-slate-800">
                          {report.deficiencies_found ? (
                            <div>
                              <span className="text-red-600 font-medium">Ja</span>
                              {report.urgency && URGENCY_LABELS[report.urgency] && (
                                <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${URGENCY_LABELS[report.urgency].className}`}>
                                  Dringlichkeit: {URGENCY_LABELS[report.urgency].label}
                                </span>
                              )}
                              {report.fixed_immediately && (
                                <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                                  Sofort behoben
                                </span>
                              )}
                              {report.deficiency_description && (
                                <p className="mt-1 text-slate-600">{report.deficiency_description}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-emerald-600">Keine Mängel</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default Berichte
