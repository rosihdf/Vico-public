-- =============================================================================
-- Mandanten-DB · Altbericht-Import · Complete-SQL
-- =============================================================================
--
-- Konsolidierter Rollout für ALLE Altbericht-Import-Pakete (A bis G) plus
-- das objects.anforderung-Delta. Bevorzugter Pfad für Sammel-Rollouts über
-- den Lizenzadmin -> "Mandanten aktualisieren".
--
-- Idempotent: mehrfaches Ausführen ist safe.
--   - create table if not exists
--   - add column if not exists
--   - drop constraint / drop policy / drop trigger - jeweils mit "if exists",
--     anschließend create
--   - kein DELETE auf Bestandsdaten
--   - committed-Zeilen (review_status = 'committed') werden nicht verändert
--
-- Enthaltene Pakete (Reihenfolge zwingend - Spalten/Constraints aus späteren
-- Paketen referenzieren Tabellen/Spalten der vorherigen):
--
--   1. Paket A   - Core: Job/File/Staging-Object/Event-Tabellen, RLS, Bucket
--                  altbericht-import-pdfs.
--   2. Paket B   - Review-Status, Resolved-Felder, Validierung,
--                  Constraint-Liste mit 'committed' (synchron zu C1).
--   3. Paket C1  - Produktiv-Commit Kunde/BV/Objekt (ohne Mängel),
--                  review_object_id / committed_at / committed_object_id.
--   4. Paket C2  - Optionale Mängelübernahme nach C1 (RPC
--                  altbericht_import_c2_commit_defects + Spalten).
--   5. Paket D   - proposed_internal_id + import_match_key am Staging
--                  (Vorschau-OBJ-ID + Dubletten-Fingerprint).
--   6. Paket E   - altbericht_import_embedded_image (Metadaten,
--                  manuelle Intent-Zuordnung, RLS).
--   7. Paket F   - Produktive Foto-Übernahme: import_status, Verknüpfungen
--                  zu object_photos / object_defect_photos.
--   8. Paket G   - Optionale Scan-Metadaten (scan_meta_json fuer
--                  Logo-/Header-Heuristik).
--   9. objects.anforderung - Brandschutz-/Normangabe (z. B. T30) am
--                  Stammdatenobjekt.
--
-- Einzelpakete bleiben unter docs/sql/mandanten-db-altbericht-import-paket-*.sql
-- weiterhin verfügbar (Historie, Debug, gezielte Reparatur einzelner Mandanten).
--
-- Voraussetzungen (in supabase-complete.sql vorhanden):
--   - public.profiles
--   - public.customers, public.bvs, public.objects
--   - public.object_photos, public.object_defect_photos
--   - public.is_portal_customer(), public.can_write_master_data()
--   - storage.buckets / storage.objects mit RLS
--
-- Audit: Lauf wird ueber den GitHub-Actions-Run protokolliert; siehe
-- docs/sql/Mandanten-DB-Workflow.md §3c.
-- =============================================================================


-- =============================================================================
-- 1. Paket A - Core
-- =============================================================================
-- Mandanten-Delta: Altbericht-Import Paket A (Job, Datei, Staging-Objekt, Event, Storage-Bucket)
-- Siehe CHANGELOG-Mandanten-DB.md
--
-- Hinweis Mandant: Pro Mandanten-Supabase-Projekt = ein Mandant. Keine Spalte tenant_id
-- (analog customers/bvs/objects). RLS über auth.uid() + Rollen-Helfer.
--
-- Storage-Pfad-Konvention (Original-PDF, privat):
--   Bucket: altbericht-import-pdfs
--   object name: {job_id}/{file_id}.pdf
--   (file_id = UUID aus altbericht_import_file; stabil für Retries)

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------

create table if not exists public.altbericht_import_job (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'draft',
  analysis_mode boolean not null default false,
  title text,
  notes text,
  started_at timestamptz,
  finished_at timestamptz,
  current_file_id uuid,
  parser_version text,
  constraint altbericht_import_job_status_check check (
    status in ('draft', 'queued', 'running', 'needs_review', 'failed', 'cancelled')
  )
);

create table if not exists public.altbericht_import_file (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.altbericht_import_job(id) on delete cascade,
  sequence int not null,
  status text not null default 'pending',
  original_filename text not null,
  content_type text not null default 'application/pdf',
  byte_size bigint,
  sha256 text,
  storage_bucket text not null default 'altbericht-import-pdfs',
  storage_path text not null,
  parsed_at timestamptz,
  parser_version text,
  parse_error_code text,
  parse_error_message text,
  extracted_text text,
  extracted_text_storage_path text,
  constraint altbericht_import_file_status_check check (
    status in ('pending', 'parsing', 'parsed', 'staged', 'parse_failed')
  ),
  constraint altbericht_import_file_job_sequence_key unique (job_id, sequence)
);

alter table public.altbericht_import_job
  drop constraint if exists altbericht_import_job_current_file_id_fkey;
alter table public.altbericht_import_job
  add constraint altbericht_import_job_current_file_id_fkey
  foreign key (current_file_id) references public.altbericht_import_file(id) on delete set null;

create table if not exists public.altbericht_import_staging_object (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.altbericht_import_job(id) on delete cascade,
  file_id uuid not null references public.altbericht_import_file(id) on delete cascade,
  sequence int not null,
  status text not null default 'draft',
  customer_text text,
  site_text text,
  bv_id uuid references public.bvs(id) on delete set null,
  object_name text not null default '',
  object_type_text text not null default '',
  floor_text text,
  room_text text,
  location_rule text not null default 'unknown',
  findings_json jsonb not null default '[]'::jsonb,
  catalog_candidates_json jsonb not null default '[]'::jsonb,
  media_hints_json jsonb not null default '[]'::jsonb,
  parser_confidence_json jsonb,
  source_refs_json jsonb,
  analysis_trace_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint altbericht_import_staging_object_status_check check (
    status in ('draft', 'incomplete', 'ready_for_review', 'blocked')
  ),
  constraint altbericht_import_staging_object_location_rule_check check (
    location_rule in ('floor', 'room', 'unknown')
  ),
  constraint altbericht_import_staging_object_file_sequence_key unique (file_id, sequence)
);

create table if not exists public.altbericht_import_event (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.altbericht_import_job(id) on delete cascade,
  file_id uuid references public.altbericht_import_file(id) on delete set null,
  staging_object_id uuid references public.altbericht_import_staging_object(id) on delete set null,
  created_at timestamptz not null default now(),
  level text not null,
  code text not null,
  message text not null,
  payload_json jsonb,
  constraint altbericht_import_event_level_check check (level in ('info', 'warn', 'error'))
);

create index if not exists idx_altbericht_import_job_created on public.altbericht_import_job (created_at desc);
create index if not exists idx_altbericht_import_job_status on public.altbericht_import_job (status);
create index if not exists idx_altbericht_import_file_job on public.altbericht_import_file (job_id);
create index if not exists idx_altbericht_import_file_status on public.altbericht_import_file (job_id, status);
create index if not exists idx_altbericht_import_staging_job on public.altbericht_import_staging_object (job_id);
create index if not exists idx_altbericht_import_staging_file on public.altbericht_import_staging_object (file_id);
create index if not exists idx_altbericht_import_event_job_created on public.altbericht_import_event (job_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at Trigger (einheitlich)
-- -----------------------------------------------------------------------------

create or replace function public.altbericht_import_set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists altbericht_import_job_updated_at on public.altbericht_import_job;
create trigger altbericht_import_job_updated_at
  before update on public.altbericht_import_job
  for each row execute function public.altbericht_import_set_updated_at();

drop trigger if exists altbericht_import_staging_object_updated_at on public.altbericht_import_staging_object;
create trigger altbericht_import_staging_object_updated_at
  before update on public.altbericht_import_staging_object
  for each row execute function public.altbericht_import_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.altbericht_import_job enable row level security;
alter table public.altbericht_import_file enable row level security;
alter table public.altbericht_import_staging_object enable row level security;
alter table public.altbericht_import_event enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'altbericht_import_job' loop
    execute format('drop policy if exists %I on public.altbericht_import_job', r.policyname);
  end loop;
end $$;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'altbericht_import_file' loop
    execute format('drop policy if exists %I on public.altbericht_import_file', r.policyname);
  end loop;
end $$;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'altbericht_import_staging_object' loop
    execute format('drop policy if exists %I on public.altbericht_import_staging_object', r.policyname);
  end loop;
end $$;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'altbericht_import_event' loop
    execute format('drop policy if exists %I on public.altbericht_import_event', r.policyname);
  end loop;
end $$;

-- Kundenportal: kein Zugriff auf internen Import
create policy "altbericht_import_job select staff"
  on public.altbericht_import_job for select
  using (auth.uid() is not null and not public.is_portal_customer());
create policy "altbericht_import_job insert staff"
  on public.altbericht_import_job for insert
  with check (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());
create policy "altbericht_import_job update staff"
  on public.altbericht_import_job for update
  using (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());
create policy "altbericht_import_job delete staff"
  on public.altbericht_import_job for delete
  using (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());

create policy "altbericht_import_file select staff"
  on public.altbericht_import_file for select
  using (auth.uid() is not null and not public.is_portal_customer());
create policy "altbericht_import_file insert staff"
  on public.altbericht_import_file for insert
  with check (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());
create policy "altbericht_import_file update staff"
  on public.altbericht_import_file for update
  using (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());
create policy "altbericht_import_file delete staff"
  on public.altbericht_import_file for delete
  using (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());

create policy "altbericht_import_staging_object select staff"
  on public.altbericht_import_staging_object for select
  using (auth.uid() is not null and not public.is_portal_customer());
create policy "altbericht_import_staging_object insert staff"
  on public.altbericht_import_staging_object for insert
  with check (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());
create policy "altbericht_import_staging_object update staff"
  on public.altbericht_import_staging_object for update
  using (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());
create policy "altbericht_import_staging_object delete staff"
  on public.altbericht_import_staging_object for delete
  using (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());

create policy "altbericht_import_event select staff"
  on public.altbericht_import_event for select
  using (auth.uid() is not null and not public.is_portal_customer());
create policy "altbericht_import_event insert staff"
  on public.altbericht_import_event for insert
  with check (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());
create policy "altbericht_import_event delete staff"
  on public.altbericht_import_event for delete
  using (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());

-- -----------------------------------------------------------------------------
-- Storage: privater Bucket + Policies
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('altbericht-import-pdfs', 'altbericht-import-pdfs', false)
on conflict (id) do nothing;

drop policy if exists "altbericht import pdfs staff read" on storage.objects;
drop policy if exists "altbericht import pdfs staff insert" on storage.objects;
drop policy if exists "altbericht import pdfs staff update" on storage.objects;
drop policy if exists "altbericht import pdfs staff delete" on storage.objects;

create policy "altbericht import pdfs staff read" on storage.objects for select
  using (bucket_id = 'altbericht-import-pdfs' and auth.uid() is not null and not public.is_portal_customer());
create policy "altbericht import pdfs staff insert" on storage.objects for insert
  with check (bucket_id = 'altbericht-import-pdfs' and auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());
create policy "altbericht import pdfs staff update" on storage.objects for update
  using (bucket_id = 'altbericht-import-pdfs' and auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());
create policy "altbericht import pdfs staff delete" on storage.objects for delete
  using (bucket_id = 'altbericht-import-pdfs' and auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());

-- Optional: Speichernutzung (get_storage_usage) um Bucket erweitern - bei nächster
-- Anpassung von supabase-complete.sql oder separatem Delta:
--   bucket_id in (..., 'altbericht-import-pdfs')


-- =============================================================================
-- 2. Paket B - Review-State, Resolved-Felder, Validierung
-- =============================================================================
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

-- Bestehende Zeilen: Review-Status an Parser-Status anlehnen (einmalig).
-- Die WHERE-Klauseln stellen sicher, dass committed-/ready-/skipped-Zeilen
-- nicht angefasst werden - nur initiale 'draft'-Zeilen erhalten den
-- passenderen Folgewert.
update public.altbericht_import_staging_object
set review_status = 'blocked'
where review_status = 'draft'
  and status = 'blocked';

update public.altbericht_import_staging_object
set review_status = 'needs_input'
where review_status = 'draft'
  and status in ('incomplete', 'ready_for_review', 'draft');


-- =============================================================================
-- 3. Paket C1 - Produktiv-Commit Kunde/BV/Objekt (ohne Mängel)
-- =============================================================================
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

-- Constraint synchron zu Paket B halten; 'committed' bleibt enthalten.
alter table public.altbericht_import_staging_object
  drop constraint if exists altbericht_import_staging_object_review_status_check;
alter table public.altbericht_import_staging_object
  add constraint altbericht_import_staging_object_review_status_check check (
    review_status in ('draft', 'needs_input', 'ready', 'blocked', 'skipped', 'committed')
  );

create index if not exists idx_altbericht_import_staging_committed
  on public.altbericht_import_staging_object (job_id, committed_at);


-- =============================================================================
-- 4. Paket C2 - Optionale Mängelübernahme nach C1
-- =============================================================================
-- Mandanten-Delta: Altbericht-Import Paket C2 (optionale Mängelübernahme nach C1)
-- Siehe CHANGELOG-Mandanten-DB.md
--
-- Idempotenz: c2_defects_imported_keys enthält stabile Schlüssel "f:<Index>" (Index in findings_json).
-- Append-only auf objects.defects_structured / objects.defects (nur offene als Legacy-Text).

alter table public.altbericht_import_staging_object
  add column if not exists c2_defects_imported_keys jsonb not null default '[]'::jsonb;

alter table public.altbericht_import_staging_object
  add column if not exists c2_defects_last_import_at timestamptz;

alter table public.altbericht_import_staging_object
  add column if not exists c2_defects_last_error text;

-- Transaktional: alle p_items anhängen oder keine Änderung (bei Konflikt/Fehler).
create or replace function public.altbericht_import_c2_commit_defects(
  p_staging_object_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.altbericht_import_staging_object%rowtype;
  v_struct jsonb;
  v_imported jsonb;
  v_additions jsonb := '[]'::jsonb;
  v_new_keys text[] := array[]::text[];
  v_keys_seen text[] := array[]::text[];
  v_now timestamptz := now();
  v_item jsonb;
  v_key text;
  v_text text;
  v_id uuid;
  v_elem jsonb;
  v_open_lines text[] := array[]::text[];
  v_open_text text;
  v_status text;
  i int;
  p_count int;
  v_obj_archived timestamptz;
begin
  if p_staging_object_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_staging_id');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_items');
  end if;

  select * into v_row
  from public.altbericht_import_staging_object
  where id = p_staging_object_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'staging_not_found');
  end if;

  if v_row.committed_at is null or v_row.committed_object_id is null then
    update public.altbericht_import_staging_object
    set c2_defects_last_error = 'C1 nicht abgeschlossen (committed_at / committed_object_id fehlt).'
    where id = p_staging_object_id;
    return jsonb_build_object('ok', false, 'error', 'c1_not_committed');
  end if;

  if coalesce(v_row.review_status, '') <> 'committed' then
    update public.altbericht_import_staging_object
    set c2_defects_last_error = 'Nur Zeilen mit Review-Status „committed“ dürfen C2 nutzen.'
    where id = p_staging_object_id;
    return jsonb_build_object('ok', false, 'error', 'review_not_committed');
  end if;

  v_imported := coalesce(v_row.c2_defects_imported_keys, '[]'::jsonb);
  if jsonb_typeof(v_imported) <> 'array' then
    v_imported := '[]'::jsonb;
  end if;

  select archived_at, defects_structured
  into v_obj_archived, v_struct
  from public.objects
  where id = v_row.committed_object_id
  for update;

  if not found then
    update public.altbericht_import_staging_object
    set c2_defects_last_error = 'Zielobjekt nicht gefunden.'
    where id = p_staging_object_id;
    return jsonb_build_object('ok', false, 'error', 'object_not_found');
  end if;

  if v_obj_archived is not null then
    update public.altbericht_import_staging_object
    set c2_defects_last_error = 'Zielobjekt ist archiviert.'
    where id = p_staging_object_id;
    return jsonb_build_object('ok', false, 'error', 'object_archived');
  end if;

  v_struct := coalesce(v_struct, '[]'::jsonb);
  if jsonb_typeof(v_struct) <> 'array' then
    v_struct := '[]'::jsonb;
  end if;

  p_count := jsonb_array_length(p_items);

  for i in 0 .. p_count - 1 loop
    v_item := p_items -> i;
    v_key := nullif(trim(coalesce(v_item->>'key', '')), '');
    v_text := trim(coalesce(v_item->>'text', ''));

    if v_key is null or length(v_text) = 0 then
      update public.altbericht_import_staging_object
      set c2_defects_last_error = format('Ungültiger Eintrag (key/text): Position %s.', i + 1)
      where id = p_staging_object_id;
      return jsonb_build_object('ok', false, 'error', 'invalid_item', 'index', i);
    end if;

    if v_key = any (v_keys_seen) then
      update public.altbericht_import_staging_object
      set c2_defects_last_error = format('Doppelter Schlüssel in Anfrage: %s.', v_key)
      where id = p_staging_object_id;
      return jsonb_build_object('ok', false, 'error', 'duplicate_key_in_request', 'key', v_key);
    end if;
    v_keys_seen := array_append(v_keys_seen, v_key);

    if exists (
      select 1
      from jsonb_array_elements(v_imported) e
      where e #>> '{}' = v_key
    ) then
      update public.altbericht_import_staging_object
      set c2_defects_last_error = format('Kandidat wurde bereits produktiv übernommen: %s.', v_key)
      where id = p_staging_object_id;
      return jsonb_build_object('ok', false, 'error', 'already_imported', 'key', v_key);
    end if;

    v_id := gen_random_uuid();
    v_additions := v_additions || jsonb_build_array(
      jsonb_build_object(
        'id', v_id::text,
        'text', v_text,
        'status', 'open',
        'created_at', to_jsonb(v_now),
        'resolved_at', null
      )
    );
    v_new_keys := array_append(v_new_keys, v_key);
  end loop;

  v_struct := v_struct || v_additions;

  for v_elem in select value from jsonb_array_elements(v_struct)
  loop
    v_status := coalesce(v_elem->>'status', 'open');
    v_open_text := trim(coalesce(v_elem->>'text', ''));
    if v_status = 'open' and length(v_open_text) > 0 then
      v_open_lines := array_append(v_open_lines, v_open_text);
    end if;
  end loop;

  update public.objects
  set
    defects_structured = v_struct,
    defects = case
      when cardinality(v_open_lines) > 0 then array_to_string(v_open_lines, E'\n\n')
      else null
    end,
    updated_at = v_now
  where id = v_row.committed_object_id;

  v_imported := v_imported || (
    select coalesce(jsonb_agg(x order by o), '[]'::jsonb)
    from unnest(v_new_keys) with ordinality as t(x, o)
  );

  update public.altbericht_import_staging_object
  set
    c2_defects_imported_keys = v_imported,
    c2_defects_last_import_at = v_now,
    c2_defects_last_error = null
  where id = p_staging_object_id;

  return jsonb_build_object(
    'ok', true,
    'importedKeys', to_jsonb(v_new_keys),
    'objectId', v_row.committed_object_id
  );
exception
  when others then
    begin
      update public.altbericht_import_staging_object
      set c2_defects_last_error = left(sqlerrm, 2000)
      where id = p_staging_object_id;
    exception
      when others then null;
    end;
    return jsonb_build_object('ok', false, 'error', 'exception', 'message', sqlerrm);
end;
$$;

grant execute on function public.altbericht_import_c2_commit_defects(uuid, jsonb) to authenticated;
grant execute on function public.altbericht_import_c2_commit_defects(uuid, jsonb) to service_role;


-- =============================================================================
-- 5. Paket D - proposed_internal_id + import_match_key
-- =============================================================================
-- Paket D: vorgeschlagene interne ID + fachlicher Import-Match-Key (Fingerprint) fürs Staging.
-- Idempotent, nach App-Deploy mit Parser/Persist-Code ausführen.

alter table public.altbericht_import_staging_object
  add column if not exists proposed_internal_id text;

alter table public.altbericht_import_staging_object
  add column if not exists import_match_key text;

comment on column public.altbericht_import_staging_object.proposed_internal_id is
  'Vom Import vorgeschlagene sichtbare Objektkennung (OBJ-…), vor C1-Commit; C1 Neuanlage übernimmt, wenn leeres review_object_id.';

comment on column public.altbericht_import_staging_object.import_match_key is
  'Fachlicher Vergleichsschlüssel/Fingerprint (Parser-Zeitpunkt) für weiche Dublettenprüfung, kein DB-Unique.';

create index if not exists idx_altbericht_import_staging_match_key
  on public.altbericht_import_staging_object (job_id, import_match_key)
  where import_match_key is not null;


-- =============================================================================
-- 6. Paket E - Embedded Images (Metadaten + manuelle Zuordnung)
-- =============================================================================
-- Paket E: eingebettete PDF-Bilder im Altbericht-Import (Metadaten + manuelle Zuordnung, Experte).
-- Idempotent, nach App-Deploy mit Bild-Scan ausführen.

create table if not exists public.altbericht_import_embedded_image (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.altbericht_import_job(id) on delete cascade,
  file_id uuid not null references public.altbericht_import_file(id) on delete cascade,
  page_number int not null,
  image_index int not null,
  scan_version text not null default 'pdfjs_operator_v1',
  op_kind text,
  suggested_staging_object_id uuid references public.altbericht_import_staging_object(id) on delete set null,
  user_intent text not null default 'unreviewed',
  linked_staging_object_id uuid references public.altbericht_import_staging_object(id) on delete set null,
  preview_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint altbericht_import_embedded_image_user_intent_check check (
    user_intent in ('unreviewed', 'ignore', 'object_photo', 'defect_photo')
  ),
  constraint altbericht_import_embedded_image_file_page_idx unique (file_id, page_number, image_index)
);

comment on table public.altbericht_import_embedded_image is
  'Vom PDF-Scan erkannte eingebettete Bilder; manuelle Intent-Zuordnung (Vorbereitung Fotoübernahme, kein Auto-Commit).';

create index if not exists idx_altbericht_embedded_image_job on public.altbericht_import_embedded_image (job_id);
create index if not exists idx_altbericht_embedded_image_file on public.altbericht_import_embedded_image (file_id);

drop trigger if exists altbericht_import_embedded_image_updated_at on public.altbericht_import_embedded_image;
create trigger altbericht_import_embedded_image_updated_at
  before update on public.altbericht_import_embedded_image
  for each row execute function public.altbericht_import_set_updated_at();

alter table public.altbericht_import_embedded_image enable row level security;

-- Idempotent: Postgres < 17 kennt kein `create policy if not exists`. Beim Re-Apply würde der zweite
-- Lauf sonst mit 42710 (policy already exists) abbrechen. Daher vor jedem create policy ein drop.
drop policy if exists "altbericht_import_embedded_image select staff" on public.altbericht_import_embedded_image;
drop policy if exists "altbericht_import_embedded_image insert staff" on public.altbericht_import_embedded_image;
drop policy if exists "altbericht_import_embedded_image update staff" on public.altbericht_import_embedded_image;
drop policy if exists "altbericht_import_embedded_image delete staff" on public.altbericht_import_embedded_image;

create policy "altbericht_import_embedded_image select staff"
  on public.altbericht_import_embedded_image for select
  using (auth.uid() is not null and not public.is_portal_customer());
create policy "altbericht_import_embedded_image insert staff"
  on public.altbericht_import_embedded_image for insert
  with check (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());
create policy "altbericht_import_embedded_image update staff"
  on public.altbericht_import_embedded_image for update
  using (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());
create policy "altbericht_import_embedded_image delete staff"
  on public.altbericht_import_embedded_image for delete
  using (auth.uid() is not null and not public.is_portal_customer() and public.can_write_master_data());


-- =============================================================================
-- 7. Paket F - Produktive Foto-Übernahme
-- =============================================================================
-- Paket F: produktive Fotoübernahme aus altbericht_import_embedded_image (Objekt-Galerie / Stammdaten-Mängelfoto).
-- Nach Paket E ausführen.

alter table public.altbericht_import_embedded_image
  add column if not exists import_status text not null default 'not_imported';

alter table public.altbericht_import_embedded_image
  add column if not exists imported_at timestamptz;

alter table public.altbericht_import_embedded_image
  add column if not exists import_error text;

alter table public.altbericht_import_embedded_image
  add column if not exists import_object_photo_id uuid references public.object_photos (id) on delete set null;

alter table public.altbericht_import_embedded_image
  add column if not exists import_defect_photo_id uuid references public.object_defect_photos (id) on delete set null;

alter table public.altbericht_import_embedded_image
  add column if not exists target_object_id uuid references public.objects (id) on delete set null;

-- Welcher C2-„f:Index“-Mängel (nach C2-Import) für Mängelfoto; UI setzt vor Übernahme.
alter table public.altbericht_import_embedded_image
  add column if not exists c2_finding_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'altbericht_import_embedded_image_import_status_check'
  ) then
    alter table public.altbericht_import_embedded_image
      add constraint altbericht_import_embedded_image_import_status_check
        check (import_status in ('not_imported', 'imported', 'failed'));
  end if;
end $$;

comment on column public.altbericht_import_embedded_image.import_status is
  'Produktivübernahme: not_imported | imported | failed (Hinweis: Reparse/Rescan der Datei setzt scan-Zeilen zurück).';
comment on column public.altbericht_import_embedded_image.c2_finding_key is
  'C2-Schlüssel f:<Index> für Mängelfoto, nur sinnvoll nach C2-Übernahme des Mängels.';


-- =============================================================================
-- 8. Paket G - Optionale Scan-Metadaten
-- =============================================================================
-- Paket G: optionale Scan-Metadaten für eingebettete PDF-Bilder (Logo-/Header-Heuristik).
-- Nach Paket E/F ausführen; App nutzt die Spalte, wenn vorhanden.

alter table public.altbericht_import_embedded_image
  add column if not exists scan_meta_json jsonb;

comment on column public.altbericht_import_embedded_image.scan_meta_json is
  'Optional: Pixelmaße, Fingerprint, logoLikelihood (none|suspect|likely), Gründe — Scan pdfjs_operator_v2_logo_meta.';


-- =============================================================================
-- 9. objects.anforderung - Brandschutz-/Normangabe
-- =============================================================================
-- Brandschutz-/Normangabe (z. B. T30) für Tür/Tor-Stammdaten; Altbericht C1 & UI.
alter table public.objects add column if not exists anforderung text;


-- =============================================================================
-- Ende - Mandanten-DB · Altbericht-Import · Complete-SQL
-- =============================================================================
