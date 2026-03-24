# Mandanten-DB: Workflow mit wenig Aufwand

Ziel: **Ordnung** bei mehreren Supabase-Projekten (ein Projekt pro Mandant), **ohne** sofort die komplette Supabase-CLI-Migrations-Umstellung (siehe weiterhin [`Supabase-Migrations-Strategie.md`](./Supabase-Migrations-Strategie.md)).

## 1. Inventar im Lizenzportal pflegen

Pro Mandant in der **Admin-App** (Lizenzportal) beim jeweiligen Mandanten:

| Feld | Zweck |
|------|--------|
| **`supabase_project_ref`** | Kurzreferenz des Supabase-Projekts (Dashboard-URL), eindeutige Zuordnung. |
| **`supabase_url`** | `https://<ref>.supabase.co` – schneller Zugriff ohne Suche im Dashboard. |

Damit ist klar, **welches** Projekt zu **welchem** Mandanten gehört (Skripte, Checklisten, Notfall).

## 2. Lokale Kopie (optional, ohne Secrets)

Vorlage: [`configs/mandanten-registry.example.json`](../../configs/mandanten-registry.example.json)

- Kopie nach **`configs/mandanten-registry.local.json`** (nicht committen – siehe Root-`.gitignore`).
- Nur **Metadaten** (Name, `project_ref`, Notizen) – **keine** DB-Passwörter.

## 3. Jede Schema-/Hotfix-Änderung dokumentieren

- **Neue** Änderungen als **eigene** SQL-Datei unter `docs/sql/` ablegen, z. B.  
  `mandanten-db-<thema>-<kurz>.sql`
- Eintrag im **[CHANGELOG-Mandanten-DB.md](./CHANGELOG-Mandanten-DB.md)** (Datum, Datei, Kurzbeschreibung, optional „angewendet auf: …“).

`supabase-complete.sql` bleibt der **Gesamt-Snapshot** für **neue** Mandanten-Projekte; laufende Kunden erhalten **Deltas** per einzelnen Dateien + Ausführung pro Projekt.

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
