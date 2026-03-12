-- =============================================================================
-- Vico Lizenzportal – Datenbank-Schema
-- Eigenes Supabase-Projekt für Mandanten & Lizenzen.
-- Im Supabase SQL Editor ausführen (neues Projekt anlegen oder bestehendes).
-- Idempotent.
--
-- RLS: is_admin() als SECURITY DEFINER verhindert Rekursion (Policies lesen
-- profiles nicht direkt, sondern über die Funktion).
-- =============================================================================
--
-- Tabellen:
--   tenants         – Mandanten (Firmen, die die App nutzen)
--   licenses        – Lizenzen pro Mandant
--   license_models  – Lizenzmodelle (Vorlagen für Lizenzen)
--   profiles        – Admin-Benutzer (Lizenzportal)
--   limit_exceeded_log – Meldungen bei Grenzüberschreitung
--

-- =============================================================================
-- 1. PROFILES (Admin-Benutzer für Lizenzportal)
-- =============================================================================

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

-- =============================================================================
-- 2. TENANTS (Mandanten)
-- =============================================================================

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  app_domain text,
  portal_domain text,
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tenants enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'tenants' loop
    execute format('drop policy if exists %I on public.tenants', r.policyname);
  end loop;
end $$;
create policy "Admins can manage tenants" on public.tenants for all using (public.is_admin());

-- =============================================================================
-- 3. LICENSES (Lizenzen pro Mandant)
-- =============================================================================

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  license_number text not null unique,
  tier text default 'professional' check (tier in ('free', 'professional', 'enterprise')),
  valid_until date,
  max_users int,
  max_customers int,
  check_interval text default 'daily' check (check_interval in ('on_start', 'daily', 'weekly')),
  features jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.licenses enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'licenses' loop
    execute format('drop policy if exists %I on public.licenses', r.policyname);
  end loop;
end $$;
create policy "Admins can manage licenses" on public.licenses for all using (public.is_admin());

-- Hinweis: Eindeutigkeit „eine aktive Lizenz pro Mandant“ ggf. per Trigger/App-Logik prüfen.
-- Partieller Index mit current_date nicht möglich (current_date ist STABLE, Index-Prädikat braucht IMMUTABLE).

-- =============================================================================
-- 3b. LICENSE_MODELS (Lizenzmodelle – Vorlagen für Lizenzen)
-- =============================================================================

create table if not exists public.license_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text default 'professional' check (tier in ('free', 'professional', 'enterprise')),
  max_users int,
  max_customers int,
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

-- Standard-Lizenzmodelle (nur wenn Tabelle leer)
do $$
begin
  if not exists (select 1 from public.license_models limit 1) then
    insert into public.license_models (name, tier, max_users, max_customers, check_interval, features, sort_order)
    values
      ('Free', 'free', 2, 5, 'daily', '{"kundenportal": false, "historie": false, "arbeitszeiterfassung": false}'::jsonb, 1),
      ('Professional', 'professional', 10, 50, 'daily', '{"kundenportal": true, "historie": true, "arbeitszeiterfassung": true}'::jsonb, 2),
      ('Enterprise', 'enterprise', null, null, 'weekly', '{"kundenportal": true, "historie": true, "arbeitszeiterfassung": true}'::jsonb, 3);
  end if;
end $$;

-- =============================================================================
-- 4. LIMIT_EXCEEDED_LOG (Grenzüberschreitung-Meldungen)
-- =============================================================================

create table if not exists public.limit_exceeded_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  license_id uuid references public.licenses(id) on delete set null,
  limit_type text not null,
  current_value int not null,
  max_value int not null,
  license_number text,
  created_at timestamptz default now()
);

alter table public.limit_exceeded_log enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'limit_exceeded_log' loop
    execute format('drop policy if exists %I on public.limit_exceeded_log', r.policyname);
  end loop;
end $$;
create policy "Admins can read limit_exceeded_log" on public.limit_exceeded_log for select using (public.is_admin());

create policy "Service role can insert limit_exceeded_log" on public.limit_exceeded_log for insert with check (true);

create index if not exists limit_exceeded_log_tenant_created_idx on public.limit_exceeded_log (tenant_id, created_at desc);
