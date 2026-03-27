import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOpenDeficiencyReports, type OpenDeficiencyReportRow } from '../lib/dataService'
import { getObjectDisplayName } from '../lib/objectUtils'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { isOnline } from '../../shared/networkUtils'
import { useToast } from '../ToastContext'

const buildWartungPath = (row: OpenDeficiencyReportRow): string | null => {
  const cid = row.object_customer_id
  if (!cid) return null
  if (row.object_bv_id) {
    return `/kunden/${cid}/bvs/${row.object_bv_id}/objekte/${row.object_id}/wartung`
  }
  return `/kunden/${cid}/objekte/${row.object_id}/wartung`
}

const OffeneMaengel = () => {
  const { showError } = useToast()
  const [rows, setRows] = useState<OpenDeficiencyReportRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isOnline()) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchOpenDeficiencyReports()
      setRows(data)
    } catch {
      showError('Mängelliste konnte nicht geladen werden.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="px-4 pb-8 max-w-4xl min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Offene Mängel</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Wartungsprotokolle mit festgestellten Mängeln, die nicht sofort behoben wurden (Übersicht, max. 400
            Einträge).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || !isOnline()}
          className="inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          {loading ? 'Lade…' : 'Aktualisieren'}
        </button>
      </div>

      {!isOnline() ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          Nur online verfügbar – bitte Verbindung herstellen.
        </p>
      ) : loading ? (
        <LoadingSpinner message="Lade Einträge…" className="py-12" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400 py-8">Keine offenen Mängel gefunden.</p>
      ) : (
        <ul className="space-y-3" aria-label="Liste offener Mängel">
          {rows.map((r) => {
            const label = getObjectDisplayName({
              name: r.object_name,
              internal_id: r.object_internal_id,
            })
            const wartung = buildWartungPath(r)
            return (
              <li
                key={r.id}
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Protokoll vom {r.maintenance_date}
                    </p>
                    {r.deficiency_description?.trim() ? (
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap">
                        {r.deficiency_description.trim()}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 italic">
                        Keine Textbeschreibung hinterlegt.
                      </p>
                    )}
                  </div>
                  {wartung ? (
                    <Link
                      to={wartung}
                      className="shrink-0 inline-flex px-3 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover"
                    >
                      Zum Protokoll
                    </Link>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default OffeneMaengel
