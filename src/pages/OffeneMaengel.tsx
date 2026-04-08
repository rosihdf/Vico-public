import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  fetchOpenDeficiencyReports,
  fetchDefectFollowupsOpen,
  updateDefectFollowup,
  type OpenDeficiencyReportRow,
  type DefectFollowupOpenRow,
} from '../lib/dataService'
import { getObjectDisplayName } from '../lib/objectUtils'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { isOnline } from '../../shared/networkUtils'
import { useToast } from '../ToastContext'

type MaengelListEntry = {
  key: string
  source: 'protocol' | 'followup'
  id: string
  object_id: string
  maintenance_date: string
  deficiency_description: string | null
  object_name: string | null
  object_internal_id: string | null
  object_customer_id: string | null
  object_bv_id: string | null
  object_customer_name: string | null
  object_bv_name: string | null
  followup_status?: string
  followup_notes?: string | null
}

const rowToEntryProtocol = (row: OpenDeficiencyReportRow): MaengelListEntry => ({
  key: `p-${row.id}`,
  source: 'protocol',
  id: row.id,
  object_id: row.object_id,
  maintenance_date: row.maintenance_date,
  deficiency_description: row.deficiency_description,
  object_name: row.object_name,
  object_internal_id: row.object_internal_id,
  object_customer_id: row.object_customer_id,
  object_bv_id: row.object_bv_id,
  object_customer_name: row.object_customer_name,
  object_bv_name: row.object_bv_name,
})

const FOLLOWUP_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'offen', label: 'Offen' },
  { value: 'kv_versendet', label: 'KV versendet' },
  { value: 'kunde_bestaetigt', label: 'Kunde bestätigt' },
  { value: 'freigegeben', label: 'Freigegeben' },
  { value: 'in_arbeit', label: 'In Arbeit' },
  { value: 'behoben', label: 'Behoben' },
]

const rowToEntryFollowup = (row: DefectFollowupOpenRow): MaengelListEntry => ({
  key: `f-${row.id}`,
  source: 'followup',
  id: row.id,
  object_id: row.object_id,
  maintenance_date: row.maintenance_date,
  deficiency_description: row.deficiency_description,
  object_name: row.object_name,
  object_internal_id: row.object_internal_id,
  object_customer_id: row.object_customer_id,
  object_bv_id: row.object_bv_id,
  object_customer_name: row.object_customer_name,
  object_bv_name: row.object_bv_name,
  followup_status: row.status,
  followup_notes: row.notes,
})

const buildWartungPath = (row: MaengelListEntry): string | null => {
  const cid = row.object_customer_id
  if (!cid) return null
  if (row.object_bv_id) {
    return `/kunden/${cid}/bvs/${row.object_bv_id}/objekte/${row.object_id}/wartung`
  }
  return `/kunden/${cid}/objekte/${row.object_id}/wartung`
}

const matchesMaengelFilters = (
  r: MaengelListEntry,
  kunde: string | null,
  bv: string | null,
  objekt: string | null
): boolean => {
  if (kunde && r.object_customer_id !== kunde) return false
  if (objekt && r.object_id !== objekt) return false
  if (bv) {
    if (bv === 'direct') {
      if (r.object_bv_id != null && String(r.object_bv_id).length > 0) return false
    } else if (r.object_bv_id !== bv) return false
  }
  return true
}

const OffeneMaengel = () => {
  const { showError, showToast } = useToast()
  const [searchParams] = useSearchParams()
  const filterKunde = searchParams.get('kunde')
  const filterBv = searchParams.get('bv')
  const filterObjekt = searchParams.get('objekt')

  const [rows, setRows] = useState<MaengelListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [followupDrafts, setFollowupDrafts] = useState<Record<string, { status: string; notes: string }>>({})
  const [followupSavingId, setFollowupSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isOnline()) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [protocolRows, followupRows] = await Promise.all([
        fetchOpenDeficiencyReports(),
        fetchDefectFollowupsOpen(),
      ])
      const merged: MaengelListEntry[] = [
        ...protocolRows.map(rowToEntryProtocol),
        ...followupRows.map(rowToEntryFollowup),
      ]
      merged.sort((a, b) => (a.maintenance_date < b.maintenance_date ? 1 : -1))
      setRows(merged)
      setFollowupDrafts((prev) => {
        const next = { ...prev }
        for (const r of merged) {
          if (r.source !== 'followup') continue
          if (!next[r.id]) {
            next[r.id] = {
              status: r.followup_status ?? 'offen',
              notes: r.followup_notes ?? '',
            }
          }
        }
        return next
      })
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

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => matchesMaengelFilters(r, filterKunde, filterBv, filterObjekt)),
    [rows, filterKunde, filterBv, filterObjekt]
  )

  const hasActiveFilters = Boolean(filterKunde || filterBv || filterObjekt)

  return (
    <div className="px-4 pb-8 max-w-4xl min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Offene Mängel</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Prüfberichte mit offenen Mängeln (nicht sofort behoben) sowie offene Follow-ups aus abgeschlossenen
            Wartungsaufträgen (Übersicht, begrenzte Anzahl pro Quelle).
          </p>
          {hasActiveFilters ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2" role="status">
              Gefiltert
              {filterKunde ? ` · Kunde` : ''}
              {filterBv ? ` · Objekt/BV` : ''}
              {filterObjekt ? ` · Tür/Tor` : ''}
              .{' '}
              <Link
                to="/maengel"
                className="text-vico-primary hover:underline"
              >
                Filter zurücksetzen
              </Link>
            </p>
          ) : null}
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
      ) : filteredRows.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400 py-8">
          {hasActiveFilters ? 'Keine Einträge für die gewählten Filter.' : 'Keine offenen Mängel gefunden.'}
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Liste offener Mängel">
          {filteredRows.map((r) => {
            const label = getObjectDisplayName({
              name: r.object_name,
              internal_id: r.object_internal_id,
            })
            const wartung = buildWartungPath(r)
            const sourceLabel = r.source === 'followup' ? 'Follow-up (Wartungsauftrag)' : 'Protokoll'
            const draft = followupDrafts[r.id]
            return (
              <li
                key={r.key}
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{label}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      <span className="font-medium text-slate-700 dark:text-slate-200">Kunde:</span>{' '}
                      {r.object_customer_name?.trim() || '—'}
                      <span className="mx-1.5 text-slate-400 dark:text-slate-500" aria-hidden>
                        ·
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">Objekt/BV:</span>{' '}
                      {r.object_bv_id
                        ? r.object_bv_name?.trim() || '—'
                        : 'Tür direkt unter Kunde (ohne Objekt/BV)'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {sourceLabel} · Protokoll vom {r.maintenance_date}
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
                    {r.source === 'followup' && draft && (
                      <div className="mt-4 space-y-2 border-t border-slate-200 dark:border-slate-600 pt-3">
                        <div>
                          <label htmlFor={`fu-st-${r.id}`} className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Follow-up-Status
                          </label>
                          <select
                            id={`fu-st-${r.id}`}
                            value={draft.status}
                            onChange={(e) =>
                              setFollowupDrafts((p) => ({
                                ...p,
                                [r.id]: { ...draft, status: e.target.value },
                              }))
                            }
                            className="w-full max-w-xs px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            aria-label="Follow-up-Status"
                          >
                            {FOLLOWUP_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`fu-n-${r.id}`} className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Notizen
                          </label>
                          <textarea
                            id={`fu-n-${r.id}`}
                            value={draft.notes}
                            onChange={(e) =>
                              setFollowupDrafts((p) => ({
                                ...p,
                                [r.id]: { ...draft, notes: e.target.value },
                              }))
                            }
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            placeholder="Interne Notizen…"
                            aria-label="Follow-up-Notizen"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={followupSavingId === r.id}
                          onClick={async () => {
                            setFollowupSavingId(r.id)
                            const { error } = await updateDefectFollowup({
                              id: r.id,
                              status: draft.status,
                              notes: draft.notes.trim() || null,
                            })
                            setFollowupSavingId(null)
                            if (error) showError(error.message)
                            else {
                              showToast('Follow-up gespeichert.', 'success')
                              void load()
                            }
                          }}
                          className="inline-flex px-3 py-2 rounded-lg text-sm font-medium bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 disabled:opacity-50"
                        >
                          {followupSavingId === r.id ? 'Speichern…' : 'Follow-up speichern'}
                        </button>
                      </div>
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
