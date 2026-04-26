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
