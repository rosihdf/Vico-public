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
