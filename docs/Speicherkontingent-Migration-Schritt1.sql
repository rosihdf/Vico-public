-- =============================================================================
-- Speicherkontingent – Migration Schritt 1
-- =============================================================================
-- Führe dieses SQL im jeweiligen Supabase-Projekt aus:
--
-- 1. LIZENZPORTAL (supabase-license-portal): max_storage_mb für license_models und licenses
-- 2. MANDANTEN (supabase-complete / Mandanten-DB): RPC get_storage_usage()
-- =============================================================================

-- =============================================================================
-- TEIL A: Lizenzportal-Projekt
-- =============================================================================
-- Nur ausführen, wenn du im Lizenzportal-Supabase-Projekt bist.

-- license_models: max_storage_mb (MB, null = unbegrenzt)
alter table public.license_models add column if not exists max_storage_mb int;

-- licenses: max_storage_mb (MB, null = unbegrenzt; überschreibt Modell bei Lizenz)
alter table public.licenses add column if not exists max_storage_mb int;

-- =============================================================================
-- TEIL B: Mandanten-Projekt (jedes Mandanten-Supabase)
-- =============================================================================
-- Nur ausführen, wenn du im Mandanten-Supabase-Projekt bist (Haupt-App-DB).

-- RPC: Summe aller Speichergrößen in storage.objects (object-photos, object-documents, maintenance-photos)
-- Rückgabe: Größe in MB (numeric)
create or replace function public.get_storage_usage()
returns numeric
language sql
security definer
set search_path = public, storage
stable
as $$
  select coalesce(
    round(
      (sum((metadata->>'size')::bigint) / 1048576.0)::numeric,
      2
    ),
    0
  )
  from storage.objects
  where bucket_id in ('object-photos', 'object-documents', 'maintenance-photos');
$$;

grant execute on function public.get_storage_usage() to authenticated;
grant execute on function public.get_storage_usage() to service_role;
