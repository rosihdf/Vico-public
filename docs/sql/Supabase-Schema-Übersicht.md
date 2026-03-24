# Supabase-Schema: `supabase-complete.sql` & `supabase-license-portal.sql`

Langfristig: zeitlich geordnete **Supabase CLI-Migrations** statt nur Monolith – siehe **`Supabase-Migrations-Strategie.md`** (Baseline + Deltas, zwei Projekte).

## Zuordnung

| Datei (Repo-Root) | Supabase-Projekt | Zweck |
|---------------------|------------------|--------|
| `supabase-complete.sql` | **Mandanten-DB** (Haupt-App, Kundenportal-Zugriff) | Stammdaten, Wartung, Zeit, Urlaub, Lizenz-RPC, Storage, … |
| `supabase-license-portal.sql` | **Lizenzportal** (Admin: Mandanten, Lizenzen) | `tenants`, `licenses`, `license_models`, Speicher-Kontingent, `tenant_logos` |

Keine zusammenführen: getrennte Projekte, getrennte RLS/Secrets.

## Struktur (Kurz)

- **Idempotenz:** `CREATE … IF NOT EXISTS`, `CREATE OR REPLACE` für Funktionen, Policies oft nach `DROP POLICY`-Schleife pro Tabelle.
- **Migrationspfad:** Bestehende Installationen werden über `DO $$ … IF NOT EXISTS (information_schema…)` und ergänzende `ALTER TABLE … ADD COLUMN` nachgezogen – Reihenfolge im File ist relevant.

## Indizes & „doppelte“ Stellen

In `supabase-complete.sql` gibt es Indizes

1. **direkt nach einzelnen Tabellen** (z. B. `leave_requests`, `location_requests`), und  
2. **gesammelt in Abschn. 8** (Stammdaten, Urlaub-Komposit, Realtime).

Das ist **bewusst**: Lesbarkeit bei großen DDL-Blöcken + ein Querschnitt für Realtime (`supabase_realtime` + `orders`). `IF NOT EXISTS` verhindert Fehler bei wiederholtem Lauf.

**Optimierung im Betrieb:** Fehlende/abweichende Indizes nicht „auf Verdacht“ löschen; in Staging `EXPLAIN (ANALYZE, BUFFERS)` und ggf. `pg_stat_statements` nutzen.

## RPCs (SECURITY DEFINER)

Viele Funktionen laufen mit festem `search_path = public`. Änderungen an Tabellennamen oder öffentlichen APIs immer mit Regressionstests / manueller Prüfung der `GRANT`-Liste abgleichen.

## Lizenzportal-spezifisch

- `get_storage_summary()` aggregiert zugewiesenen Speicher über Lizenzen inkl. Fallback `license_models.max_storage_mb`.
- Storage-Bucket `tenant_logos`: öffentlich lesbar, Schreiben nur `is_admin()`.

## Wartung dieser Dateien

- Große inhaltliche Umbauten besser als **neue** Migrationsdatei + schrittweise Anwendung als in einem Rutsch nur `complete.sql` neu einspielen (Daten!).
- Nachbearbeitung: Datum im Datei-Header setzen; `Vico.md` §9/§10 bei fachlichen Änderungen mitziehen.

---

## Index-Review: `leave_requests` & `orders` (2026-03)

### Typische Zugriffe (Code / RPC)

| Objekt | Muster | Quelle |
|--------|--------|--------|
| `leave_requests` | `get_leave_requests`: `user_id` + optional `status` + Überlappung `to_date >= :from`, `from_date <= :to` | `leaveService.fetchMyLeaveRequests` → RPC |
| `leave_requests` | `EXISTS`: `user_id`, `status = 'approved'`, Kalendertag zwischen `from_date` und `to_date` | `calc_soll_minutes_for_month` / `calc_soll_minutes_for_date_range` |
| `orders` | `ORDER BY order_date DESC` | `fetchOrders`, `syncService.pullFromServer` |
| `orders` | `ORDER BY updated_at DESC LIMIT n` | `dataService` Dashboard „Zuletzt bearbeitet“ |
| `orders` | `assigned_to = :id OR created_by = :id` | `fetchRecentEditsForDashboard` (Scope „mine“) |

### Anpassungen in `supabase-complete.sql` (Abschn. 8 + DDL bei `leave_requests`)

1. **`idx_leave_requests_user_status_dates` `(user_id, status, from_date, to_date)`**  
   Ersetzt den früheren Index `idx_leave_requests_user_type_status_dates`: `leave_type` lag zwischen `user_id` und `status` und verhinderte effiziente reine `(user_id, status)`-Pfadnutzung im B-Tree.

2. **`drop index if exists`** für `idx_leave_requests_user_type_status_dates` und `idx_leave_requests_user_id` (redundant zum neuen zusammengesetzten Index für `user_id`-Präfix).

3. **`idx_orders_updated_at`** `(updated_at desc)` für Sortierung nach letzter Änderung ohne sequentiellen Scan.

4. Beibehalten: `idx_leave_requests_dates` `(from_date, to_date)`, `idx_leave_requests_status` `(status)` – für seltene Auswertungen ohne `user_id`; `idx_orders_*` für Zuweisung/Kunde/BV/Status/Datum.

### Manuelle Nacharbeit auf bestehenden DBs

Skript einmal im SQL-Editor ausführen **oder** nur den erweiterten Abschn. 8 aus `supabase-complete.sql` anwenden. Nach Deployment optional: `ANALYZE public.leave_requests; ANALYZE public.orders;`
