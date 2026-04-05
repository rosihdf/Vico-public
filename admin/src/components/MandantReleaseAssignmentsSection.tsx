import { useState, useEffect, useCallback } from 'react'
import {
  fetchPublishedAppReleasesByChannel,
  fetchTenantReleaseAssignments,
  RELEASE_CHANNEL_LABELS,
  rollbackTenantChannelRelease,
  setTenantChannelActiveRelease,
  type ReleaseChannel,
  type AppReleaseRecord,
} from '../lib/mandantenReleaseService'
import { supabase } from '../lib/supabase'

const CHANNELS: ReleaseChannel[] = ['main', 'kundenportal', 'arbeitszeit_portal']

type MandantReleaseAssignmentsSectionProps = {
  tenantId: string
}

const MandantReleaseAssignmentsSection = ({ tenantId }: MandantReleaseAssignmentsSectionProps) => {
  const [assignments, setAssignments] = useState<Record<ReleaseChannel, string>>({
    main: '',
    kundenportal: '',
    arbeitszeit_portal: '',
  })
  const [previousInfo, setPreviousInfo] = useState<Record<ReleaseChannel, string | null>>({
    main: null,
    kundenportal: null,
    arbeitszeit_portal: null,
  })
  const [options, setOptions] = useState<Record<ReleaseChannel, AppReleaseRecord[]>>({
    main: [],
    kundenportal: [],
    arbeitszeit_portal: [],
  })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [savingCh, setSavingCh] = useState<ReleaseChannel | null>(null)
  const [actorId, setActorId] = useState<string | null>(null)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setActorId(data.user?.id ?? null))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [assRows, mainR, kpR, azR] = await Promise.all([
        fetchTenantReleaseAssignments(tenantId),
        fetchPublishedAppReleasesByChannel('main'),
        fetchPublishedAppReleasesByChannel('kundenportal'),
        fetchPublishedAppReleasesByChannel('arbeitszeit_portal'),
      ])
      const nextAss: Record<ReleaseChannel, string> = { main: '', kundenportal: '', arbeitszeit_portal: '' }
      const nextPrev: Record<ReleaseChannel, string | null> = { main: null, kundenportal: null, arbeitszeit_portal: null }
      const prevIdToLabel = (releases: AppReleaseRecord[], id: string | null) => {
        if (!id) return null
        const r = releases.find((x) => x.id === id)
        return r ? `${r.version_semver}${r.title ? ` – ${r.title}` : ''}` : id.slice(0, 8)
      }
      for (const ch of CHANNELS) {
        const row = assRows.find((a) => a.channel === ch)
        nextAss[ch] = row?.active_release_id ?? ''
        const relList = ch === 'main' ? mainR : ch === 'kundenportal' ? kpR : azR
        nextPrev[ch] = prevIdToLabel(relList, row?.previous_release_id ?? null)
      }
      setAssignments(nextAss)
      setPreviousInfo(nextPrev)
      setOptions({ main: mainR, kundenportal: kpR, arbeitszeit_portal: azR })
    } catch (e) {
      setMessage({
        type: 'err',
        text: e instanceof Error ? e.message : 'Releases konnten nicht geladen werden (Schema Abschnitt 7?).',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSaveChannel = async (ch: ReleaseChannel) => {
    setSavingCh(ch)
    setMessage(null)
    const val = assignments[ch].trim()
    const res = await setTenantChannelActiveRelease(tenantId, ch, val || null, actorId)
    setSavingCh(null)
    if ('error' in res) {
      setMessage({ type: 'err', text: res.error })
      return
    }
    setMessage({ type: 'ok', text: `Kanal ${RELEASE_CHANNEL_LABELS[ch]} gespeichert.` })
    await load()
  }

  const handleRollback = async (ch: ReleaseChannel) => {
    setSavingCh(ch)
    setMessage(null)
    const res = await rollbackTenantChannelRelease(tenantId, ch, actorId)
    setSavingCh(null)
    if ('error' in res) {
      setMessage({ type: 'err', text: res.error })
      return
    }
    setMessage({ type: 'ok', text: `Rollback ${RELEASE_CHANNEL_LABELS[ch]} ausgeführt.` })
    await load()
  }

  if (loading) {
    return (
      <div className="pt-4 border-t border-slate-200">
        <p className="text-sm text-slate-500">Lade Release-Zuweisungen…</p>
      </div>
    )
  }

  return (
    <div className="pt-4 border-t border-slate-200 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Gestaffelte App-Releases (§11.20)</h3>
        <p className="text-xs text-slate-500 mt-1">
          Aktiver Release pro Kanal überschreibt die Anzeige in der Lizenz-API (<code className="bg-slate-100 px-1 rounded">appVersions</code>).
          Go-Live setzt den vorherigen Stand für Rollback.
        </p>
      </div>
      {message ? (
        <div
          role="status"
          className={`text-sm px-3 py-2 rounded-lg ${
            message.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      ) : null}
      <div className="space-y-4">
        {CHANNELS.map((ch) => (
          <div key={ch} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/50">
            <p className="text-sm font-medium text-slate-800">{RELEASE_CHANNEL_LABELS[ch]}</p>
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1 min-w-0">
                <label className="block text-xs text-slate-600 mb-1">Aktiver Release</label>
                <select
                  value={assignments[ch]}
                  onChange={(e) => setAssignments((a) => ({ ...a, [ch]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  <option value="">— kein gestaffelter Release (nur app_versions / global) —</option>
                  {options[ch].map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.version_semver} ({RELEASE_CHANNEL_LABELS[r.channel]}) {r.title ? `– ${r.title}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveChannel(ch)}
                  disabled={savingCh === ch}
                  className="px-3 py-2 rounded-lg bg-vico-primary text-white text-sm font-medium disabled:opacity-50"
                >
                  Go-Live speichern
                </button>
                <button
                  type="button"
                  onClick={() => void handleRollback(ch)}
                  disabled={savingCh === ch || !previousInfo[ch]}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 disabled:opacity-50"
                >
                  Rollback
                </button>
              </div>
            </div>
            {previousInfo[ch] ? (
              <p className="text-xs text-slate-500">Vorheriger Release (Rollback): {previousInfo[ch]}</p>
            ) : (
              <p className="text-xs text-slate-400">Kein vorheriger Release gespeichert.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MandantReleaseAssignmentsSection
