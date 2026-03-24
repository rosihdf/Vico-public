# SQL & Mandanten-Datenbank

| Dokument | Inhalt |
|----------|--------|
| [**Mandanten-DB-Workflow.md**](./Mandanten-DB-Workflow.md) | **Start hier:** Inventar, Changelog, Skript für mehrere Projekte |
| [**CHANGELOG-Mandanten-DB.md**](./CHANGELOG-Mandanten-DB.md) | Chronologische Liste der **Delta-SQLs** für bestehende Mandanten-DBs |
| [**Supabase-Migrations-Strategie.md**](./Supabase-Migrations-Strategie.md) | Langfristig: `supabase/migrations/`, Baseline, CLI |
| [**Supabase-Schema-Übersicht.md**](./Supabase-Schema-Übersicht.md) | Schema-Referenz (Stand der Doku) |

Einzel-Skripte (Hotfixes / Features):

- `mandanten-db-azk-stammdaten-migration.sql`
- `mandanten-db-calc-soll-date-range.sql`
- `mandanten-db-fix-auth-user-delete-fks.sql`

**Gesamt-Initialisierung** neuer Mandanten-Projekte: Repo-Root **`supabase-complete.sql`**.
