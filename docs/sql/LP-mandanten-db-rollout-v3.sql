-- -----------------------------------------------------------------------------
-- Lizenzportal: Mandanten-DB-Rollout Phase 3 (Runs + Targets + enrich RPC)
-- -----------------------------------------------------------------------------
-- Idempotent. Kanonisch auch in `supabase-license-portal.sql` Abschnitt 10b.
-- Nach Deploy: Edge `update-mandanten-db-rollout-status` + Secret `MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET`.

-- (Inhalt identisch zu supabase-license-portal.sql ab Kommentar „10b. MANDANTEN-DB-ROLLOUT-HISTORIE“)

create table if not exists public.mandanten_db_rollout_runs (
  id uuid primary key default gen_random_uuid(),
  started_by text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  product_key text,
  module_key text,
  package_id text,
  sql_file text not null,
  target text not null,
  mode text not null,
  status text not null,
  github_run_url text,
  summary_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mandanten_db_rollout_runs' and column_name = 'triggered_by'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mandanten_db_rollout_runs' and column_name = 'started_by'
  ) then
    alter table public.mandanten_db_rollout_runs rename column triggered_by to started_by;
  end if;
end $$;

alter table public.mandanten_db_rollout_runs add column if not exists finished_at timestamptz;
alter table public.mandanten_db_rollout_runs add column if not exists package_id text;
alter table public.mandanten_db_rollout_runs add column if not exists summary_json jsonb;
alter table public.mandanten_db_rollout_runs add column if not exists created_at timestamptz default now();
alter table public.mandanten_db_rollout_runs add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mandanten_db_rollout_runs' and column_name = 'response_message'
  ) then
    update public.mandanten_db_rollout_runs
    set summary_json = coalesce(summary_json, '{}'::jsonb) || jsonb_build_object(
      'legacy_response_message',
      response_message
    )
    where response_message is not null and trim(response_message) <> '';
    alter table public.mandanten_db_rollout_runs drop column response_message;
  end if;
end $$;

alter table public.mandanten_db_rollout_runs drop column if exists tenant_id;

update public.mandanten_db_rollout_runs set status = 'queued' where status = 'started';

alter table public.mandanten_db_rollout_runs alter column created_at set default now();
alter table public.mandanten_db_rollout_runs alter column updated_at set default now();

create table if not exists public.mandanten_db_rollout_targets (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.mandanten_db_rollout_runs(id) on delete cascade,
  target_index int not null,
  tenant_id uuid,
  project_ref text,
  db_host_masked text not null,
  status text not null,
  started_at timestamptz,
  finished_at timestamptz,
  psql_exit_code int,
  error_excerpt text,
  stdout_excerpt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, target_index)
);

create index if not exists mandanten_db_rollout_targets_run_idx
  on public.mandanten_db_rollout_targets (run_id);

create index if not exists mandanten_db_rollout_runs_started_at_idx
  on public.mandanten_db_rollout_runs (started_at desc);

alter table public.mandanten_db_rollout_runs enable row level security;
alter table public.mandanten_db_rollout_targets enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'mandanten_db_rollout_runs' loop
    execute format('drop policy if exists %I on public.mandanten_db_rollout_runs', r.policyname);
  end loop;
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'mandanten_db_rollout_targets' loop
    execute format('drop policy if exists %I on public.mandanten_db_rollout_targets', r.policyname);
  end loop;
end $$;

create policy "Admins read mandanten_db_rollout_runs"
  on public.mandanten_db_rollout_runs
  for select
  using (public.is_admin());

create policy "Admins read mandanten_db_rollout_targets"
  on public.mandanten_db_rollout_targets
  for select
  using (public.is_admin());

create or replace function public.enrich_mandanten_db_rollout_targets(p_run_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.mandanten_db_rollout_targets t
  set tenant_id = tn.id
  from public.tenants tn
  where t.run_id = p_run_id
    and tn.supabase_project_ref is not null
    and tn.supabase_project_ref <> ''
    and tn.supabase_project_ref = t.project_ref;
$$;

grant execute on function public.enrich_mandanten_db_rollout_targets(uuid) to service_role;
