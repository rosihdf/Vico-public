import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  triggerMandantenDbRollout,
  type MandantenRolloutMode,
  type MandantenRolloutTarget,
} from '../lib/mandantenRolloutService'

const DEFAULT_ROLLOUT_SQL = 'supabase-complete.sql'

const SQL_FILE_PRESETS: ReadonlyArray<{ value: string; hint?: string }> = [
  { value: 'supabase-complete.sql', hint: 'Konsolidierter Gesamtstand' },
  {
    value: 'docs/sql/mandanten-db-altbericht-import-complete.sql',
    hint: 'Altbericht-Import · alle Pakete in einem Lauf',
  },
  { value: 'docs/sql/mandanten-db-stammdaten-archived-at.sql', hint: 'Stammdaten · archived_at' },
  { value: 'docs/sql/mandanten-db-altbericht-import-paket-a.sql' },
  { value: 'docs/sql/mandanten-db-altbericht-import-paket-b-review.sql' },
  { value: 'docs/sql/mandanten-db-altbericht-import-paket-c1-commit.sql' },
  { value: 'docs/sql/mandanten-db-altbericht-import-paket-c2-defects.sql' },
  { value: 'docs/sql/mandanten-db-altbericht-import-paket-d-proposed-id-match-key.sql' },
  { value: 'docs/sql/mandanten-db-altbericht-import-paket-e-embedded-images.sql' },
  { value: 'docs/sql/mandanten-db-altbericht-import-paket-f-embedded-image-productive.sql' },
  { value: 'docs/sql/mandanten-db-altbericht-import-paket-g-embedded-scan-meta.sql' },
]

const MandantenAktualisieren = () => {
  const [rolloutSending, setRolloutSending] = useState(false)
  const [rolloutTarget, setRolloutTarget] = useState<MandantenRolloutTarget>('staging')
  const [rolloutSqlFile, setRolloutSqlFile] = useState(DEFAULT_ROLLOUT_SQL)
  const [rolloutMessage, setRolloutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  /**
   * Bestehende Rollout-Logik 1:1 aus Einstellungen.tsx übernommen – der Edge-Function/
   * GitHub-Workflow-Pfad bleibt unverändert. Nur Routing/UI wird neu strukturiert.
   */
  const handleRollout = async (mode: MandantenRolloutMode) => {
    const sql = rolloutSqlFile.trim() || DEFAULT_ROLLOUT_SQL
    if (mode === 'apply') {
      const scope =
        rolloutTarget === 'production'
          ? 'PRODUKTION (Secret MANDANTEN_DB_URLS_PRODUCTION oder Legacy MANDANTEN_DB_URLS)'
          : 'Staging (Secret MANDANTEN_DB_URLS_STAGING)'
      const ok = window.confirm(
        `Echtlauf starten?\n\nZiel: ${scope}\nSQL-Datei (im Repo): ${sql}\n\nVorher Trockenlauf mit gleichen Einstellungen und GitHub Actions-Logs prüfen.`
      )
      if (!ok) return
    }
    setRolloutSending(true)
    setRolloutMessage(null)
    try {
      const r = await triggerMandantenDbRollout({
        mode,
        target: rolloutTarget,
        sql_file: sql,
      })
      if (r.ok) {
        setRolloutMessage({ type: 'success', text: r.message ?? 'Anfrage gesendet.' })
      } else {
        setRolloutMessage({ type: 'error', text: r.error })
      }
    } catch (e) {
      setRolloutMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Anfrage fehlgeschlagen.',
      })
    } finally {
      setRolloutSending(false)
    }
  }

  const isProduction = rolloutTarget === 'production'

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Mandanten aktualisieren</h2>
        <p className="text-sm text-slate-600 mt-1">
          Zentraler Bereich für alle Update-Themen rund um Mandanten-Systeme: Datenbank-Sammelupdates,
          App-Releases und mandantenspezifische Anpassungen. Aktuell verfügbar: SQL-Rollouts für
          Mandanten-Datenbanken.
        </p>
      </header>

      {/* Abschnitt 1 – Datenbank aktualisieren */}
      <section
        className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="db-rollout-heading"
      >
        <h3 id="db-rollout-heading" className="text-sm font-semibold text-slate-700 mb-2">
          1. Datenbank aktualisieren
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Startet den GitHub-Workflow{' '}
          <strong className="font-mono text-[11px]">Mandanten-DB – Rollout (psql)</strong>. Secrets:{' '}
          <code className="bg-slate-100 px-1 rounded">MANDANTEN_DB_URLS_STAGING</code> und{' '}
          <code className="bg-slate-100 px-1 rounded">MANDANTEN_DB_URLS_PRODUCTION</code> (je eine
          Postgres-URI pro Zeile). Wenn PRODUCTION fehlt, wird{' '}
          <code className="bg-slate-100 px-1 rounded">MANDANTEN_DB_URLS</code> (Legacy) genutzt. Die
          SQL-Datei muss auf <code className="bg-slate-100 px-1 rounded">main</code> existieren. Siehe{' '}
          <code className="text-[11px]">docs/sql/Mandanten-DB-Workflow.md</code>.
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label htmlFor="rollout-target" className="block text-xs font-medium text-slate-600 mb-1">
              Zielumgebung
            </label>
            <select
              id="rollout-target"
              value={rolloutTarget}
              onChange={(e) => setRolloutTarget(e.target.value as MandantenRolloutTarget)}
              disabled={rolloutSending}
              className={`w-full max-w-md px-3 py-2 rounded-lg border text-sm bg-white ${
                isProduction
                  ? 'border-red-400 text-red-800 ring-1 ring-red-200'
                  : 'border-slate-300 text-slate-800'
              }`}
              aria-describedby={isProduction ? 'rollout-target-prod-warn' : undefined}
            >
              <option value="staging">Staging (Referenz-Mandant / Test)</option>
              <option value="production">Produktion (alle Prod-DBs im Secret)</option>
            </select>
            {isProduction ? (
              <p
                id="rollout-target-prod-warn"
                className="text-xs text-red-700 mt-1 font-medium"
                role="status"
              >
                Achtung: Produktion läuft gegen alle live-Mandanten-DBs. Erst Trockenlauf prüfen.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="rollout-sql-file" className="block text-xs font-medium text-slate-600 mb-1">
              SQL-Datei im Repo (relativer Pfad)
            </label>
            <input
              id="rollout-sql-file"
              type="text"
              value={rolloutSqlFile}
              onChange={(e) => setRolloutSqlFile(e.target.value)}
              disabled={rolloutSending}
              list="rollout-sql-presets"
              autoComplete="off"
              className="w-full max-w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono text-slate-800 bg-white"
              placeholder={DEFAULT_ROLLOUT_SQL}
              aria-describedby="rollout-sql-hint"
            />
            <datalist id="rollout-sql-presets">
              {SQL_FILE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.hint ?? ''}
                </option>
              ))}
            </datalist>
            <p id="rollout-sql-hint" className="text-xs text-slate-500 mt-1">
              Erlaubt: <code className="bg-slate-100 px-1 rounded">supabase-complete.sql</code> oder{' '}
              <code className="bg-slate-100 px-1 rounded">docs/sql/…/name.sql</code> (nach Push auf
              main).
            </p>
          </div>
        </div>

        {rolloutMessage ? (
          <p
            className={`mb-3 text-sm whitespace-pre-line ${
              rolloutMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
            }`}
            role="status"
          >
            {rolloutMessage.text}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleRollout('dry_run')}
            disabled={rolloutSending}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 disabled:opacity-50 min-h-[44px]"
            aria-label="Trockenlauf Mandanten-DB-Rollout starten"
          >
            {rolloutSending ? 'Sende…' : 'Trockenlauf'}
          </button>
          <button
            type="button"
            onClick={() => void handleRollout('apply')}
            disabled={rolloutSending}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 min-h-[44px] ${
              isProduction ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
            aria-label="Echtlauf Mandanten-DB-Rollout starten"
          >
            {rolloutSending
              ? 'Sende…'
              : isProduction
                ? 'Echtlauf · Produktion'
                : 'Echtlauf · Staging'}
          </button>
        </div>
      </section>

      {/* Abschnitt 2 – Sicherheitsbereich */}
      <section
        className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200"
        aria-labelledby="db-rollout-safety-heading"
      >
        <h3
          id="db-rollout-safety-heading"
          className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2"
        >
          <span aria-hidden>⚠</span>
          2. Sicherheitsbereich
        </h3>
        <ul className="list-disc pl-5 text-xs text-amber-900 space-y-1 leading-relaxed">
          <li>Änderungen wirken auf Mandanten-Systeme – jede Aktion ist auditierbar in GitHub Actions.</li>
          <li>
            Vor jedem Echtlauf den <strong>Trockenlauf</strong> mit identischen Einstellungen prüfen
            (URL-Liste, Skript-Pfad, Ziel).
          </li>
          <li>
            <strong>Production</strong> bewusst auswählen. Die rote Markierung am Ziel-Dropdown und
            am Echtlauf-Button warnt vor Produktivlauf.
          </li>
          <li>
            Nur freigegebene SQL-Dateien aus dem Repo nutzen. Die Edge-Function akzeptiert nur{' '}
            <code className="bg-amber-100 px-1 rounded">supabase-complete.sql</code> oder{' '}
            <code className="bg-amber-100 px-1 rounded">docs/sql/…/*.sql</code>.
          </li>
          <li>
            Bei Fehlern bricht der Workflow am ersten Mandanten ab (
            <code className="bg-amber-100 px-1 rounded">ON_ERROR_STOP=1</code>) – Folge-Mandanten
            werden nicht halb-appliziert.
          </li>
        </ul>
      </section>

      {/* Abschnitt 3 – Bald verfügbar (Platzhalter) */}
      <section
        className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="db-rollout-soon-heading"
      >
        <h3 id="db-rollout-soon-heading" className="text-sm font-semibold text-slate-700 mb-3">
          3. Bald verfügbar
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <article className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <h4 className="text-sm font-semibold text-slate-700 mb-1">App-Releases</h4>
            <p className="text-xs text-slate-600 leading-snug">
              Mandanten-App-Releases werden hier ergänzt. Bis dahin im Bereich{' '}
              <Link to="/app-releases" className="text-vico-primary hover:underline">
                App-Releases
              </Link>{' '}
              und{' '}
              <Link to="/release-rollout" className="text-vico-primary hover:underline">
                Rollout &amp; Deploy
              </Link>{' '}
              verwalten.
            </p>
          </article>
          <article className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <h4 className="text-sm font-semibold text-slate-700 mb-1">Rollout-Historie</h4>
            <p className="text-xs text-slate-600 leading-snug">
              Historie folgt: pro Lauf Mandanten, Status, Logs. Aktuell sind alle Läufe in den{' '}
              <a
                href="https://github.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-vico-primary hover:underline"
              >
                GitHub-Actions-Logs
              </a>{' '}
              auffindbar.
            </p>
          </article>
          <article className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <h4 className="text-sm font-semibold text-slate-700 mb-1">Mandanten-Auswahl</h4>
            <p className="text-xs text-slate-600 leading-snug">
              Gezielte Auswahl einzelner Mandanten folgt. Heute läuft der Workflow gegen alle
              URLs des gewählten Secrets (staging/production).
            </p>
          </article>
          <article className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <h4 className="text-sm font-semibold text-slate-700 mb-1">Versionsübersicht</h4>
            <p className="text-xs text-slate-600 leading-snug">
              Versionsstände pro Mandant (Schema, App, Modul) folgen. Bis dahin via{' '}
              <code className="bg-slate-100 px-1 rounded">CHANGELOG-Mandanten-DB.md</code> und{' '}
              <Link to="/release-audit" className="text-vico-primary hover:underline">
                Release-Audit
              </Link>
              .
            </p>
          </article>
        </div>
      </section>
    </div>
  )
}

export default MandantenAktualisieren
