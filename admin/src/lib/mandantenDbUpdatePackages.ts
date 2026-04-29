/**
 * Zentrale Liste der freigegebenen Mandanten-DB-Update-Pakete.
 *
 * Wird vom Lizenzadmin-Bereich „Mandanten aktualisieren" genutzt, damit
 * Admins **nur** kuratierte Complete-/Rollout-Dateien auswählen können
 * (kein Freitext, keine Einzelpakete A–G als Standard-Auswahl).
 *
 * Sicherheit:
 * - Diese Liste ist nur eine UI-Komfort-Schicht.
 * - Die Edge-Function `trigger-mandanten-db-rollout` validiert den
 *   `sql_file`-Pfad serverseitig (Whitelist `supabase-complete.sql` oder
 *   `docs/sql/…/*.sql`, keine Pfad-Traversal). Diese Frontend-Auswahl
 *   ersetzt **nicht** die serverseitige Prüfung.
 *
 * Pflege:
 * - Neue Complete-/Rollout-Datei kommt mit `status: 'ready'` hinzu.
 * - Einzel-/Hotfix-Pakete bleiben unter `docs/sql/` für Reparatur-Zwecke
 *   verfügbar, werden aber **nicht** in dieser Liste geführt – sie
 *   gehören in den späteren Experten-/Reparatur-Modus.
 */

export type MandantenDbUpdatePackageStatus = 'ready' | 'hidden' | 'deprecated'
export type MandantenDbUpdatePackageTarget = 'staging' | 'production' | 'both'

export type MandantenDbUpdatePackage = {
  /** Stabile ID, wird im UI-State referenziert (kein User-Eingabe-Feld). */
  id: string
  /** Anzeigename im Dropdown („Supabase Complete", …). */
  label: string
  /** Repo-Pfad relativ zur Repo-Wurzel. Wird an die Edge-Function übergeben. */
  sqlFile: string
  /** Fachliches Modul/Bündel (Plattform, Altbericht-Import, …). */
  module: string
  /** Kurze, einzeilige Beschreibung – im Dropdown und in der Detail-Anzeige. */
  description: string
  /** Optionaler längerer Hinweis-/Risikotext, wird in der Detail-Anzeige gezeigt. */
  risk?: string
  /** Sichtbarkeit im UI. Nur 'ready' wird im Dropdown angezeigt. */
  status: MandantenDbUpdatePackageStatus
  /** Welche Ziel-Umgebungen für dieses Paket erlaubt sind. */
  targetAllowed: MandantenDbUpdatePackageTarget
}

/**
 * Aktuell freigegebene Pakete. Reihenfolge entspricht der Reihenfolge im
 * Dropdown.
 */
export const MANDANTEN_DB_UPDATE_PACKAGES: ReadonlyArray<MandantenDbUpdatePackage> = [
  {
    id: 'supabase-complete',
    label: 'Supabase Complete',
    sqlFile: 'supabase-complete.sql',
    module: 'Plattform / Schema',
    description:
      'Konsolidierter Gesamtstand der Mandanten-DB (Stammtabellen, Helper-Funktionen, RLS, Storage-Buckets).',
    risk:
      'Berührt das gesamte Schema. Vor Production-Echtlauf zwingend Trockenlauf gegen Staging.',
    status: 'ready',
    targetAllowed: 'both',
  },
  {
    id: 'altbericht-import-complete',
    label: 'Altbericht-Import Complete',
    sqlFile: 'docs/sql/mandanten-db-altbericht-import-complete.sql',
    module: 'Altbericht-Import',
    description:
      'Bündelt die Pakete A–G des Altbericht-Imports plus objects.anforderung in einer idempotenten Datei.',
    risk:
      'Idempotent (drop+create für Constraints/Policies, keine DELETEs, committed-Zeilen unangetastet).',
    status: 'ready',
    targetAllowed: 'both',
  },
] as const

/**
 * Gibt nur die im UI sichtbaren Pakete zurück (Status `ready`).
 * Reihenfolge bleibt erhalten.
 */
export const visibleMandantenDbUpdatePackages = (): ReadonlyArray<MandantenDbUpdatePackage> =>
  MANDANTEN_DB_UPDATE_PACKAGES.filter((p) => p.status === 'ready')

/**
 * Sucht ein Paket per ID. Liefert `undefined`, wenn die ID unbekannt ist
 * (z. B. weil das Paket auf `hidden`/`deprecated` gesetzt wurde, nachdem
 * die UI es im State gespeichert hatte).
 */
export const findMandantenDbUpdatePackageById = (
  id: string
): MandantenDbUpdatePackage | undefined =>
  MANDANTEN_DB_UPDATE_PACKAGES.find((p) => p.id === id)

/**
 * Prüft, ob ein Paket gegen das gewählte Ziel laufen darf
 * (Production sperrt staging-only-Pakete und umgekehrt).
 */
export const isMandantenDbUpdatePackageAllowedForTarget = (
  pkg: MandantenDbUpdatePackage,
  target: 'staging' | 'production'
): boolean => pkg.targetAllowed === 'both' || pkg.targetAllowed === target
