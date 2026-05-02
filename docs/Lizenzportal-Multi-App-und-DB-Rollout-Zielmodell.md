# Lizenzportal – Multi-App- und DB-Rollout-Zielmodell

Stand: **Zielbild und Leitlinien** – ohne Migration, ohne Workflow-Umbau, ohne neue Tabellen.

Verwandt: [**Lizenzportal-Multi-App-Leitlinie.md**](./Lizenzportal-Multi-App-Leitlinie.md) (erste Ausbaustufe), [**docs/sql/SQL-Struktur-und-Paketkonvention.md**](./sql/SQL-Struktur-und-Paketkonvention.md).

---

## 1. Zielbild Multi-App

| Ebene | Rolle |
|-------|--------|
| **Lizenzportal** | Neutraler **Betreiber-Hub**: Mandanten, Lizenzen, Releases, Mail, globale Vorlagen, später Rollout-Historie. Kein festes Branding eines einzelnen Produkts im Portal-Chrome. |
| **Produkt** | Aktuell erstes Produkt: **ArioVan**. Später weitere Produkte möglich (`product_key` als technischer Schlüssel). |
| **Module (ArioVan)** | Drei sichtbare Deploy-/App-Editionen im Repo: **Hauptapp** (`main`), **Kundenportal**, **Arbeitszeit**. Sie teilen sich **eine** Mandanten-Datenbank; logisch gehören Tabellen/Rollouts zu Modul-Schichten (siehe §4). |
| **Erweiterbarkeit** | Zusätzliche Produkte und produktbezogene Module **ohne** kurzfristigen DB-Split dokumentiert und über Metadaten vorbereitbar – Umsetzung folgt gesondert. |

---

## 2. Lizenzmodell

### 2.1 Aktuell (Festlegung)

- **Ein Mandant** ↔ **eine gemeinsame Mandanten-Supabase-Datenbank**.
- **Eine ArioVan-Lizenz** pro Mandant (im Sinne der aktuellen Datenhaltung).
- **Mehrere Module** (Hauptapp, Kundenportal, Arbeitszeit) werden **innerhalb dieser Lizenz** über Features/Konfiguration aktiviert oder deaktiviert – nicht als separate Produktlizenzen je Modul.

### 2.2 Später möglich (ohne jetzt umzusetzen)

- Mehrere **Produkte** pro Mandant (eigene Lizenzen oder Stufen).
- **Produktbezogene Module** und Feature-Matrizen.
- Optional: Arbeitszeit oder Kundenportal als **eigenständige Produktlinien** – nur nach Produktentscheidung und Migrationsplan.

---

## 3. Datenbankmodell

### 3.1 Aktuell

- **Eine Mandanten-Supabase** pro Mandant.
- **Alle Module** (Hauptapp, Portal, Arbeitszeit) nutzen dieselbe DB und dasselbe Schema-Korpus (`supabase-complete.sql` als Gesamtstand).
- Tabellen und SQL-Deltas sollen **logisch nach Modulen** gruppiert bleiben (Doku, Kommentare, später `module_key` an Rollout-Paketen).

### 3.2 Später möglich

- Klarere **Produkt-/Modulgrenzen** in Metadaten und ggf. Schema-Dokumentation.
- **Kein** kurzfristiger physischer Split der Mandanten-Datenbank ohne eigenes Architektur-Release.

---

## 4. DB-Rollout-Zielmodell

Rollouts laufen weiterhin über dasselbe GitHub/psql-Verfahren (`docs/sql/Mandanten-DB-Workflow.md`). **Ziel** ist, jedes kuratierte Paket **statisch** mit folgenden Schlüsseln zu versehen (UI + später Persistenz):

| Feld | Bedeutung | Beispiele (ArioVan) |
|------|-----------|---------------------|
| **`product_key`** | Produktlinie | `ariovan` |
| **`module_key`** | Logische Schicht / Rollout-Kategorie | siehe Tabelle unten |

### 4.1 Modul-Schlüssel (`module_key`)

| `module_key` | Bedeutung (Zielbild) |
|--------------|----------------------|
| **`full`** | Gesamtschema oder Complete, das **alle** logischen Bereiche der Mandanten-DB abdeckt (z. B. `supabase-complete.sql`). |
| **`core`** | Kern/Stammdaten und schemaübergreifende Grundlagen (künftige feingranulare Pakete). |
| **`maintenance`** | Wartung, Protokolle, Altlasten-Hooks (Sammelbegriff für „Monteur-/Wartungsdomäne“). |
| **`portal`** | Datenobjekte/RPCs, die primär das **Kundenportal** betreffen. |
| **`time`** | Zeiterfassung, Abwesenheit, verwandte Objekte. |
| **`altbericht_import`** | Konkretes Feature-Paket Altbericht-Import (kann bei Bedarf unter `maintenance` subsumiert werden – Schlüssel ist für Tracking explizit). |

**Hinweis:** Ein Paket hat genau **ein** `module_key` aus Sicht des Rollout-Katalogs; mehrere SQL-Dateien pro Modul sind weiterhin über Complete-Bundles abbildbar.

### 4.2 Aktuelle Zuordnung (Code, statisch)

| Paket-ID | `product_key` | `module_key` | SQL-Datei (unverändert) |
|----------|-----------------|--------------|---------------------------|
| `supabase-complete` | `ariovan` | `full` | `supabase-complete.sql` |
| `altbericht-import-complete` | `ariovan` | `altbericht_import` | `docs/sql/mandanten-db-altbericht-import-complete.sql` |

---

## 5. Rollout-Historie (später – nicht umsetzen)

Geplante **Persistenz** im Lizenzportal, um pro Mandant nachvollziehen zu können, **welches** Paket **wann** auf **welcher** Umgebung lief.

### 5.1 Mögliche Tabellen (Skizze)

- **`mandanten_db_rollout_runs`** – ein Lauf (z. B. ein Workflow-Dispatch).
- **`mandanten_db_rollout_targets`** – je Mandant/Ziel-URI Ergebniszeile (optional normalisiert).

### 5.2 Mögliche Felder (Illustration)

| Feld | Zweck |
|------|--------|
| `id` | Primärschlüssel |
| `tenant_id` | Mandant im Lizenzportal |
| `product_key` | z. B. `ariovan` |
| `module_key` | z. B. `full`, `altbericht_import` |
| `sql_file` | Repo-Pfad wie heute |
| `target` | `staging` / `production` |
| `mode` | `dry_run` / `apply` |
| `status` | `pending`, `ok`, `failed`, … |
| `started_at`, `finished_at` | Zeitstempel |
| `triggered_by` | Profil/User-ID |
| `github_run_url` | Link zur Action |
| `error_excerpt` | Kurzfehler bei Fail |

**Jetzt:** keine Tabellen, keine API – nur Zielbild.

---

## 6. UI-Zielbild („Mandanten aktualisieren“)

Langfristig soll der Bereich **ungefähr** folgende Schritte unterstützen (Reihenfolge skizziert):

1. **Produkt** wählen (`product_key`).
2. **Modul / Paket** wählen (`module_key` + konkrete `sql_file`).
3. **Zielumgebung** (Staging / Produktion).
4. **Mandanten** auswählen (Teilmenge statt nur Secret-Liste – später).
5. **Dry-Run** / **Echtlauf**.
6. **Status je Mandant** (läuft, ok, Fehler).
7. **Historie** (Verknüpfung mit §5).

**Aktuell:** Produkt- und Modul-Metadaten werden nur **angezeigt** und im Code gepflegt; Trigger-Verhalten und Secrets bleiben unverändert.

---

## 7. Regeln für neue Features

1. **Neue DB-Rollout-Pakete** immer mit **`product_key`** und **`module_key`** planen und in `mandantenDbUpdatePackages.ts` eintragen; SQL-Pfad und Whitelist beachten.
2. **Keine** neuen **generischen** Lizenzportal-Funktionen dauerhaft an **nur ArioVan** koppeln – Neutralität im Hub, Ausnahmen nur bei explizitem Produktbezug (PDF, Mandanten-`app_name`, …).
3. **Produkttexte** und Ende-Nutzer-Doku dürfen **ArioVan** nennen.
4. **Lizenzportal-UI-Texte** (Chrome, Listen, Hilfen) bleiben **neutral**, soweit keine konkrete Produktdatei gemeint ist.
5. **Technische Altlasten** (z. B. Kanalnamen `main`, CSS-Präfixe, Bucket-Namen) nur mit **Migrationsplan** und Release anfassen.
6. **Eine Mandanten-DB** bleibt die Default-Annahme, bis ein gesonderter Architektur-Beschluss den Split erlaubt.

---

## 8. Code-Referenz (statische Metadaten)

Paketdefinition: `admin/src/lib/mandantenDbUpdatePackages.ts` (`productKey`, `moduleKey`, Anzeigenamen-Helfer).
