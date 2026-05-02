# SQL-Struktur und Paketkonvention (Mandanten-DB)

Stand: Phase 1 (Ordnung & Transparenz, **ohne** Verschieben bestehender Dateien und **ohne** Workflow-Änderungen).

## 1. Aktuelle Repo-Pfade (Alias / Übergang)

Diese Pfade sind **maßgeblich** für Rollouts und dürfen in Phase 1 nicht gebrochen werden:

| Rolle | Pfad | Zweck |
|-------|------|--------|
| **Mandanten-Complete** | Repo-Root `supabase-complete.sql` | Gesamtschema Haupt-App pro Mandanten-Supabase-Projekt (Initialisierung & Synchronisation). |
| **Altbericht-Complete** | `docs/sql/mandanten-db-altbericht-import-complete.sql` | Idempotentes Bündel Altbericht A–G + `objects.anforderung`; empfohlen für Hub-Rollout. |
| **Delta-/Einzelpakete** | `docs/sql/mandanten-db-*.sql` | Historie, Hotfixes, gezielte Nachzieher (nicht alle im Lizenzadmin-Dropdown). |
| **Lizenzportal-DB** | `supabase-license-portal.sql` (Root), diverse `docs/sql/LP-*.sql` / `license-portal-*.sql` | **Andere** Datenbank als Mandanten-DB – nicht über Mandanten-URL-Liste mischen. |
| **Rollout-Staging im Repo** | `docs/sql/rollout/` | Derzeit reserviert (z. B. `.gitkeep`). Workflow akzeptiert `docs/sql/**/*.sql`; bei Bedarf später zusätzliche gebündelte Dateien **hier** ablegen – erst dann Pfade im Hub ergänzen. |

### 1.1 Zielstruktur (noch nicht physisch umgesetzt)

Für spätere Aufräum-Phasen (optional):

- `docs/sql/complete/` – gebündelte „Complete“-Skripte (z. B. Altbericht-Kopie oder neue Sammeldateien).
- `docs/sql/packages/` – versionierte oder thematisch gekapselte Pakete.
- `docs/sql/archive/` – abgelöste Skripte nur noch zur Nachvollziehbarkeit.

**Bis zur Migration:** Dateien bleiben an den **heutigen** Pfaden; Edge-Function und GitHub-Workflow bleiben auf die **bekannten** Whitelist-Pfade ausgerichtet (`supabase-complete.sql` oder `docs/sql/…/*.sql`).

## 2. Altbericht-Import: Pakete A–G

Einzelpakete (Reihenfolge bei Bedarf einzeln ausführbar):

| Paket | Datei |
|-------|--------|
| A | `mandanten-db-altbericht-import-paket-a.sql` |
| B | `mandanten-db-altbericht-import-paket-b-review.sql` |
| C1 | `mandanten-db-altbericht-import-paket-c1-commit.sql` |
| C2 | `mandanten-db-altbericht-import-paket-c2-defects.sql` |
| D | `mandanten-db-altbericht-import-paket-d-proposed-id-match-key.sql` |
| E | `mandanten-db-altbericht-import-paket-e-embedded-images.sql` |
| F | `mandanten-db-altbericht-import-paket-f-embedded-image-productive.sql` |
| G | `mandanten-db-altbericht-import-paket-g-embedded-scan-meta.sql` |

Zusätzlich (oft bereits in Complete eingebunden):

- `mandanten-db-objects-anforderung.sql` – Spalte `objects.anforderung` (Brandschutz-/Normangabe).

**Sammeldatei:** `mandanten-db-altbericht-import-complete.sql` enthält A→G in fester Reihenfolge plus dieses Delta; Kopfkommentar listet die enthaltenen Pakete.

## 3. Weitere Mandanten-Deltas (Auswahl)

Hotfixes und Features **ohne** Altbericht-Bündel (siehe auch `CHANGELOG-Mandanten-DB.md`):

- `mandanten-db-stammdaten-archived-at.sql`
- `mandanten-db-calc-soll-date-range.sql`
- `mandanten-db-fix-auth-user-delete-fks.sql`
- `mandanten-db-repair-objects-customer-id.sql`
- `mandanten-db-set-license-number-safe-update.sql`
- `mandanten-db-azk-stammdaten-migration.sql`

## 4. Was ist eine „Complete-SQL“?

Eine **Complete-SQL** ist eine **einzige ausführbare Datei**, die einen **definierten Gesamtstand** oder ein **vollständiges Feature-Bündel** für Mandanten-DBs beschreibt, sodass Ops dieselbe Datei wiederholt oder auf viele Projekte anwenden kann.

**Zwei Arten im Repo:**

1. **`supabase-complete.sql`** – Vollständiges Mandanten-Haupt-App-Schema (Stammdaten, Aufträge, Protokolle, Portal, Storage, RLS, …). Quelle für neue Mandanten und für große Angleichläufe.
2. **Feature-Complete** (z. B. `mandanten-db-altbericht-import-complete.sql`) – Alle Schritte eines Teilbereichs in **fester Reihenfolge**, idempotent, ohne Datenverlust an produktiven Altbericht-Zeilen (`committed` unangetastet).

## 5. Inhalt und Idempotenz

- **Tabellen:** `create table if not exists`; Spalten: `add column if not exists` mit dokumentierten Defaults/Backfills.
- **Constraints:** Wo nötig `drop … if exists` vor erneutem `add`, damit Re-Runs nicht mit Duplikatnamen scheitern.
- **RLS/Policies:** Postgres hat oft kein `create policy if not exists` – daher **`drop policy if exists …`** vor `create policy` (wie bei Paket E dokumentiert).
- **Funktionen:** `create or replace function` wo möglich; sonst drop + create mit klarer Begründung im Kopfkommentar.
- **Indizes:** `create index if not exists`, außer bewusste Neuanlage nach Messung.
- **Seeds:** Nur, wenn idempotent oder durch Bedingungen geschützt (keine blinden `insert` ohne Konfliktstrategie).

## 6. Umgang mit `DROP`

- Erlaubt für **Constraints, Policies, Trigger, Funktionen**, wenn anschließend wiederhergestellt wird und keine Produktivdaten gelöscht werden.
- **Kein** `DROP TABLE` / `DELETE` auf Bestandsdaten in Standard-Rollouts ohne separates Review.
- Jeder kritische `drop`-Block soll im Kopfkommentar oder direkt daneben **Zweck und Re-Apply-Sicherheit** erklären.

## 7. Kopfkommentar-Pflicht

Jede neue Rollout-relevante Datei soll oben enthalten:

- Zweck und Ziel-DB (**Mandanten** vs. **Lizenzportal**).
- Ob **idempotent** und für **Multi-Mandanten-Rollout** gedacht.
- Bei Complete-Bündeln: **Liste der enthaltenen Pakete/Teile** und **Reihenfolge**.
- Voraussetzungen (z. B. „nach Deploy App-Version X“, „supabase-complete.sql bereits auf Stand Y“).

## 8. Changelog-Pflicht

Neue oder geänderte Mandanten-Deltas:

- Eintrag in [**CHANGELOG-Mandanten-DB.md**](./CHANGELOG-Mandanten-DB.md) (Datum, Datei, Kurzbeschreibung, Bemerkung/Risiko).

## 9. Lizenzadmin „Mandanten aktualisieren“

Nur **kuratierte** Einträge aus `admin/src/lib/mandantenDbUpdatePackages.ts` (Status `ready`) erscheinen im Dropdown. Einzelpakete A–G und kleine Hotfixes bleiben bewusst außerhalb – Ausführung dann manuell (SQL Editor / psql / separates Verfahren).

Siehe [**Mandanten-DB-Workflow.md**](./Mandanten-DB-Workflow.md) §3c (Edge → GitHub, Dry-Run/Echtlauf).

## 10. Multi-App / Produkt-Schlüssel (Vorbereitung)

Am Paket-Typ sind **`productKey`** und **`moduleKey`** gesetzt (statisch; keine DB-Spalte). Anzeigenamen: **`MANDANTEN_DB_PRODUCT_DISPLAY_NAMES`**, **`MANDANTEN_DB_MODULE_DISPLAY_NAMES`** in `mandantenDbUpdatePackages.ts`. Übergeordnete Leitlinien: [**Lizenzportal-Multi-App-und-DB-Rollout-Zielmodell.md**](../Lizenzportal-Multi-App-und-DB-Rollout-Zielmodell.md), [**Lizenzportal-Multi-App-Leitlinie.md**](../Lizenzportal-Multi-App-Leitlinie.md).

## 11. Modul-Matrix (logisch) – Zielbild ohne Dateiverschiebung

**Hinweis:** Die Spalte **„Modul (logisch)“** ordnet Dateien fachlich ein. Viele Bereiche stecken **nur** in `supabase-complete.sql` (monolithisch); es gibt **keine** separaten Complete-Dateien pro Modul, solange nicht ausdrücklich gebaut (siehe §12).

| Modul (`moduleKey`) | Zweck / typische Inhalte | Mandanten-SQL im Repo (Stand Planung) | Complete-SQL heute? | Complete mittelfristig |
|---------------------|--------------------------|----------------------------------------|---------------------|-------------------------|
| **full** | Gesamtschema einer Mandanten-Haupt-App (alles in einer DB) | `supabase-complete.sql` (Repo-Root) | **Ja** (= diese eine Datei) | Unverändert maßgeblich; Alias-Name nur Doku: `mandanten-db-full-complete.sql` wäre **inhaltlich** gleichbedeutend – Pfad **`supabase-complete.sql`** aus Kompatibilität beibehalten. |
| **core** | Profile/Rollen/RLS-Basis, Kunden/BV/Objekte, Suche/Stammdaten-Kern | Überwiegend in `supabase-complete.sql`; Deltas z. B. `mandanten-db-stammdaten-archived-at.sql`, `mandanten-db-repair-objects-customer-id.sql`, `mandanten-db-fix-auth-user-delete-fks.sql`, `mandanten-db-set-license-number-safe-update.sql` | **Nein** (in `full` eingebettet) | **Später optional** (`mandanten-db-core-complete.sql`) nur wenn operative Kleinst-Rollouts nötig; hoher Pflegeaufwand (Abhängigkeiten zu Portal/Zeit). |
| **maintenance** | Wartungsverträge, Reports, Fotos/Rauchmelder, Erinnerungen (datenseitig) | In `supabase-complete.sql`; verknüpft mit Kern/Portal | **Nein** | **Später optional** (`mandanten-db-maintenance-complete.sql`) bei klar getrenntem DDL-„Slice“ und Review; bis dahin **full** nutzen. |
| **portal** | Kundenportal-Tabellen, RLS, RPCs `get_portal_*` | In `supabase-complete.sql` | **Nein** | **Später optional** (`mandanten-db-portal-complete.sql`) – selten allein ausreichend ohne **core**. |
| **time** | Zeiterfassung, Abwesenheit, Soll, ggf. AZK-Stammdaten | In `supabase-complete.sql`; Deltas `mandanten-db-calc-soll-date-range.sql`, `mandanten-db-azk-stammdaten-migration.sql` | **Nein** | **Später optional** (`mandanten-db-time-complete.sql`) bei isolierbaren Änderungen; oft weiter **full** + CHANGELOG-Deltas. |
| **altbericht_import** | Altbericht Staging/Commit, eingebettete Bilder, Scan-Meta | Pakete A–G, `mandanten-db-objects-anforderung.sql`; **Sammel:** `mandanten-db-altbericht-import-complete.sql` | **Ja** | Unverändert; Einzelpakete für Historie/Debug/manuelle Teilschritte. |

## 12. Geplante zusätzliche Complete-SQLs (nur Planung – nicht angelegt)

| Dateiname (Empfehlung) | Bewertung | Begründung |
|------------------------|-----------|------------|
| `mandanten-db-altbericht-import-complete.sql` | **Sofort sinnvoll / vorhanden** | Bereits gebündelt, im Hub **`ready`**. |
| `supabase-complete.sql` („full“) | **Sofort sinnvoll / vorhanden** | Einziger Gesamtstand; Umbenennung im Repo aktuell **nicht** nötig (`sqlFile`-Pfad, Skripte, Gewohnheit). |
| `mandanten-db-core-complete.sql` | **Später**, wenn überhaupt | Nur wenn Team kleine Kern-Rollouts **ohne** Rest-Schema rechtfertigen und Abhängigkeiten dokumentiert sind. |
| `mandanten-db-maintenance-complete.sql` | **Später / selten** | Nur bei sauberem Schnitt aus `full`; sonst **full**. |
| `mandanten-db-portal-complete.sql` | **Später / selten** | Praktisch immer abhängig von **core**. |
| `mandanten-db-time-complete.sql` | **Später / optional** | Für reine Zeit-/Soll-Deltas ggf. sinnvoll; viele Installationen bleiben bei **full** + Einzel-Delta aus CHANGELOG. |

**Lizenzportal-DB** (`LP-*.sql`, `license-portal-*.sql`, `supabase-license-portal.sql`): **kein** `moduleKey` der Mandanten-Matrix; nicht über Mandanten-URL-Liste rollieren.

## 13. Namenskonvention (Kurzfassung)

| Artefakt | Regel |
|----------|--------|
| **Dateiname Mandanten-Delta** | `mandanten-db-<thema>-<kurz>.sql` unter `docs/sql/` |
| **Dateiname Mandanten-Complete (Feature)** | `mandanten-db-<feature>-complete.sql` |
| **Dateiname Lizenzportal** | `LP-<thema>.sql` oder `license-portal-<thema>.sql` |
| **Paket-ID (Hub)** | stabil, kebab-case, z. B. `supabase-complete`, `altbericht-import-complete` |
| **Label (Hub)** | Nutzersprache + optional technischer Pfad in Klammern |
| **moduleKey** | einer von: `full`, `core`, `maintenance`, `portal`, `time`, `altbericht_import` |
| **productKey** | z. B. `ariovan`; weitere Produkte = neuer Schlüssel + Display-Map |
| **CHANGELOG** | Jede neue/rollout-relevante Mandanten-Datei → Eintrag in `CHANGELOG-Mandanten-DB.md` |
