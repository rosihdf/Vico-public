import type { MandantenRolloutTarget } from './mandantenRolloutService'
import type { MandantenDbUpdatePackage } from './mandantenDbUpdatePackages'
import type { MandantenDbRolloutRunRow } from './mandantenDbRolloutRunsService'

export type UpdateHubStatusKind = 'ok' | 'warning' | 'error' | 'neutral'

export type UpdateHubStatusLine = {
  key: string
  label: string
  status: UpdateHubStatusKind
  explanation: string
}

/** Letzter Eintrag aus `mandanten_db_rollout_runs` für die Ampel „Letzter Rollout“. */
export type LatestMandantenDbRolloutSummary =
  | { kind: 'loading' }
  | { kind: 'fetch_error'; message: string }
  | { kind: 'empty' }
  | { kind: 'row'; row: MandantenDbRolloutRunRow }

export type UpdateHubStatusInput = {
  selectedPackage: MandantenDbUpdatePackage | undefined
  rolloutTarget: MandantenRolloutTarget
  /**
   * Im Hub: Checkbox „Wartung / Kundenkommunikation geprüft“ (nur sinnvoll bei `production`).
   * Beeinflusst Ampel-Zeile „Wartung vor Production“.
   */
  productionWartungAcknowledged: boolean
  /** Letzter erfolgreicher Trockenlauf für aktuelles Paket + Ziel (Fingerprint bereits verglichen). */
  dryRunMatchesSelection: boolean
  /** Öffentliche GitHub-Actions-Übersicht (repo), falls in Env gesetzt. */
  githubActionsUrl: string
  /** Aus Lizenzportal-Tabelle `mandanten_db_rollout_runs` (neueste zuerst). */
  latestRollout: LatestMandantenDbRolloutSummary
  /** Gleiche Liste wie Historie (für „aktiver Rollout“ in den Top-N). */
  recentRollouts: ReadonlyArray<{ status: string }>
}

export const computeUpdateHubDbStatusLines = (inp: UpdateHubStatusInput): UpdateHubStatusLine[] => {
  const lines: UpdateHubStatusLine[] = []

  lines.push({
    key: 'package',
    label: 'SQL-Paket gewählt',
    status: inp.selectedPackage ? 'ok' : 'error',
    explanation: inp.selectedPackage
      ? `Aktiv: ${inp.selectedPackage.label} (${inp.selectedPackage.module}).`
      : 'Kein Paket ausgewählt oder keine freigegebenen Pakete geladen.',
  })

  lines.push({
    key: 'target',
    label: 'Zielumgebung gewählt',
    status: 'ok',
    explanation:
      inp.rolloutTarget === 'production'
        ? 'Produktion – alle Mandanten-DBs aus dem Production-Secret (oder Legacy).'
        : 'Staging – URLs aus MANDANTEN_DB_URLS_STAGING.',
  })

  const prodNeedsDry =
    inp.rolloutTarget === 'production' && inp.selectedPackage && !inp.dryRunMatchesSelection
  lines.push({
    key: 'dry_run_prod',
    label: 'Dry-Run vor Production empfohlen',
    status:
      inp.rolloutTarget === 'staging'
        ? 'ok'
        : prodNeedsDry
          ? 'warning'
          : inp.rolloutTarget === 'production' && inp.selectedPackage
            ? 'ok'
            : 'neutral',
    explanation:
      inp.rolloutTarget === 'staging'
        ? 'Bei Staging ist ein Echtlauf weniger riskant – Trockenlauf bleibt zur Kontrolle der URL-Liste sinnvoll.'
        : prodNeedsDry
          ? 'Vor Production-Echtlauf denselben Stand mit „Trockenlauf“ prüfen (gleiches Paket und Ziel).'
          : inp.rolloutTarget === 'production' && inp.selectedPackage
            ? 'Für die aktuelle Auswahl wurde ein erfolgreicher Trockenlauf registriert (dieses Gerät / diese Sitzung).'
            : 'Nach Paketauswahl und bei Production zuerst Trockenlauf ausführen.',
  })

  lines.push({
    key: 'wartung_prod',
    label: 'Wartung vor Production',
    status:
      inp.rolloutTarget !== 'production'
        ? 'neutral'
        : inp.productionWartungAcknowledged
          ? 'ok'
          : 'warning',
    explanation:
      inp.rolloutTarget !== 'production'
        ? 'Nur für Production-Rollouts relevant.'
        : inp.productionWartungAcknowledged
          ? 'Wartung / Kommunikation wurde für diesen Rollout bestätigt.'
          : 'Vor Production-Echtlauf Wartungsmodus oder Mandantenkommunikation prüfen.',
  })

  const gh = inp.githubActionsUrl.trim()
  lines.push({
    key: 'github',
    label: 'GitHub Actions',
    status: 'neutral',
    explanation: gh
      ? `Erreichbarkeit des Workflows wird hier nicht technisch geprüft. Logs: ${gh}`
      : 'Nicht automatisch geprüft. Workflow „Mandanten-DB – Rollout (psql)“ im GitHub-Repo unter Actions öffnen (optional VITE_GITHUB_ACTIONS_URL setzen für Direktlink).',
  })

  const lr = inp.latestRollout
  if (lr.kind === 'loading') {
    lines.push({
      key: 'last_rollout',
      label: 'Letzter Rollout',
      status: 'neutral',
      explanation: 'Rollout-Historie wird geladen …',
    })
  } else if (lr.kind === 'fetch_error') {
    lines.push({
      key: 'last_rollout',
      label: 'Letzter Rollout',
      status: 'neutral',
      explanation: `Historie konnte nicht geladen werden (${lr.message}).`,
    })
  } else if (lr.kind === 'empty') {
    lines.push({
      key: 'last_rollout',
      label: 'Letzter Rollout',
      status: 'neutral',
      explanation:
        'Noch kein Eintrag im Lizenzportal – es wurde noch kein Mandanten-DB-Rollout hier protokolliert (nach Deploy der Tabelle und Edge-Function).',
    })
  } else {
    const row = lr.row
    const st = row.status
    const t = new Date(row.started_at)
    const disp = Number.isNaN(t.getTime())
      ? row.started_at
      : t.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })

    let lineStatus: UpdateHubStatusKind = 'neutral'
    let explanation = `Letzter Eintrag (${disp}) · ${row.sql_file} · Status: ${st}.`

    if (st === 'success') {
      lineStatus = 'ok'
      explanation = `Letzter Rollout erfolgreich (${disp}) · ${row.sql_file}.`
    } else if (st === 'partial') {
      lineStatus = 'warning'
      explanation = `Letzter Rollout mit Teilerfolg (${disp}) · ${row.sql_file} – Details und Fehlerauszüge im Tab Historie.`
    } else if (st === 'error') {
      lineStatus = 'error'
      explanation = `Letzter Rollout fehlgeschlagen (${disp}) · ${row.sql_file}. Historie / GitHub prüfen.`
    } else if (st === 'running' || st === 'queued') {
      lineStatus = 'warning'
      explanation = `Rollout läuft oder wartet (${disp}) · ${row.sql_file}. Status wird über GitHub-Callback aktualisiert.`
    } else if (st === 'cancelled') {
      lineStatus = 'neutral'
      explanation = `Letzter Eintrag abgebrochen (${disp}) · ${row.sql_file}.`
    }

    lines.push({
      key: 'last_rollout',
      label: 'Letzter Rollout',
      status: lineStatus,
      explanation,
    })
  }

  const activeInRecent = inp.recentRollouts.some((r) => r.status === 'queued' || r.status === 'running')
  if (activeInRecent) {
    lines.push({
      key: 'active_rollout',
      label: 'Aktiver Rollout',
      status: 'warning',
      explanation:
        'Mindestens ein Eintrag in der aktuellen Historienliste ist noch nicht abgeschlossen (wartend oder laufend). Tab „Historie“ oder GitHub Actions öffnen.',
    })
  }

  return lines
}
