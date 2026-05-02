/**
 * Zentrale Liste der freigegebenen Mandanten-DB-Update-Pakete.
 *
 * Multi-App / DB-Rollout: **`productKey`** und **`moduleKey`** (statisch, ohne DB) –
 * siehe **`docs/Lizenzportal-Multi-App-und-DB-Rollout-Zielmodell.md`** und
 * **`docs/Lizenzportal-Multi-App-Leitlinie.md`**.
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

export type MandantenDbUpdatePackageProductKey = 'ariovan'

/** Anzeigename zum technischen productKey (statisch, kein DB-Feld). */
export const MANDANTEN_DB_PRODUCT_DISPLAY_NAMES: Record<MandantenDbUpdatePackageProductKey, string> = {
  ariovan: 'ArioVan',
}

export const mandantenDbProductDisplayName = (
  key: MandantenDbUpdatePackageProductKey
): string => MANDANTEN_DB_PRODUCT_DISPLAY_NAMES[key] ?? key

/** Logische Rollout-/Schema-Schicht der Mandanten-DB (Zielmodell; keine DB-Spalte). */
export type MandantenDbUpdatePackageModuleKey =
  | 'full'
  | 'core'
  | 'maintenance'
  | 'portal'
  | 'time'
  | 'altbericht_import'

export const MANDANTEN_DB_MODULE_DISPLAY_NAMES: Record<MandantenDbUpdatePackageModuleKey, string> = {
  full: 'Gesamtschema (alle Module, eine DB)',
  core: 'Kern / Stammdaten',
  maintenance: 'Wartung & Protokolle',
  portal: 'Kundenportal (datenseitig)',
  time: 'Arbeitszeit (datenseitig)',
  altbericht_import: 'Altbericht-Import',
}

export const mandantenDbModuleDisplayName = (
  key: MandantenDbUpdatePackageModuleKey
): string => MANDANTEN_DB_MODULE_DISPLAY_NAMES[key] ?? key

/** Anzeigename für beliebige DB-/API-Werte (Fallback: Rohstring). */
export const mandantenDbProductDisplayNameLoose = (key: string | null | undefined): string => {
  const t = key?.trim()
  if (!t) return '—'
  const k = t as MandantenDbUpdatePackageProductKey
  return MANDANTEN_DB_PRODUCT_DISPLAY_NAMES[k] ?? t
}

/** Anzeigename für beliebige DB-/API-Werte (Fallback: Rohstring). */
export const mandantenDbModuleDisplayNameLoose = (key: string | null | undefined): string => {
  const t = key?.trim()
  if (!t) return '—'
  const k = t as MandantenDbUpdatePackageModuleKey
  return MANDANTEN_DB_MODULE_DISPLAY_NAMES[k] ?? t
}

export type MandantenDbUpdatePackage = {
  /** Stabile ID, wird im UI-State referenziert (kein User-Eingabe-Feld). */
  id: string
  /** Anzeigename im Dropdown („Supabase Complete", …). */
  label: string
  /** Repo-Pfad relativ zur Repo-Wurzel. Wird an die Edge-Function übergeben. */
  sqlFile: string
  /** Technischer Produkt-Schlüssel für spätere Multi-App-Auswahl (Phase 1: nur Kennzeichnung). */
  productKey?: MandantenDbUpdatePackageProductKey
  /**
   * Logische Modul-Schicht (core / portal / time / full / …). Entspricht nicht zwingend einem Deploy-Kanal –
   * Mandanten behalten eine gemeinsame DB.
   */
  moduleKey: MandantenDbUpdatePackageModuleKey
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
    label: 'Gesamtschema Mandanten-DB (supabase-complete.sql)',
    sqlFile: 'supabase-complete.sql',
    productKey: 'ariovan',
    moduleKey: 'full',
    module: 'Plattform / Schema',
    description:
      'Eine Datei für das komplette Mandanten-Schema: Stammdaten, Aufträge, Wartung, Kundenportal, Arbeitszeit, Storage, RLS und Hilfsfunktionen.',
    risk:
      'Berührt das gesamte Schema. Vor Production-Echtlauf zwingend Trockenlauf gegen Staging.',
    status: 'ready',
    targetAllowed: 'both',
  },
  {
    id: 'altbericht-import-complete',
    label: 'Altbericht-Import Sammelpaket (A–G + Objekt-Anforderung)',
    sqlFile: 'docs/sql/mandanten-db-altbericht-import-complete.sql',
    productKey: 'ariovan',
    moduleKey: 'altbericht_import',
    module: 'Altbericht-Import',
    description:
      'Eine Datei: Altbericht-Pakete A bis G in fester Reihenfolge plus objects.anforderung — für bestehende Mandanten ohne Einzelpaket-Fahrplan.',
    risk:
      'Idempotent (drop+create für Constraints/Policies wo nötig; keine DELETEs auf Bestandsdaten; committed-Zeilen unverändert).',
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
