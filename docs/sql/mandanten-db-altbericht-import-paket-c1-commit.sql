-- Mandanten-Delta: Altbericht-Import Paket C1 (Produktiv-Commit Kunde/BV/Objekt, ohne Mängel)
-- Siehe CHANGELOG-Mandanten-DB.md
--
-- Erweitert Staging um Ziel-Objekt-Auswahl (Review) und Commit-Protokoll-Spalten.

-- Review: explizite Zuordnung zu bestehendem Produktiv-Objekt (optional)
alter table public.altbericht_import_staging_object
  add column if not exists review_object_id uuid references public.objects(id) on delete set null;

-- Nach erfolgreichem C1-Commit
alter table public.altbericht_import_staging_object
  add column if not exists committed_at timestamptz;
alter table public.altbericht_import_staging_object
  add column if not exists committed_object_id uuid references public.objects(id) on delete set null;
alter table public.altbericht_import_staging_object
  add column if not exists commit_last_error text;

alter table public.altbericht_import_staging_object
  drop constraint if exists altbericht_import_staging_object_review_status_check;
alter table public.altbericht_import_staging_object
  add constraint altbericht_import_staging_object_review_status_check check (
    review_status in ('draft', 'needs_input', 'ready', 'blocked', 'skipped', 'committed')
  );

create index if not exists idx_altbericht_import_staging_committed
  on public.altbericht_import_staging_object (job_id, committed_at);
