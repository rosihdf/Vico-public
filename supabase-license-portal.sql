-- -----------------------------------------------------------------------------
-- Vico Lizenzportal – Datenbank-Schema
-- -----------------------------------------------------------------------------
-- Eigenes Supabase-Projekt für Mandanten & Lizenzen.
-- Im Supabase SQL Editor ausführen (neues Projekt anlegen oder bestehendes).
-- Idempotent. Zuletzt strukturell aufgeräumt: 2026-03.
--
-- RLS: is_admin() als SECURITY DEFINER verhindert Rekursion (Policies lesen
-- profiles nicht direkt, sondern über die Funktion).
--
-- Inhaltsverzeichnis
--   1. Profiles (Admin, get_my_role, Signup-Trigger)
--   2. Tenants (+ nachträgliche Spalten idempotent)
--   3. Licenses (+ FK license_model_id)
--   3b. License_models (Vorlagen, Seeds)
--   4. limit_exceeded_log
--   5. platform_config, get_storage_summary()
--   5b. Storage: tenant_logos (L4)
--   6. Indizes
--
-- Optimierung (Kurz): Indizes an FKs/Listen; Speicher-RPC nutzt license_models-
-- Fallback. Kein zweites „Analytics“-Schema – bei Bedarf pg_stat_statements im Betrieb.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 1. PROFILES (Admin-Benutzer für Lizenzportal)
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid references auth.users(id) primary key,
  email text,
  first_name text,
  last_name text,
  role text default 'admin' check (role in ('admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- SECURITY DEFINER verhindert Rekursion: liest profiles ohne RLS
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy if exists %I on public.profiles', r.policyname);
  end loop;
end $$;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Admins can read all profiles" on public.profiles for select using (public.is_admin());

create or replace function public.get_my_role()
returns text language sql security definer set search_path = public stable as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;
grant execute on function public.get_my_role() to authenticated;

-- Trigger: Profil bei Signup anlegen
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'admin')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. TENANTS (Mandanten)
-- -----------------------------------------------------------------------------

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  app_domain text,
  portal_domain text,
  arbeitszeitenportal_domain text,
  logo_url text,
  primary_color text default '#5b7895',
  secondary_color text,
  favicon_url text,
  app_name text default 'Vico',
  -- Impressum
  impressum_company_name text,
  impressum_address text,
  impressum_contact text,
  impressum_represented_by text,
  impressum_register text,
  impressum_vat_id text,
  -- Datenschutz
  datenschutz_responsible text,
  datenschutz_contact_email text,
  datenschutz_dsb_email text,
  -- Supabase (Mandanten-DB)
  supabase_project_ref text,
  supabase_url text,
  -- Domain-Bindung: Lizenz nur von diesen Domains nutzbar (leer = keine Prüfung)
  allowed_domains jsonb default '[]'::jsonb,
  -- Optional: Version/Release Notes je App (main, kundenportal, arbeitszeit_portal, admin)
  app_versions jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- allowed_domains: Spalte nachträglich hinzufügen
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'allowed_domains'
  ) then
    alter table public.tenants add column allowed_domains jsonb default '[]'::jsonb;
  end if;
end $$;

-- arbeitszeitenportal_domain: Spalte nachträglich hinzufügen
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'arbeitszeitenportal_domain'
  ) then
    alter table public.tenants add column arbeitszeitenportal_domain text;
  end if;
end $$;

-- Wartungsmodus pro Mandant (LP-Schalter)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_mode_enabled'
  ) then
    alter table public.tenants add column maintenance_mode_enabled boolean not null default false;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_mode_message'
  ) then
    alter table public.tenants add column maintenance_mode_message text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_mode_updated_at'
  ) then
    alter table public.tenants add column maintenance_mode_updated_at timestamptz;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_mode_updated_by'
  ) then
    alter table public.tenants add column maintenance_mode_updated_by uuid references public.profiles(id) on delete set null;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_mode_duration_min'
  ) then
    alter table public.tenants add column maintenance_mode_duration_min int check (maintenance_mode_duration_min is null or maintenance_mode_duration_min >= 1);
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_mode_started_at'
  ) then
    alter table public.tenants add column maintenance_mode_started_at timestamptz;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_mode_ends_at'
  ) then
    alter table public.tenants add column maintenance_mode_ends_at timestamptz;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_mode_auto_end'
  ) then
    alter table public.tenants add column maintenance_mode_auto_end boolean not null default false;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_announcement_enabled'
  ) then
    alter table public.tenants add column maintenance_announcement_enabled boolean not null default false;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_announcement_message'
  ) then
    alter table public.tenants add column maintenance_announcement_message text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_announcement_from'
  ) then
    alter table public.tenants add column maintenance_announcement_from timestamptz;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_announcement_until'
  ) then
    alter table public.tenants add column maintenance_announcement_until timestamptz;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_announcement_updated_at'
  ) then
    alter table public.tenants add column maintenance_announcement_updated_at timestamptz;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_announcement_updated_by'
  ) then
    alter table public.tenants add column maintenance_announcement_updated_by uuid references public.profiles(id) on delete set null;
  end if;
  -- Wartungsmodus: je Ziel-App schaltbar (Lizenz-API maintenance.mode_apply_*)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_mode_apply_main_app'
  ) then
    alter table public.tenants add column maintenance_mode_apply_main_app boolean not null default true;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_mode_apply_arbeitszeit_portal'
  ) then
    alter table public.tenants add column maintenance_mode_apply_arbeitszeit_portal boolean not null default true;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'maintenance_mode_apply_customer_portal'
  ) then
    alter table public.tenants add column maintenance_mode_apply_customer_portal boolean not null default true;
  end if;
end $$;

-- app_versions: optional pro Mandant (Version/Release Notes je Frontend-App)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'app_versions'
  ) then
    alter table public.tenants add column app_versions jsonb default '{}'::jsonb;
  end if;
end $$;

alter table public.tenants enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'tenants' loop
    execute format('drop policy if exists %I on public.tenants', r.policyname);
  end loop;
end $$;
create policy "Admins can manage tenants" on public.tenants for all using (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3. LICENSES (Lizenzen pro Mandant)
-- -----------------------------------------------------------------------------

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  license_number text not null unique,
  tier text default 'professional' check (tier in ('free', 'professional', 'enterprise')),
  valid_until date,
  is_trial boolean default false,
  grace_period_days int default 0 check (grace_period_days >= 0),
  max_users int,
  max_customers int,
  max_storage_mb int,
  check_interval text default 'daily' check (check_interval in ('on_start', 'daily', 'weekly')),
  features jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Schonfrist (Tage): Spalte nachträglich hinzufügen falls Tabelle schon existiert
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'licenses' and column_name = 'grace_period_days'
  ) then
    alter table public.licenses add column grace_period_days int default 0 check (grace_period_days >= 0);
  end if;
end $$;

-- Trial-Flag: Spalte nachträglich hinzufügen
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'licenses' and column_name = 'is_trial'
  ) then
    alter table public.licenses add column is_trial boolean default false;
  end if;
end $$;

-- max_storage_mb: Spalte nachträglich hinzufügen
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'licenses' and column_name = 'max_storage_mb'
  ) then
    alter table public.licenses add column max_storage_mb int;
  end if;
end $$;

-- client_config_version: Hochzählen im Admin signalisiert Mandanten-Apps (Polling der Lizenz-API)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'licenses' and column_name = 'client_config_version'
  ) then
    alter table public.licenses add column client_config_version int not null default 0 check (client_config_version >= 0);
  end if;
end $$;

alter table public.licenses enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'licenses' loop
    execute format('drop policy if exists %I on public.licenses', r.policyname);
  end loop;
end $$;
create policy "Admins can manage licenses" on public.licenses for all using (public.is_admin());

-- Hinweis: Eindeutigkeit „eine aktive Lizenz pro Mandant“ ggf. per Trigger/App-Logik prüfen.
-- Partieller Index mit current_date nicht möglich (current_date ist STABLE, Index-Prädikat braucht IMMUTABLE).

-- -----------------------------------------------------------------------------
-- 3b. LICENSE_MODELS (Lizenzmodelle – Vorlagen für Lizenzen)
-- -----------------------------------------------------------------------------

create table if not exists public.license_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text default 'professional' check (tier in ('free', 'professional', 'enterprise')),
  max_users int,
  max_customers int,
  max_storage_mb int,
  check_interval text default 'daily' check (check_interval in ('on_start', 'daily', 'weekly')),
  features jsonb default '{}'::jsonb,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.license_models enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'license_models' loop
    execute format('drop policy if exists %I on public.license_models', r.policyname);
  end loop;
end $$;
create policy "Admins can manage license_models" on public.license_models for all using (public.is_admin());

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.license_models'::regclass and conname = 'license_models_name_tier_key') then
    alter table public.license_models add constraint license_models_name_tier_key unique (name, tier);
  end if;
end $$;

alter table public.licenses add column if not exists license_model_id uuid references public.license_models(id) on delete set null;

-- max_storage_mb für license_models: Spalte nachträglich hinzufügen
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'license_models' and column_name = 'max_storage_mb'
  ) then
    alter table public.license_models add column max_storage_mb int;
  end if;
end $$;

-- Standard-Lizenzmodelle (nur wenn Tabelle leer)
do $$
begin
  if not exists (select 1 from public.license_models limit 1) then
    insert into public.license_models (name, tier, max_users, max_customers, max_storage_mb, check_interval, features, sort_order)
    values
      ('Free', 'free', 2, 5, 100, 'daily', '{"kundenportal": false, "historie": false, "arbeitszeiterfassung": false, "standortabfrage": false, "wartungsprotokolle": false, "buchhaltung_export": false, "urlaub": false, "fehlerberichte": false, "ladezeiten": false}'::jsonb, 1),
      ('Professional', 'professional', 10, 50, 500, 'daily', '{"kundenportal": true, "historie": true, "arbeitszeiterfassung": true, "standortabfrage": true, "wartungsprotokolle": true, "buchhaltung_export": true, "urlaub": true, "fehlerberichte": true, "ladezeiten": true}'::jsonb, 2),
      ('Enterprise', 'enterprise', null, null, null, 'weekly', '{"kundenportal": true, "historie": true, "arbeitszeiterfassung": true, "standortabfrage": true, "wartungsprotokolle": true, "buchhaltung_export": true, "urlaub": true, "fehlerberichte": true, "ladezeiten": true}'::jsonb, 3);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4. LIMIT_EXCEEDED_LOG (Grenzüberschreitung-Meldungen)
-- -----------------------------------------------------------------------------

create table if not exists public.limit_exceeded_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  license_id uuid references public.licenses(id) on delete set null,
  limit_type text not null check (limit_type in ('users', 'customers')),
  current_value int not null,
  max_value int not null,
  license_number text,
  reported_from text,
  created_at timestamptz default now()
);

-- reported_from: Domain/Origin, von der die Meldung kam (für Doppelnutzung-Erkennung)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'limit_exceeded_log' and column_name = 'reported_from'
  ) then
    alter table public.limit_exceeded_log add column reported_from text;
  end if;
end $$;

alter table public.limit_exceeded_log enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'limit_exceeded_log' loop
    execute format('drop policy if exists %I on public.limit_exceeded_log', r.policyname);
  end loop;
end $$;
create policy "Admins can read limit_exceeded_log" on public.limit_exceeded_log for select using (public.is_admin());

-- Insert erfolgt ausschließlich über Edge Function limit-exceeded (service_role, RLS umgangen).
-- Keine INSERT-Policy für anon/authenticated – verhindert unbefugte Einträge.

-- limit_type-Check für bestehende Tabellen (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.limit_exceeded_log'::regclass and conname = 'limit_exceeded_log_limit_type_check'
  ) then
    alter table public.limit_exceeded_log add constraint limit_exceeded_log_limit_type_check
      check (limit_type in ('users', 'customers'));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. PLATFORM_CONFIG (Speicher-Kontingent)
-- -----------------------------------------------------------------------------

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

-- Standard: 10.000 MB (10 GB) Gesamtspeicher
insert into public.platform_config (key, value) values ('total_storage_mb', '10000') on conflict (key) do nothing;

-- Globale Standard-App-Versionen (Merge mit tenants.app_versions in der Lizenz-API)
insert into public.platform_config (key, value) values ('default_app_versions', '{}'::jsonb) on conflict (key) do nothing;

-- RPC: Speicher-Zusammenfassung (verfügbar, zugewiesen, frei)
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

-- -----------------------------------------------------------------------------
-- 5b. Storage: Mandanten-Logos (Roadmap L4)
-- Bucket öffentlich lesbar; Schreiben nur für Portal-Admins (is_admin).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant_logos',
  'tenant_logos',
  true,
  2097152,
  array['image/webp', 'image/png', 'image/jpeg', 'image/svg+xml']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'tenant_logo_%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "tenant_logo_public_read"
on storage.objects for select
to public
using (bucket_id = 'tenant_logos');

create policy "tenant_logo_admins_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'tenant_logos' and public.is_admin());

create policy "tenant_logo_admins_update"
on storage.objects for update
to authenticated
using (bucket_id = 'tenant_logos' and public.is_admin())
with check (bucket_id = 'tenant_logos' and public.is_admin());

create policy "tenant_logo_admins_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'tenant_logos' and public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. INDIZES
-- -----------------------------------------------------------------------------

create index if not exists tenants_name_idx on public.tenants (name);
create index if not exists licenses_tenant_created_idx on public.licenses (tenant_id, created_at desc);
-- license_number: Unique-Constraint erzeugt bereits einen Index
create index if not exists license_models_sort_name_idx on public.license_models (sort_order, name);
create index if not exists limit_exceeded_log_tenant_created_idx on public.limit_exceeded_log (tenant_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 7. MANDANTEN-APP-RELEASES (§11.20 / WP-REL) – Entwürfe, Incoming, Go-Live pro Kanal
-- -----------------------------------------------------------------------------

-- Release-Verwalter: Admins mit Flag (Standard an = bestehende Installationen unverändert)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'can_manage_app_releases'
  ) then
    alter table public.profiles add column can_manage_app_releases boolean not null default true;
  end if;
end $$;

-- Testmandant (Incoming / Pilot)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'is_test_mandant'
  ) then
    alter table public.tenants add column is_test_mandant boolean not null default false;
  end if;
end $$;

create or replace function public.can_manage_app_releases()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.can_manage_app_releases, true) = true
  );
$$;
grant execute on function public.can_manage_app_releases() to authenticated;

create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('main', 'kundenportal', 'arbeitszeit_portal')),
  version_semver text not null,
  release_type text not null check (release_type in ('bugfix', 'feature', 'major')),
  title text,
  notes text,
  module_tags text[] not null default '{}',
  incoming_enabled boolean not null default false,
  incoming_all_mandanten boolean not null default false,
  force_hard_reload boolean not null default false,
  ci_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (channel, version_semver)
);

create index if not exists app_releases_channel_created_idx on public.app_releases (channel, created_at desc);

create table if not exists public.release_incoming_tenants (
  release_id uuid not null references public.app_releases(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  primary key (release_id, tenant_id)
);

create index if not exists release_incoming_tenants_tenant_idx on public.release_incoming_tenants (tenant_id);

create table if not exists public.tenant_release_assignments (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null check (channel in ('main', 'kundenportal', 'arbeitszeit_portal')),
  active_release_id uuid references public.app_releases(id) on delete set null,
  previous_release_id uuid references public.app_releases(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, channel)
);

create index if not exists tenant_release_assignments_active_idx on public.tenant_release_assignments (active_release_id);

create table if not exists public.release_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  release_id uuid references public.app_releases(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  channel text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists release_audit_log_created_idx on public.release_audit_log (created_at desc);

alter table public.app_releases enable row level security;
alter table public.release_incoming_tenants enable row level security;
alter table public.tenant_release_assignments enable row level security;
alter table public.release_audit_log enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'app_releases' loop
    execute format('drop policy if exists %I on public.app_releases', r.policyname);
  end loop;
end $$;
create policy "Release managers manage app_releases" on public.app_releases for all using (public.can_manage_app_releases());

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'release_incoming_tenants' loop
    execute format('drop policy if exists %I on public.release_incoming_tenants', r.policyname);
  end loop;
end $$;
create policy "Release managers manage release_incoming_tenants" on public.release_incoming_tenants for all using (public.can_manage_app_releases());

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'tenant_release_assignments' loop
    execute format('drop policy if exists %I on public.tenant_release_assignments', r.policyname);
  end loop;
end $$;
create policy "Admins manage tenant_release_assignments" on public.tenant_release_assignments for all using (public.is_admin());

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'release_audit_log' loop
    execute format('drop policy if exists %I on public.release_audit_log', r.policyname);
  end loop;
end $$;
create policy "Release managers read release_audit_log" on public.release_audit_log for select using (public.can_manage_app_releases());
create policy "Release managers insert release_audit_log" on public.release_audit_log for insert with check (public.can_manage_app_releases());

-- ---------------------------------------------------------------------------
-- app_releases.status – Nachziehen auf bestehenden Lizenzportal-DBs (GitHub → LP)
-- ---------------------------------------------------------------------------
alter table public.app_releases add column if not exists status text;
update public.app_releases set status = 'published' where status is null;
alter table public.app_releases alter column status set default 'published';
alter table public.app_releases alter column status set not null;
do $$ begin
  alter table public.app_releases add constraint app_releases_status_check check (status in ('draft', 'published'));
exception
  when duplicate_object then null;
end $$;
create index if not exists app_releases_status_channel_idx on public.app_releases (status, channel, created_at desc);

-- ---------------------------------------------------------------------------
-- Beta-Feedback (Mandanten-Apps → Lizenzportal-Auswertung)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Roadmap-Board (Lizenzportal-Admin)
-- ---------------------------------------------------------------------------
create table if not exists public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  title text not null,
  wp_id text,
  status text not null default 'planned' check (
    status in ('idea', 'planned', 'in_progress', 'blocked', 'done')
  ),
  priority text check (priority in ('p0', 'p1', 'p2', 'p3')),
  target_channel text not null default 'all' check (
    target_channel in ('all', 'main', 'kundenportal', 'arbeitszeit_portal')
  ),
  scope text not null default 'global' check (scope in ('global', 'pilot', 'tenant')),
  beta_feedback_id uuid references public.beta_feedback(id) on delete set null,
  public_note text,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roadmap_items_status_idx on public.roadmap_items (status, created_at desc);
create index if not exists roadmap_items_priority_idx on public.roadmap_items (priority, created_at desc);
create index if not exists roadmap_items_tenant_idx on public.roadmap_items (tenant_id, created_at desc);

alter table public.roadmap_items enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'roadmap_items' loop
    execute format('drop policy if exists %I on public.roadmap_items', r.policyname);
  end loop;
end $$;

create policy "Admins read roadmap_items" on public.roadmap_items for select using (public.is_admin());
create policy "Admins insert roadmap_items" on public.roadmap_items for insert with check (public.is_admin());
create policy "Admins update roadmap_items" on public.roadmap_items for update using (public.is_admin());
create policy "Admins delete roadmap_items" on public.roadmap_items for delete using (public.is_admin());
