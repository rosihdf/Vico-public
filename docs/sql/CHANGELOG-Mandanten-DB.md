# Changelog: Mandanten-DB (Delta-SQLs)

Änderungen an **bestehenden** Mandanten-Supabase-Projekten: hier eintragen, sobald eine neue Datei unter `docs/sql/` hinzukommt oder eine bestehende für Rollouts relevant ist.

| Datum | SQL-Datei | Kurzbeschreibung | Bemerkung |
|-------|-----------|------------------|-----------|
| 2026-04-24 | mandanten-db-altbericht-import-paket-d-proposed-id-match-key.sql | Altbericht Paket D: `proposed_internal_id`, `import_match_key` am Staging (Vorschau-OBJ-ID + Dubletten-Fingerprint) | Nach App-Deploy mit Parser/Persist ausführen |
| 2026-04-19 | mandanten-db-altbericht-import-paket-c2-defects.sql | Altbericht Paket C2: `c2_defects_*` am Staging, RPC `altbericht_import_c2_commit_defects` (append Mängel, idempotent) | Nach App-Deploy mit C2 ausführen |
| 2026-04-19 | mandanten-db-altbericht-import-paket-c1-commit.sql | Altbericht Paket C1: `review_object_id`, `committed_at`, `committed_object_id`, `commit_last_error`, `review_status` inkl. `committed` | Nach App-Deploy mit C1-Commit-Service ausführen |
| 2026-04-19 | mandanten-db-altbericht-import-paket-b-review.sql | Altbericht Paket B: Review-Spalten an `altbericht_import_staging_object` (`review_status`, resolved/review-Felder, `validation_errors_json`) | Kein Produktiv-Commit; nach Deploy ausführen |
| 2026-04-18 | mandanten-db-altbericht-import-paket-a.sql | Altbericht-Import Paket A: `altbericht_import_*` Tabellen, RLS, Bucket `altbericht-import-pdfs` | Kein Produktiv-Commit; optional `get_storage_usage` um Bucket erweitern |
| 2026-04-17 | mandanten-db-repair-objects-customer-id.sql | `objects.customer_id` nachziehen aus `bvs` bzw. konsistenten `orders` | Optional bei Legacy-Zeilen mit NULL; idempotent |
| 2026-03-24 | mandanten-db-stammdaten-archived-at.sql | `archived_at` auf customers/bvs/objects; RPCs Wartungserinnerung, Suche, Portal-Zustellung | Nach App-Deploy ausführen |
| 2026-03-24 | mandanten-db-set-license-number-safe-update.sql | `set_license_number`: UPDATE mit `WHERE id = …` (Fix „UPDATE requires a WHERE clause“ / Supabase safe_update) | Sofort auf betroffene Mandanten |

**Konvention:** Pro fachlicher Änderung idealerweise **eine** neue `mandanten-db-*.sql` (oder klar benannte Datei), Review im PR, dann Rollout pro Projekt.

Siehe [**Mandanten-DB-Workflow.md**](./Mandanten-DB-Workflow.md).
