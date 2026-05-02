# SQL & Mandanten-Datenbank

| Dokument | Inhalt |
|----------|--------|
| [**Mandanten-DB-Workflow.md**](./Mandanten-DB-Workflow.md) | **Start hier:** Inventar, Changelog, Skripte, Lizenzadmin → GitHub-Rollout |
| [**SQL-Struktur-und-Paketkonvention.md**](./SQL-Struktur-und-Paketkonvention.md) | **Phase 1:** Ordnerlogik, Complete-SQL-Regeln, Pakete A–G, Übergangs-/Zielstruktur |
| [**Lizenzportal-Multi-App-Leitlinie.md**](../Lizenzportal-Multi-App-Leitlinie.md) | Multi-App-Zielbild, Produkt vs. Portal, `product_key` |
| [**Lizenzportal-Multi-App-und-DB-Rollout-Zielmodell.md**](../Lizenzportal-Multi-App-und-DB-Rollout-Zielmodell.md) | **Architektur:** ArioVan-Module, Lizenzmodell, `module_key` am Rollout, Historie-Skizze, UI-Zielbild |
| [**CHANGELOG-Mandanten-DB.md**](./CHANGELOG-Mandanten-DB.md) | Chronologische **Delta-SQLs** für bestehende Mandanten-DBs |
| [**Supabase-Migrations-Strategie.md**](./Supabase-Migrations-Strategie.md) | Langfristig: `supabase/migrations/`, Baseline, CLI |
| [**Supabase-Schema-Übersicht.md**](./Supabase-Schema-Übersicht.md) | Schema-Referenz (Stand der Doku) |

## Zwei Datenbanken

| Datenbank | Typische SQL-Quellen im Repo |
|-----------|------------------------------|
| **Mandanten-Haupt-App** (ein Supabase-Projekt pro Mandant) | Root **`supabase-complete.sql`**, **`docs/sql/mandanten-db-*.sql`** |
| **Lizenzportal** (zentrale Verwaltung) | Root **`supabase-license-portal.sql`**, **`docs/sql/LP-*.sql`**, **`docs/sql/license-portal-*.sql`** |

Nicht mischen: Mandanten-Rollout-URL-Listen gelten nur für **Mandanten-DBs**.

## Pfad-Inventar (Mandanten-DB)

### Gesamtstände („Complete“)

| Datei | Beschreibung |
|-------|----------------|
| `supabase-complete.sql` (Repo-Root) | Vollständiges Schema Haupt-App; idempotent; Inhaltsverzeichnis im Dateikopf. |
| `docs/sql/mandanten-db-altbericht-import-complete.sql` | Altbericht-Import A–G + `objects.anforderung`; idempotent; Reihenfolge im Kopfkommentar. |

### Altbericht-Import Einzelpakete (A–G)

| Paket | Datei unter `docs/sql/` |
|-------|-------------------------|
| A | `mandanten-db-altbericht-import-paket-a.sql` |
| B | `mandanten-db-altbericht-import-paket-b-review.sql` |
| C1 | `mandanten-db-altbericht-import-paket-c1-commit.sql` |
| C2 | `mandanten-db-altbericht-import-paket-c2-defects.sql` |
| D | `mandanten-db-altbericht-import-paket-d-proposed-id-match-key.sql` |
| E | `mandanten-db-altbericht-import-paket-e-embedded-images.sql` |
| F | `mandanten-db-altbericht-import-paket-f-embedded-image-productive.sql` |
| G | `mandanten-db-altbericht-import-paket-g-embedded-scan-meta.sql` |

Zusätzlich (auch in Complete eingebunden): **`mandanten-db-objects-anforderung.sql`**

### Weitere Mandanten-Deltas

| Datei | Kurz (Details → CHANGELOG) |
|-------|---------------------------|
| `mandanten-db-stammdaten-archived-at.sql` | Archiv-Spalten Stammdaten, RPCs |
| `mandanten-db-calc-soll-date-range.sql` | Soll-Datum Bereiche |
| `mandanten-db-fix-auth-user-delete-fks.sql` | Auth-/FK-Reparatur |
| `mandanten-db-repair-objects-customer-id.sql` | `objects.customer_id` nachziehen |
| `mandanten-db-set-license-number-safe-update.sql` | RPC safe_update |
| `mandanten-db-azk-stammdaten-migration.sql` | AZK-Stammdaten |

## Lizenzportal / Releases / Seeds (Auswahl unter `docs/sql/`)

Keine Mandanten-Rollouts ohne Absprache:

- `LP-rollout-all-tenants-latest-published.sql`
- `LP-mandanten-db-rollout-v3.sql` (Rollout-Historie Runs + Targets im Lizenzportal)
- `LP-app-release-*.sql`, `LP-tenants-cf-preview-urls.sql`
- `license-portal-*.sql`, `license-portal-seed-test-app-release.sql`

## Ordner `docs/sql/rollout/`

Reserviert für optional später committierte **zusätzliche** gebündelte Rollout-Dateien. Aktuell ohne Pflicht-Inhalt (z. B. `.gitkeep`). Neue Einträge im Lizenzadmin nur nach Freigabe und Pfadanpassung in Edge/Whitelist.

## Kuratierte Hub-Pakete

Auswahl im Lizenzadmin **„Mandanten aktualisieren“**: nur Einträge mit Status **`ready`** in `admin/src/lib/mandantenDbUpdatePackages.ts` (Derzeit: Supabase Complete, Altbericht-Import Complete). Einzelpakete und Hotfixes bewusst **nicht** im Dropdown.

**Gesamt-Initialisierung** neuer Mandanten-Projekte im SQL Editor: **`supabase-complete.sql`**.

### Logische Module vs. physische Dateien

Die Keys **`moduleKey`** / **`productKey`** im Hub beschreiben die **fachliche Schicht**, nicht zwingend eine eigene SQL-Datei: **`full`** entspricht der monolithischen Datei `supabase-complete.sql`; **`altbericht_import`** hat ein dediziertes Complete-SQL. Weitere Module (**`core`**, **`maintenance`**, **`portal`**, **`time`**) sind für Deltas und künftige optionale Complete-Bündel reserviert – siehe [**SQL-Struktur-und-Paketkonvention.md** §11–§13](./SQL-Struktur-und-Paketkonvention.md).
