import type { InfrastructurePingResponse } from '../../lib/licensePortalService'

export type MandantInfrastructurePingResultPanelProps = {
  loading: boolean
  result: InfrastructurePingResponse | null
  idPrefix: string
}

export function MandantInfrastructurePingResultPanel({
  loading,
  result,
  idPrefix,
}: MandantInfrastructurePingResultPanelProps) {
  if (loading) {
    return (
      <p className="text-sm text-slate-600" role="status" aria-live="polite">
        Verbindungen werden geprüft…
      </p>
    )
  }
  if (!result) return null
  const rows: { key: string; label: string; ok: boolean; message: string; skipped?: boolean }[] = []
  if (result.supabase_auth_health) {
    rows.push({
      key: 'sb-auth',
      label: 'Supabase Auth (Health)',
      ok: result.supabase_auth_health.ok,
      message: result.supabase_auth_health.message,
    })
  }
  if (result.supabase_rest) {
    rows.push({
      key: 'sb-rest',
      label: 'Supabase REST (Anon-Key)',
      ok: result.supabase_rest.skipped ? true : result.supabase_rest.ok,
      message: result.supabase_rest.message,
      skipped: result.supabase_rest.skipped,
    })
  }
  for (const u of result.urls) {
    rows.push({
      key: u.label,
      label: u.label,
      ok: u.skipped ? true : u.ok,
      message: u.message,
      skipped: u.skipped,
    })
  }
  if (rows.length === 0) {
    return (
      <p id={`${idPrefix}-empty`} className="text-sm text-slate-600 mt-2">
        Keine Prüfungen ausgeführt (z. B. keine Supabase-URL und keine Preview-URLs).
      </p>
    )
  }
  return (
    <ul
      id={`${idPrefix}-list`}
      className="mt-3 space-y-2 text-sm"
      role="list"
      aria-label="Ergebnisse Verbindungsprüfung"
    >
      {rows.map((r) => (
        <li
          key={r.key}
          className="flex flex-wrap items-start gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
        >
          <span
            className={`shrink-0 font-semibold min-w-[3.5rem] ${
              r.skipped ? 'text-slate-500' : r.ok ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {r.skipped ? '—' : r.ok ? 'OK' : 'Fehler'}
          </span>
          <span className="text-slate-800">
            <span className="font-medium">{r.label}:</span> {r.message}
          </span>
        </li>
      ))}
    </ul>
  )
}
