# Changelog: Mandanten-DB (Delta-SQLs)

Änderungen an **bestehenden** Mandanten-Supabase-Projekten: hier eintragen, sobald eine neue Datei unter `docs/sql/` hinzukommt oder eine bestehende für Rollouts relevant ist.

| Datum | SQL-Datei | Kurzbeschreibung | Bemerkung |
|-------|-----------|------------------|-----------|
| 2026-03-24 | mandanten-db-stammdaten-archived-at.sql | `archived_at` auf customers/bvs/objects; RPCs Wartungserinnerung, Suche, Portal-Zustellung | Nach App-Deploy ausführen |

**Konvention:** Pro fachlicher Änderung idealerweise **eine** neue `mandanten-db-*.sql` (oder klar benannte Datei), Review im PR, dann Rollout pro Projekt.

Siehe [**Mandanten-DB-Workflow.md**](./Mandanten-DB-Workflow.md).
