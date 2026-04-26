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

-- Optional: Speichernutzung (get_storage_usage) um Bucket erweitern — bei nächster
-- Anpassung von supabase-complete.sql oder separatem Delta:
--   bucket_id in (..., 'altbericht-import-pdfs')
