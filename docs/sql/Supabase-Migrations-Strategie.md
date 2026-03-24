# Strategie: Von `supabase-complete.sql` zu Supabase CLI-Migrations

**Planung:** Roadmap-ID **T1** in **`Vico.md` §7.2** / §7.4 #18 / §7.6.1.

## Ziel

- **Reviews:** Kleine, zeitlich geordnete Dateien statt 2.900+ Zeilen pro Änderung.
- **Reproduzierbarkeit:** Gleicher Schema-Stand lokal, in CI und auf Remote (Staging/Prod).
- **Rollback:** Wo sinnvoll, bewusst getrennte „forward“-Migrations (Rollback-Strategie separat festlegen).

## Empfohlene Zielstruktur (Haupt-App / Mandanten-DB)

```
supabase/
  config.toml          # supabase init / Link zum Projekt
  migrations/
    20260316120000_baseline.sql    # optional: einmaliger Stand aus Monolith
    20260320140000_leave_requests_indexes.sql
    …
  functions/           # (bereits vorhanden)
```

**Namenskonvention:** `YYYYMMDDHHMMSS_kurze_beschreibung.sql` – Reihenfolge = Dateiname.

Zweites Projekt **Lizenzportal:** eigenes Verzeichnis (z. B. `supabase-license-portal/supabase/migrations/`) – nicht mit der Mandanten-DB mischen.

## Drei Wege (Wahl nach Teamgröße)

### A) Baseline + nur noch Deltas (pragmatisch, schnell)

1. **`supabase init`** im Repo-Root (oder nur `supabase/migrations` anlegen + `config.toml` aus Template).
2. **Eine** Migration `…_baseline.sql` erzeugen:
   - Inhalt = aktueller Stand: entweder aus `supabase-complete.sql` **oder** per `supabase db dump --schema public` gegen eine leere Referenz-DB, die ihr aus dem Monolith aufgebaut habt.
3. Diese Migration auf **allen** Umgebungen als „bereits angewendet“ markieren, **ohne** erneut alles auszuführen, wenn Prod schon live ist:
   - `supabase migration repair --status applied <timestamp>` (CLI) **oder** Eintrag in `supabase_migrations.schema_migrations` manuell (nur mit Absicherung).
4. **Ab jetzt:** Jede Schemaänderung = **neue** kleine Datei nur mit `ALTER`/`CREATE OR REPLACE`/neuen Indizes.

**Vorteil:** Schnell reviewbar. **Nachteil:** Die Baseline bleibt eine große Datei (einmalig).

### B) Monolith schrittweise zerschneiden (aufwändig)

Historische Migrations nachträglich bauen (nur sinnvoll bei Neuaufsetzen oder strenger Audit-Pflicht). Für bestehende Vico-Installation meist **nicht** nötig.

### C) „Shadow DB“ + Diff (fortgeschritten)

Lokale Referenz-DB mit Baseline füllen → Schema nur noch per CLI-Migration ändern → bei Bedarf Diff gegen Remote. Nutzt ihr stark, wenn mehrere Entwickler parallel am Schema arbeiten.

## Konkrete Arbeitsregeln (für Reviews)

| Regel | Begründung |
|--------|------------|
| **Eine fachliche Änderung ≈ eine Migration** (oder klar getrennte Commits) | Klare Blame-/Review-Zuordnung |
| **Keine** nachträgliche Bearbeitung alter Migrationen, die schon auf Prod liefen | Sonst Drift; stattdessen **neue** Migration mit `ALTER` |
| **Idempotenz:** In Deltas `IF NOT EXISTS` / `DROP … IF EXISTS` nur wo sinnvoll; in strikten Umgebungen lieber exakte `ALTER` ohne Doppel-Logik | Weniger Überraschungen in CI |
| **`supabase-complete.sql`** | Als **Snapshot-Export** oder **Notfall-Dokumentation** behalten, regelmäßig aus DB oder aus angewandten Migrations **regenerieren** (oder als „full reset dev only“ kennzeichnen) |

## Tooling

- **Lokal:** [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase link`, `supabase db diff`, `supabase migration new …`).
- **CI:** Optional Job, der `supabase db lint` oder `sqlfluff` auf `migrations/` ausführt.
- **Zwei Projekte:** Zwei Links / zwei `project_id` – in Doku klar trennen (Mandanten-DB vs. Lizenzportal).

## Kurzfassung Empfehlung für Vico

1. **`supabase init`** für die Haupt-App (falls noch nicht geschehen).
2. **Baseline-Migration** aus dem aktuellen `supabase-complete.sql` (einmalig groß).
3. **Prod/Staging:** Baseline als applied markieren, **ohne** erneutes Ausführen des kompletten Skripts auf voller Datenbank (sonst Timeouts / Locks).
4. **Neue Features** (Indizes, Spalten, RPCs) nur noch als **kleine, datierte Migrations**.
5. **`supabase-complete.sql`** im Repo behalten als **Referenz** mit Hinweis in der Kopfzeile: *„Generiert / Spiegel letzter Migrationen – primäre Quelle der Wahrheit: supabase/migrations/“* oder bei Bedarf nur noch in `docs/` ablegen.

Damit sind Reviews langfristig kleinteilig, ohne dass ihr die Historie ab Tag 1 rekonstruieren müsst.

## Pragmatischer Einstieg (ohne sofort CLI-Baseline)

Bis die CLI-Migrationen überall liegen: **Inventar, Changelog, optionales Multi-`psql`-Skript** – siehe [**Mandanten-DB-Workflow.md**](./Mandanten-DB-Workflow.md).
