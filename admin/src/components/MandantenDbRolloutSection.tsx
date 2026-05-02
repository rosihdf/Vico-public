import { useMemo } from 'react'
import type { MandantenRolloutMode, MandantenRolloutTarget } from '../lib/mandantenRolloutService'
import {
  mandantenDbModuleDisplayName,
  mandantenDbProductDisplayName,
  type MandantenDbUpdatePackage,
  type MandantenDbUpdatePackageModuleKey,
  type MandantenDbUpdatePackageProductKey,
} from '../lib/mandantenDbUpdatePackages'

export type MandantenDbDispatchFeedback =
  | {
      ok: true
      mode: MandantenRolloutMode
      target: MandantenRolloutTarget
      packageLabel: string
      module: string
      sqlFile: string
      startedAtIso: string
      startedAtDisplay: string
      serverMessage?: string
      runId?: string
      onOpenHistoryTab?: () => void
    }
  | {
      ok: false
      mode: MandantenRolloutMode
      target: MandantenRolloutTarget
      packageLabel: string
      module: string
      sqlFile: string
      startedAtIso: string
      startedAtDisplay: string
      error: string
      runId?: string
    }

export type MandantenDbRolloutSectionProps = {
  visiblePackages: ReadonlyArray<MandantenDbUpdatePackage>
  rolloutTarget: MandantenRolloutTarget
  rolloutPackageId: string
  rolloutSending: boolean
  rolloutFeedback: MandantenDbDispatchFeedback | null
  githubActionsUrl: string
  onRolloutTargetChange: (target: MandantenRolloutTarget) => void
  onRolloutPackageIdChange: (id: string) => void
  onDryRun: () => void
  onApply: () => void
  selectedPackage: MandantenDbUpdatePackage | undefined
  isProduction: boolean
  productionWartungAcknowledged: boolean
  onProductionWartungAcknowledgedChange: (value: boolean) => void
  isPackageAllowedForTarget: boolean
  canTrigger: boolean
}

const workflowDisplayName = 'Mandanten-DB – Rollout (psql)'

export const MandantenDbRolloutSection = ({
  visiblePackages,
  rolloutTarget,
  rolloutPackageId,
  rolloutSending,
  rolloutFeedback,
  githubActionsUrl,
  onRolloutTargetChange,
  onRolloutPackageIdChange,
  onDryRun,
  onApply,
  selectedPackage,
  isProduction,
  productionWartungAcknowledged,
  onProductionWartungAcknowledgedChange,
  isPackageAllowedForTarget,
  canTrigger,
}: MandantenDbRolloutSectionProps) => {
  const gh = githubActionsUrl.trim()
  const modeLabel = (m: MandantenRolloutMode) =>
  m === 'dry_run'
    ? 'Trockenlauf (dry_run): Ziele und Workflow prüfen – kein SQL gegen Mandanten-DBs'
    : 'Echtlauf (apply)'

  const rolloutProductSummaries = useMemo(() => {
    const keys = new Set<MandantenDbUpdatePackageProductKey>()
    for (const p of visiblePackages) {
      if (p.productKey) keys.add(p.productKey)
    }
    return [...keys].map((key) => ({
      key,
      displayName: mandantenDbProductDisplayName(key),
    }))
  }, [visiblePackages])

  const rolloutModuleSummaries = useMemo(() => {
    const keys = new Set<MandantenDbUpdatePackageModuleKey>()
    for (const p of visiblePackages) {
      keys.add(p.moduleKey)
    }
    return [...keys].map((key) => ({
      key,
      displayName: mandantenDbModuleDisplayName(key),
    }))
  }, [visiblePackages])

  return (
    <section
      className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4"
      aria-labelledby="db-rollout-heading"
    >
      <div>
        <h3 id="db-rollout-heading" className="text-sm font-semibold text-slate-700 mb-1">
          Datenbank aktualisieren
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Startet den GitHub-Workflow <strong className="font-mono text-[11px]">{workflowDisplayName}</strong>.
          Secrets:{' '}
          <code className="bg-slate-100 px-1 rounded text-[11px]">MANDANTEN_DB_URLS_STAGING</code> und{' '}
          <code className="bg-slate-100 px-1 rounded text-[11px]">MANDANTEN_DB_URLS_PRODUCTION</code> (je eine
          Postgres-URI pro Zeile). Wenn PRODUCTION fehlt, wird{' '}
          <code className="bg-slate-100 px-1 rounded text-[11px]">MANDANTEN_DB_URLS</code> (Legacy) genutzt. Die
          SQL-Datei muss auf <code className="bg-slate-100 px-1 rounded text-[11px]">main</code> existieren. Siehe{' '}
          <code className="text-[11px]">docs/sql/Mandanten-DB-Workflow.md</code>.
        </p>
        <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2 py-2 leading-relaxed m-0 mt-2">
          <strong>Trockenlauf:</strong> Nur maskierte Ziel-URLs aus dem GitHub-Secret ermitteln und im Lizenzportal als
          Targets speichern (Status „Übersprungen“) –{' '}
          <strong>kein SQL gegen Mandanten-Datenbanken</strong>. Dient zur Kontrolle vor dem Echtlauf.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="rollout-target" className="block text-xs font-medium text-slate-600 mb-1">
            Zielumgebung
          </label>
          <select
            id="rollout-target"
            value={rolloutTarget}
            onChange={(e) => onRolloutTargetChange(e.target.value as MandantenRolloutTarget)}
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
            <p id="rollout-target-prod-warn" className="text-xs text-red-700 mt-1 font-medium" role="status">
              Achtung: Produktion läuft gegen alle live-Mandanten-DBs. Erst Trockenlauf prüfen.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="rollout-package" className="block text-xs font-medium text-slate-600 mb-1">
            Update-Paket
          </label>
          <select
            id="rollout-package"
            value={rolloutPackageId}
            onChange={(e) => onRolloutPackageIdChange(e.target.value)}
            disabled={rolloutSending || visiblePackages.length === 0}
            className="w-full max-w-md px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 bg-white"
            aria-describedby="rollout-package-hint"
          >
            {visiblePackages.length === 0 ? (
              <option value="">Keine freigegebenen Pakete verfügbar</option>
            ) : (
              visiblePackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {p.module} – {p.description}
                </option>
              ))
            )}
          </select>
          <p id="rollout-package-hint" className="text-xs text-slate-500 mt-1">
            Auswahl beschränkt auf freigegebene Complete-/Rollout-Pakete. Einzelpakete (A–G, Hotfixes) sind hier
            bewusst nicht enthalten – siehe <code className="text-[11px]">docs/sql/Mandanten-DB-Workflow.md</code>.
          </p>
          {rolloutProductSummaries.length > 0 || rolloutModuleSummaries.length > 0 ? (
            <p className="text-xs text-slate-600 mt-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5 leading-relaxed">
              {rolloutProductSummaries.length > 0 ? (
                <>
                  <span className="font-medium text-slate-700">Produktzuordnung (statisch): </span>
                  {rolloutProductSummaries.map((s, i) => (
                    <span key={s.key}>
                      {i > 0 ? ' · ' : null}
                      {s.displayName} (<code className="text-[11px]">{s.key}</code>)
                    </span>
                  ))}
                  .{' '}
                </>
              ) : null}
              {rolloutModuleSummaries.length > 0 ? (
                <>
                  <span className="font-medium text-slate-700">Modul-Schicht (Rollout): </span>
                  {rolloutModuleSummaries.map((s, i) => (
                    <span key={s.key}>
                      {i > 0 ? ' · ' : null}
                      {s.displayName} (<code className="text-[11px]">{s.key}</code>)
                    </span>
                  ))}
                  .{' '}
                </>
              ) : null}
              Zielmodell:{' '}
              <code className="text-[11px]">docs/Lizenzportal-Multi-App-und-DB-Rollout-Zielmodell.md</code>
              {' · '}
              <code className="text-[11px]">docs/Lizenzportal-Multi-App-Leitlinie.md</code>.
            </p>
          ) : null}
        </div>

        {selectedPackage ? (
          <div
            className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2"
            aria-label="Details zum gewählten Paket"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-slate-800">{selectedPackage.label}</span>
              <span className="text-xs text-slate-500">{selectedPackage.module}</span>
            </div>
            <div className="text-xs text-slate-600">
              <span className="text-slate-500">SQL-Datei:</span>{' '}
              <code className="bg-white border border-slate-200 px-1 rounded font-mono">{selectedPackage.sqlFile}</code>
            </div>
            <div className="text-xs text-slate-600">
              <span className="text-slate-500">Modul (Rollout):</span>{' '}
              <span className="font-medium text-slate-800">
                {mandantenDbModuleDisplayName(selectedPackage.moduleKey)}
              </span>{' '}
              <span className="text-slate-400">
                (<code className="text-[11px]">{selectedPackage.moduleKey}</code>)
              </span>
            </div>
            {selectedPackage.productKey ? (
              <div className="text-xs text-slate-600">
                <span className="text-slate-500">Produkt:</span>{' '}
                <span className="font-medium text-slate-800">
                  {mandantenDbProductDisplayName(selectedPackage.productKey)}
                </span>{' '}
                <span className="text-slate-400">
                  (<code className="text-[11px]">{selectedPackage.productKey}</code>)
                </span>
              </div>
            ) : null}
            <p className="text-xs text-slate-700 leading-relaxed">{selectedPackage.description}</p>
            {selectedPackage.risk ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 leading-relaxed">
                <strong className="font-semibold">Hinweis:</strong> {selectedPackage.risk}
              </p>
            ) : null}
            <div
              className={`text-xs font-medium ${isPackageAllowedForTarget ? 'text-green-700' : 'text-red-700'}`}
            >
              {selectedPackage.targetAllowed === 'both'
                ? 'Freigegeben für Staging und Produktion.'
                : selectedPackage.targetAllowed === 'staging'
                  ? 'Nur für Staging freigegeben.'
                  : 'Nur für Produktion freigegeben.'}
              {!isPackageAllowedForTarget ? (
                <>
                  {' '}
                  Aktuelles Ziel: <strong>{isProduction ? 'Produktion' : 'Staging'}</strong> – bitte anpassen.
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {isProduction ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <div className="flex gap-3 items-start">
            <input
              id="rollout-production-wartung-check"
              type="checkbox"
              checked={productionWartungAcknowledged}
              onChange={(e) => onProductionWartungAcknowledgedChange(e.target.checked)}
              disabled={rolloutSending}
              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
              aria-describedby="rollout-production-wartung-hint"
            />
            <label
              htmlFor="rollout-production-wartung-check"
              className="text-sm font-medium text-slate-800 leading-snug cursor-pointer"
            >
              Wartung / Kundenkommunikation geprüft
            </label>
          </div>
          <p id="rollout-production-wartung-hint" className="text-xs text-slate-600 m-0 pl-7 leading-relaxed">
            Bestätige, dass Wartungsmodus, Wartungsankündigung oder Kundenkommunikation für diesen Production-Rollout
            geprüft wurden.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDryRun}
          disabled={!canTrigger}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          aria-label="Trockenlauf Mandanten-DB-Rollout starten"
        >
          {rolloutSending ? 'Sende…' : 'Trockenlauf'}
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={!canTrigger || (isProduction && !productionWartungAcknowledged)}
          title={
            isProduction && !productionWartungAcknowledged
              ? 'Für Production-Echtlauf zuerst die Checkbox „Wartung / Kundenkommunikation geprüft“ aktivieren.'
              : undefined
          }
          className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] ${
            isProduction ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
          }`}
          aria-label="Echtlauf Mandanten-DB-Rollout starten"
        >
          {rolloutSending ? 'Sende…' : isProduction ? 'Echtlauf · Produktion' : 'Echtlauf · Staging'}
        </button>
      </div>

      {rolloutFeedback ? (
        <div
          className={`rounded-lg border p-3 text-sm space-y-2 ${
            rolloutFeedback.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold m-0">
            {rolloutFeedback.ok ? 'Workflow wurde angestoßen' : 'Anstoß fehlgeschlagen'}
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs m-0">
            <dt className="text-slate-600">Paket</dt>
            <dd className="m-0 font-medium">{rolloutFeedback.packageLabel}</dd>
            <dt className="text-slate-600">Modul</dt>
            <dd className="m-0">{rolloutFeedback.module}</dd>
            <dt className="text-slate-600">SQL-Datei</dt>
            <dd className="m-0 font-mono break-all">{rolloutFeedback.sqlFile}</dd>
            <dt className="text-slate-600">Zielumgebung</dt>
            <dd className="m-0">{rolloutFeedback.target === 'production' ? 'Produktion' : 'Staging'}</dd>
            <dt className="text-slate-600">Modus</dt>
            <dd className="m-0">{modeLabel(rolloutFeedback.mode)}</dd>
            <dt className="text-slate-600">Zeitpunkt</dt>
            <dd className="m-0">{rolloutFeedback.startedAtDisplay}</dd>
            {rolloutFeedback.ok && rolloutFeedback.runId ? (
              <>
                <dt className="text-slate-600">Run-ID</dt>
                <dd className="m-0 font-mono break-all">{rolloutFeedback.runId}</dd>
              </>
            ) : null}
          </dl>
          {rolloutFeedback.ok && rolloutFeedback.serverMessage ? (
            <p className="text-xs m-0 border-t border-emerald-200 pt-2">{rolloutFeedback.serverMessage}</p>
          ) : null}
          {rolloutFeedback.ok && rolloutFeedback.runId && rolloutFeedback.onOpenHistoryTab ? (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-200">
              <button
                type="button"
                className="rounded-lg border border-emerald-700/30 bg-white px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100/40 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-vico-primary"
                onClick={rolloutFeedback.onOpenHistoryTab}
              >
                Zur Historie / Details
              </button>
            </div>
          ) : null}
          {!rolloutFeedback.ok && 'error' in rolloutFeedback ? (
            <p className="text-xs m-0 border-t border-red-200 pt-2 whitespace-pre-wrap">{rolloutFeedback.error}</p>
          ) : null}
          <p className="text-xs m-0 border-t border-black/10 pt-2 text-slate-700">
            Workflow (GitHub): <span className="font-mono">{workflowDisplayName}</span>. Ausführung und Logs siehe{' '}
            {gh && /^https?:\/\//i.test(gh) ? (
              <a href={gh} target="_blank" rel="noopener noreferrer" className="text-vico-primary font-medium underline">
                GitHub Actions
              </a>
            ) : (
              <>GitHub Actions im Repository (optional Umgebungsvariable VITE_GITHUB_ACTIONS_URL für Direktlink).</>
            )}
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-1">
        <p className="font-semibold m-0 flex items-center gap-2">
          <span aria-hidden>⚠</span> Sicherheit
        </p>
        <ul className="list-disc pl-5 m-0 space-y-1 leading-relaxed">
          <li>Jede Aktion ist in GitHub Actions nachvollziehbar.</li>
          <li>
            Vor jedem Echtlauf den <strong>Trockenlauf</strong> mit gleichem Paket und Ziel ausführen.
          </li>
          <li>
            Nur freigegebene SQL-Pfade; die Edge Function akzeptiert{' '}
            <code className="bg-amber-100 px-0.5 rounded">supabase-complete.sql</code> oder{' '}
            <code className="bg-amber-100 px-0.5 rounded">docs/sql/…/*.sql</code>.
          </li>
          <li>
            Beim Echtlauf mit Lizenzportal-Protokoll (<code className="bg-amber-100 px-0.5 rounded">run_id</code>):
            Fehler an einem Mandanten stoppen nur dessen SQL (<code className="bg-amber-100 px-0.5 rounded">ON_ERROR_STOP=1</code> je psql);{' '}
            es wird mit der nächsten URL fortgefahren (Teilerfolg möglich).
          </li>
        </ul>
      </div>
    </section>
  )
}
