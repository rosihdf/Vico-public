-- Mandanten-Delta: Altbericht-Import Paket B (Review-State, Resolved-Felder, Validierung)
-- Siehe CHANGELOG-Mandanten-DB.md
--
-- Erweitert altbericht_import_staging_object um Review-Spalten (ohne Produktiv-Commit).
-- Spalte status = Parser-/Staging-Semantik (Paket A); review_status = Review-Workflow.

alter table public.altbericht_import_staging_object
  add column if not exists review_status text not null default 'draft';

alter table public.altbericht_import_staging_object
  drop constraint if exists altbericht_import_staging_object_review_status_check;

-- Defensiv vor Re-Apply: alte Mandanten-DBs hatten die Spalte ggf. ohne `not null default 'draft'`
-- angelegt. NULL-Werte werden vor dem neuen Check auf 'draft' normalisiert, sonst scheitert das
-- ALTER ... ADD CONSTRAINT mit 23514 ("check constraint violated by some row").
update public.altbericht_import_staging_object
set review_status = 'draft'
where review_status is null;

-- Liste muss synchron zu mandanten-db-altbericht-import-paket-c1-commit.sql gehalten werden.
-- 'committed' wird dort nachgezogen und ist produktiv: setzt der C1-Commit-Service.
alter table public.altbericht_import_staging_object
  add constraint altbericht_import_staging_object_review_status_check check (
    review_status in ('draft', 'needs_input', 'ready', 'blocked', 'skipped', 'committed')
  );

-- Auflösung / manuelle Review-Felder (kein Write nach customers/bvs/objects in Paket B)
alter table public.altbericht_import_staging_object
  add column if not exists review_customer_id uuid references public.customers(id) on delete set null;
alter table public.altbericht_import_staging_object
  add column if not exists review_bv_id uuid references public.bvs(id) on delete set null;
alter table public.altbericht_import_staging_object
  add column if not exists review_object_name text;
alter table public.altbericht_import_staging_object
  add column if not exists review_object_type_text text;
alter table public.altbericht_import_staging_object
  add column if not exists review_floor_text text;
alter table public.altbericht_import_staging_object
  add column if not exists review_room_text text;
alter table public.altbericht_import_staging_object
  add column if not exists review_location_rule text;
alter table public.altbericht_import_staging_object
  drop constraint if exists altbericht_import_staging_object_review_location_rule_check;
alter table public.altbericht_import_staging_object
  add constraint altbericht_import_staging_object_review_location_rule_check check (
    review_location_rule is null
    or review_location_rule in ('floor', 'room', 'unknown')
  );

alter table public.altbericht_import_staging_object
  add column if not exists validation_errors_json jsonb not null default '[]'::jsonb;
alter table public.altbericht_import_staging_object
  add column if not exists review_blocked_reason text;
alter table public.altbericht_import_staging_object
  add column if not exists reviewed_at timestamptz;
alter table public.altbericht_import_staging_object
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.altbericht_import_staging_object
  add column if not exists match_candidates_json jsonb;

create index if not exists idx_altbericht_import_staging_job_review
  on public.altbericht_import_staging_object (job_id, review_status);

-- Bestehende Zeilen: Review-Status an Parser-Status anlehnen (einmalig)
update public.altbericht_import_staging_object
set review_status = 'blocked'
where review_status = 'draft'
  and status = 'blocked';

update public.altbericht_import_staging_object
set review_status = 'needs_input'
where review_status = 'draft'
  and status in ('incomplete', 'ready_for_review', 'draft');
