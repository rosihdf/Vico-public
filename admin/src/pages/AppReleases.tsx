import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchAppReleases,
  RELEASE_CHANNEL_LABELS,
  RELEASE_TYPE_LABELS,
  type AppReleaseRecord,
} from '../lib/mandantenReleaseService'

const AppReleases = () => {
  const [rows, setRows] = useState<AppReleaseRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchAppReleases())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">App-Releases (Mandanten)</h1>
          <p className="text-sm text-slate-500 mt-1">
            §11.20: Entwürfe, Incoming, Go-Live pro Kanal. Zuweisung je Mandant unter Mandant bearbeiten.
          </p>
        </div>
        <Link
          to="/app-releases/neu"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-vico-primary text-white text-sm font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-vico-primary"
        >
          Neuer Release
        </Link>
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3" role="alert">
          {error}
          <p className="mt-2 text-xs text-red-700">
            Hinweis: Tabelle fehlt, bis <code className="bg-red-100 px-1 rounded">supabase-license-portal.sql</code> Abschnitt
            7 auf dem Lizenz-Supabase ausgeführt wurde.
          </p>
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-slate-500">Lade…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">Noch keine Releases angelegt.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Kanal</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Typ</th>
                <th className="px-3 py-2 font-medium">Incoming</th>
                <th className="px-3 py-2 font-medium">Titel</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-3 py-2">{RELEASE_CHANNEL_LABELS[r.channel]}</td>
                  <td className="px-3 py-2 font-mono">{r.version_semver}</td>
                  <td className="px-3 py-2">{RELEASE_TYPE_LABELS[r.release_type]}</td>
                  <td className="px-3 py-2">
                    {r.incoming_enabled ? (
                      <span className="text-amber-700">{r.incoming_all_mandanten ? 'alle' : 'Pilot'}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={r.title ?? ''}>
                    {r.title ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/app-releases/${r.id}`}
                      className="text-vico-primary font-medium hover:underline"
                      tabIndex={0}
                    >
                      Bearbeiten
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AppReleases
