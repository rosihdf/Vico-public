-- Lizenzportal (public.tenants): optionale CF-Pages-Preview-URLs für Assistent / Verbindungsprüfung.
-- Idempotent. Ausführung: Supabase SQL Editor (Lizenzportal-Projekt) oder psql gegen LP-DB.
-- Siehe auch: supabase-license-portal.sql Abschnitt „11. DEPLOYMENT: OPTIONALE CF-PREVIEW-URLS“.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tenants' and column_name='cf_preview_main_url') then
    alter table public.tenants add column cf_preview_main_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tenants' and column_name='cf_preview_portal_url') then
    alter table public.tenants add column cf_preview_portal_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tenants' and column_name='cf_preview_arbeitszeit_url') then
    alter table public.tenants add column cf_preview_arbeitszeit_url text;
  end if;
end $$;
