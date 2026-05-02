# Mandanten-DB: Workflow mit wenig Aufwand

Ziel: **Ordnung** bei mehreren Supabase-Projekten (ein Projekt pro Mandant), **ohne** sofort die komplette Supabase-CLI-Migrations-Umstellung (siehe weiterhin [`Supabase-Migrations-Strategie.md`](./Supabase-Migrations-Strategie.md)).

## 1. Inventar im Lizenzportal pflegen

Pro Mandant in der **Admin-App** (Lizenzportal) beim jeweiligen Mandanten:

| Feld | Zweck |
|------|--------|
| **`supabase_project_ref`** | Kurzreferenz des Supabase-Projekts (Dashboard-URL), eindeutige Zuordnung. |
| **`supabase_url`** | `https://<ref>.supabase.co` – schneller Zugriff ohne Suche im Dashboard. |

Damit ist klar, **welches** Projekt zu **welchem** Mandanten gehört (Skripte, Checklisten, Notfall).

## 1b. SQL-Ordner, Complete-Dateien und Pakete

Übersicht aller relevanten Pfade, Altbericht-Pakete A–G, Mandanten- vs. Lizenzportal-SQL und geplante **Zielordner** (`complete/`, `packages/`, `archive/`) ohne bestehende Pfade zu brechen:  
[**SQL-Struktur-und-Paketkonvention.md**](./SQL-Struktur-und-Paketkonvention.md). **Modul-Matrix** (logische Zuordnung `core` / `maintenance` / `portal` / `time` / `full` / `altbericht_import`), **geplante Complete-SQLs** und **Namenskonvention:** dort **§11–§13**.

Das Lizenzadmin listet nur **kuratierte** Rollout-Pakete (Datei `admin/src/lib/mandantenDbUpdatePackages.ts`, Status `ready`). Einzelpakete A–G und Hotfixes bleiben unter `docs/sql/` für manuelle Ausführung.

## 2. Lokale Kopie (optional, ohne Secrets)

Vorlage: [`configs/mandanten-registry.example.json`](../../configs/mandanten-registry.example.json)

- Kopie nach **`configs/mandanten-registry.local.json`** (nicht committen – siehe Root-`.gitignore`).
- Nur **Metadaten** (Name, `project_ref`, Notizen) – **keine** DB-Passwörter.

## 3. Jede Schema-/Hotfix-Änderung dokumentieren

- **Neue** Änderungen als **eigene** SQL-Datei unter `docs/sql/` ablegen, z. B.  
  `mandanten-db-<thema>-<kurz>.sql`
- Eintrag im **[CHANGELOG-Mandanten-DB.md](./CHANGELOG-Mandanten-DB.md)** (Datum, Datei, Kurzbeschreibung, optional „angewendet auf: …“).

`supabase-complete.sql` ist der **einzige** Gesamt-Stand, den du pflegst: **neue** Mandanten bekommen ihn im SQL Editor; **bestehende** Mandanten bringst du mit **§3b** (`npm run db:apply-mandanten-complete`) auf denselben Stand. **Deltas** unter `docs/sql/` sind optional (z. B. Hotfix nur für ein Projekt oder CHANGELOG-Eintrag).

### 3b. Gleiche Datei auf alle bestehenden Mandanten (praktikabel)

Die Datei ist als **idempotent** gedacht (`IF NOT EXISTS`, `add column if not exists`, Policies/Funktionen neu anlegen). Wenn du **`supabase-complete.sql`** erweitert hast und **alle** Mandanten-DBs auf denselben Stand bringen willst:

1. **`configs/mandanten-db-urls.local.txt`** mit allen Connection-URIs (eine Zeile pro Mandant, wie in §4).
2. Trockenlauf: `npm run db:apply-mandanten-complete:dry`
3. Echtlauf: `npm run db:apply-mandanten-complete`

Entspricht: `node scripts/apply-mandanten-sql.mjs supabase-complete.sql --urls-file configs/mandanten-db-urls.local.txt`.

**Empfehlung:** Zuerst **ein** Staging-Mandant oder eine Kopie testen. **`supabase-license-portal.sql`** ist **eine andere** Datenbank – separat ausführen, nicht über die Mandanten-URL-Liste mischen.

### 3c. Optional: Button im Lizenzportal (GitHub Actions)

Statt nur lokal `npm run …` kann ein **Admin** unter **„Mandanten aktualisieren“** einen GitHub-Workflow starten: **Ziel** Staging oder Produktion, **SQL-Datei** (über Dropdown → Pfad wie `supabase-complete.sql` oder `docs/sql/mandanten-db-altbericht-import-complete.sql`; optional später zusätzliche Dateien unter `docs/sql/rollout/`), **Trockenlauf** oder **Echtlauf**. Ablauf:

1. **GitHub-Secrets** (Repository):
   - **`MANDANTEN_DB_URLS_STAGING`** – URI-Liste für Referenz-/Test-Mandant(en), eine Zeile pro DB.
   - **`MANDANTEN_DB_URLS_PRODUCTION`** – alle Produktions-Mandanten-DBs (eine URI pro Zeile).
   - **Legacy:** Ist `MANDANTEN_DB_URLS_PRODUCTION` leer, nutzt der Workflow für **production** weiterhin **`MANDANTEN_DB_URLS`**.
2. Workflow **`.github/workflows/mandanten-db-apply-complete.yml`** (Name in Actions: **Mandanten-DB – Rollout (psql)**). Inputs: **`target`**, **`sql_file`**, **`mode`** (dry_run/apply), optional **`run_id`** (wird aus dem Lizenzportal gesetzt).
3. **Supabase Lizenzportal** → Edge Functions **`trigger-mandanten-db-rollout`** und **`update-mandanten-db-rollout-status`** deployen (`supabase-license-portal/`), Secrets u.a.:
   - **`GITHUB_DISPATCH_TOKEN`** – PAT mit **Actions: Write** auf dem Repo.
   - **`GITHUB_REPO_OWNER`**, **`GITHUB_REPO_NAME`**
   - **`MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET`** – zufälliger String; identischer Wert als Repository-Secret (siehe unten).
   - Optional: **`GITHUB_WORKFLOW_FILE`** (Default `mandanten-db-apply-complete.yml`), **`GITHUB_DEFAULT_BRANCH`** (Default `main`).
4. **GitHub Repository Secrets** (zusätzlich zu den DB-URL-Secrets):
   - **`LP_ROLLOUT_CALLBACK_URL`** – z.B. `https://<lp-ref>.supabase.co/functions/v1/update-mandanten-db-rollout-status`
   - **`LP_ROLLOUT_CALLBACK_SECRET`** – gleicher Wert wie in Supabase (**`MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET`**). Fallback: älteres Secret **`MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET`** im Repo, falls **`LP_ROLLOUT_CALLBACK_SECRET`** nicht gesetzt ist.

Pflicht ab Phase 3: Start aus dem Lizenzportal übergibt **`run_id`** an den Workflow; ohne die beiden Callback-Secrets schlägt der Job nach Checkout fehl (Absicherung). Manuelle Workflow-Starts ohne `run_id` protokollieren nicht ins Lizenzportal und nutzen beim Echtlauf weiterhin den klassischen „Abbruch beim ersten Fehler“ im Script.

Die Function **`trigger-mandanten-db-rollout`** prüft die **Admin-Session**, validiert **`sql_file`** (nur `supabase-complete.sql` oder `docs/sql/…/*.sql`, kein `..`) und ruft **`workflow_dispatch`** auf. **`update-mandanten-db-rollout-status`** ist nur mit **`X-Rollout-Callback-Secret`** erreichbar und aktualisiert Runs/Targets aus GitHub Actions.

**Logs** in **GitHub → Actions**. Der Ordner **`docs/sql/rollout/`** ist derzeit **reserviert** (ohne Pflicht-Skripte); neue gebündelte Dateien dort erst nach Freigabe und Aufnahme in **`mandantenDbUpdatePackages`** (oder manueller Pfad-Eingabe nur über bestehende erlaubte Mechanismen).

Siehe auch **`docs/sql/README.md`** und **`SQL-Struktur-und-Paketkonvention.md`**.

## 4. SQL auf allen Mandanten-DBs ausführen

**Variante A – Dashboard:** SQL-Datei im **SQL Editor** jedes Supabase-Projekts ausführen (funktioniert immer, bei wenigen Mandanten ok).

**Variante B – Skript (lokal):** [`scripts/apply-mandanten-sql.mjs`](../../scripts/apply-mandanten-sql.mjs) mit **`psql`** und einer **lokalen** URL-Liste (nicht im Repo):

1. Connection-Strings aus dem Supabase-Dashboard (**Settings → Database → Connection string → URI**, Session Pooler sinnvoll) – Passwort einsetzen.
2. Eine Zeile pro Mandant in **`configs/mandanten-db-urls.local.txt`** (Vorlage: `configs/mandanten-db-urls.example.txt`).
3. Trockenlauf:  
   `node scripts/apply-mandanten-sql.mjs docs/sql/…/datei.sql --urls-file configs/mandanten-db-urls.local.txt --dry-run`
4. Echtlauf ohne `--dry-run`.

Voraussetzung: **PostgreSQL-Client** (`psql`) installiert (`brew install libpq` auf macOS o. Ä.).

## 5. Später skalierbar

Wenn die Liste der Mandanten wächst: dieselben SQL-Dateien + **CI** (GitHub Actions) mit Secrets pro Staging/Prod-Projekt oder **Supabase CLI** `db push` – siehe [`Supabase-Migrations-Strategie.md`](./Supabase-Migrations-Strategie.md).

---

*Ergänzung zu `Vico.md` §9 (Mandanten-Isolation), Onboarding Phasen in §7.6.3.*
