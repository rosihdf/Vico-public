-- -----------------------------------------------------------------------------
-- Vico Lizenzportal – Datenbank-Schema
-- -----------------------------------------------------------------------------
-- Eigenes Supabase-Projekt für Mandanten & Lizenzen.
-- Im Supabase SQL Editor ausführen (neues Projekt anlegen oder bestehendes).
-- Idempotent. Zuletzt geprüft/aufgeräumt: 2025-03
--
-- RLS: is_admin() als SECURITY DEFINER verhindert Rekursion (Policies lesen
-- profiles nicht direkt, sondern über die Funktion).
--
-- Struktur:
--   1. Profiles (Admin-Benutzer, get_my_role, Trigger Signup)
--   2. Tenants (Mandanten)
--   3. Licenses (Lizenzen pro Mandant)
--   3b. License_models (Vorlagen), FK licenses.license_model_id, Standard-Seeds
--   4. limit_exceeded_log (Grenzüberschreitungs-Meldungen)
--   5. Indizes
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

-- default_app_versions: nachträglich (bestehende Installationen)
do $$
begin
  if not exists (select 1 from public.platform_config where key = 'default_app_versions') then
    insert into public.platform_config (key, value) values ('default_app_versions', '{}'::jsonb);
  end if;
end $$;

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
-- 6. INDIZES
-- -----------------------------------------------------------------------------

create index if not exists tenants_name_idx on public.tenants (name);
create index if not exists licenses_tenant_created_idx on public.licenses (tenant_id, created_at desc);
-- license_number: Unique-Constraint erzeugt bereits einen Index
create index if not exists license_models_sort_name_idx on public.license_models (sort_order, name);
create index if not exists limit_exceeded_log_tenant_created_idx on public.limit_exceeded_log (tenant_id, created_at desc);
