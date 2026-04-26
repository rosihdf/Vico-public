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
