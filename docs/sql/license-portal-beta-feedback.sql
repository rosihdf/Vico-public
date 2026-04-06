-- Delta: Beta-Feedback (Lizenzportal-DB)
-- Vollständig auch in supabase-license-portal.sql; hier für bestehende Projekte einzeln anwendbar.

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  license_number text,
  mandant_user_id uuid not null,
  source_app text not null check (source_app in ('main', 'kundenportal', 'arbeitszeit_portal')),
  route_path text not null,
  route_query text,
  category text not null check (
    category in (
      'ui_layout',
      'flow_logic',
      'missing_feature',
      'remove_feature',
      'bug',
      'other'
    )
  ),
  severity text check (severity in ('blocker', 'annoyance', 'wish')),
  title text,
  description text not null,
  app_version text,
  release_label text,
  status text not null default 'new' check (
    status in ('new', 'triaging', 'planned', 'done', 'rejected', 'duplicate')
  ),
  priority text check (priority in ('p0', 'p1', 'p2', 'p3')),
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists beta_feedback_tenant_created_idx on public.beta_feedback (tenant_id, created_at desc);
create index if not exists beta_feedback_tenant_user_day_idx on public.beta_feedback (tenant_id, mandant_user_id, created_at desc);
create index if not exists beta_feedback_status_idx on public.beta_feedback (status);

alter table public.beta_feedback enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'beta_feedback' loop
    execute format('drop policy if exists %I on public.beta_feedback', r.policyname);
  end loop;
end $$;

create policy "Admins read beta_feedback" on public.beta_feedback for select using (public.is_admin());
create policy "Admins update beta_feedback" on public.beta_feedback for update using (public.is_admin());
