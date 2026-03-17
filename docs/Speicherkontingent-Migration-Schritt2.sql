-- =============================================================================
-- Speicherkontingent – Migration Schritt 2 (Lizenzportal)
-- =============================================================================
-- Nur im Lizenzportal-Supabase-Projekt ausführen.
-- Zeigt verfügbaren Speicher an und verhindert Überzuweisung.
-- =============================================================================

create table if not exists public.platform_config (
  key text primary key,
  value jsonb not null
);

alter table public.platform_config enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'platform_config' loop
    execute format('drop policy if exists %I on public.platform_config', r.policyname);
  end loop;
end $$;
create policy "Admins can manage platform_config" on public.platform_config for all using (public.is_admin());

insert into public.platform_config (key, value) values ('total_storage_mb', '10000') on conflict (key) do nothing;

-- Zugewiesen = Summe aus licenses.max_storage_mb, Fallback auf license_models.max_storage_mb wenn Lizenz kein eigenes hat
create or replace function public.get_storage_summary()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with assigned as (
    select coalesce(sum(coalesce(l.max_storage_mb, lm.max_storage_mb)), 0) as mb
    from public.licenses l
    left join public.license_models lm on l.license_model_id = lm.id
    where coalesce(l.max_storage_mb, lm.max_storage_mb) is not null
  ),
  total as (
    select coalesce((value::text)::int, 10000) as mb
    from public.platform_config
    where key = 'total_storage_mb'
    limit 1
  )
  select jsonb_build_object(
    'total_available_mb', coalesce((select mb from total), 10000),
    'assigned_mb', (select mb from assigned),
    'remaining_mb', greatest(0, coalesce((select mb from total), 10000) - (select mb from assigned))
  );
$$;
grant execute on function public.get_storage_summary() to authenticated;
