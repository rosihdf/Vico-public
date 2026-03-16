-- =============================================================================
-- Vico – Datenbank-Schema (vollständig)
-- Supabase SQL Editor: Inhalt einfügen und Run ausführen. Idempotent.
-- Zuletzt geprüft/aufgeräumt: 2025-03
-- =============================================================================
--
-- Struktur:
--   1. Profiles + Rollen (admin, mitarbeiter, operator, leser, demo, kunde)
--   2. Stammdaten: Customers, BVs, Objects, Object Photos/Documents, maintenance_contracts;
--      customer_portal_users (für Trigger handle_new_user)
--   3. Wartung: Maintenance Reports, Photos, Smoke Detectors
--   4. Aufträge, Zeit, Component Settings, Audit Log + Audit-Trigger (nur für zu dem Zeitpunkt existierende Tabellen)
--   5. RPC: get_my_role, get_all_profiles_for_admin, get_audit_log, get_audit_log_detail,
--      get_maintenance_reminders, search_entities, resolve_object_to_navigation, cleanup_demo
--   5b. Lizenzmodell: license, get_license_status, check_can_create_customer, check_can_invite_user
--   6. Kundenportal: customer_portal_users RLS, portal_user_object_visibility, Portal-Helfer, get_portal_*
--   7. Storage Buckets + Policies
--   8. Indizes (Stammdaten, Wartung, Aufträge, Lizenz, Audit, Kundenportal), Realtime

-- =============================================================================
-- 1. PROFILES & ROLLEN
-- =============================================================================

create table if not exists public.profiles (
  id uuid references auth.users(id) primary key,
  email text,
  first_name text,
  last_name text,
  role text default 'mitarbeiter',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists soll_minutes_per_month int default null;
alter table public.profiles add column if not exists soll_minutes_per_week int default null;
alter table public.profiles enable row level security;

do $$
begin
  alter table public.profiles drop constraint if exists profiles_role_check;
exception when others then null;
end $$;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'teamleiter', 'mitarbeiter', 'operator', 'leser', 'demo', 'kunde'));
alter table public.profiles add column if not exists team_id uuid default null;
alter table public.profiles add column if not exists gps_consent_at timestamptz default null;
alter table public.profiles add column if not exists gps_consent_revoked_at timestamptz default null;

-- Rollen-Helper (SECURITY DEFINER, keine RLS-Rekursion)
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.is_leser()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'leser');
$$;
create or replace function public.is_operator()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'operator');
$$;
create or replace function public.can_write_master_data()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'mitarbeiter'));
$$;
create or replace function public.is_demo()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'demo');
$$;
create or replace function public.is_portal_customer()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'kunde');
$$;
create or replace function public.is_teamleiter()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teamleiter');
$$;
create or replace function public.get_my_team_id()
returns uuid language sql security definer set search_path = public stable as $$
  select team_id from public.profiles where id = auth.uid() limit 1;
$$;
grant execute on function public.is_teamleiter() to authenticated, anon;
grant execute on function public.get_my_team_id() to authenticated, anon;
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_demo() to authenticated, anon;
grant execute on function public.is_leser() to authenticated, anon;
grant execute on function public.is_operator() to authenticated, anon;
grant execute on function public.is_portal_customer() to authenticated, anon;
grant execute on function public.can_write_master_data() to authenticated, anon;

-- Profiles RLS
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy if exists %I on public.profiles', r.policyname);
  end loop;
end $$;
create policy "User can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "User can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Admins can read all profiles" on public.profiles for select using (public.is_admin());
create policy "Admins can update profile roles" on public.profiles for update using (public.is_admin());
create policy "Authenticated users can read profiles for assignment" on public.profiles for select using (auth.uid() is not null);

-- Trigger: Mindestens ein Admin
create or replace function public.ensure_at_least_one_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (new.role is null or new.role != 'admin') then
    if (select count(*) from public.profiles where role = 'admin' and id != old.id) = 0 then
      raise exception 'Es muss mindestens ein Admin vorhanden sein.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists ensure_at_least_one_admin on public.profiles;
create trigger ensure_at_least_one_admin before update of role on public.profiles
  for each row execute function public.ensure_at_least_one_admin();

-- Teams (für Teamleiter-Zuordnung: Teamleiter und Mitarbeiter erhalten team_id)
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.teams enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'teams' loop
    execute format('drop policy if exists %I on public.teams', r.policyname);
  end loop;
end $$;
create policy "Admins can manage teams" on public.teams for all using (public.is_admin());
create policy "Authenticated can read teams" on public.teams for select using (auth.uid() is not null);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and table_name = 'profiles' and constraint_name = 'profiles_team_id_fkey'
  ) then
    alter table public.profiles add constraint profiles_team_id_fkey
      foreign key (team_id) references public.teams(id) on delete set null;
  end if;
end $$;

-- =============================================================================
-- 2. STAMMDATEN
-- =============================================================================

-- 2.1 Customers
create table if not exists public.customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  street text, house_number text, postal_code text, city text,
  email text, phone text, contact_name text, contact_email text, contact_phone text,
  maintenance_report_email boolean default true, maintenance_report_email_address text,
  demo_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.customers add column if not exists house_number text;
alter table public.customers add column if not exists demo_user_id uuid references auth.users(id) on delete cascade;
alter table public.customers enable row level security;

-- Kundenportal-Tabelle: hier anlegen, da handle_new_user (Trigger auth.users) darauf zugreift.
-- RLS, Unique-Constraint, Policies und Portal-RPCs folgen in Sektion 6.
create table if not exists public.customer_portal_users (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  email text not null,
  user_id uuid references auth.users(id) on delete cascade,
  invited_by uuid references public.profiles(id),
  invited_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Trigger: Neuer User → Profile anlegen (nach customer_portal_users, da darauf zugegriffen wird)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_portal boolean;
begin
  is_portal := exists (select 1 from public.customer_portal_users where email = new.email);
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case
      when (select count(*) from public.profiles) = 0 then 'admin'
      when is_portal then 'kunde'
      else 'mitarbeiter'
    end
  );
  if is_portal then
    update public.customer_portal_users set user_id = new.id where email = new.email and user_id is null;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_demo_user_on_customer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_demo() then
    new.demo_user_id := auth.uid();
  end if;
  return new;
end;
$$;
drop trigger if exists set_demo_user_on_customer on public.customers;
create trigger set_demo_user_on_customer before insert on public.customers
  for each row execute function public.set_demo_user_on_customer();

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'customers' loop
    execute format('drop policy if exists %I on public.customers', r.policyname);
  end loop;
end $$;
create policy "Read customers" on public.customers for select using (
  auth.uid() is not null and (
    (demo_user_id is null and not public.is_demo() and not public.is_portal_customer())
    or (public.is_demo() and demo_user_id = auth.uid())
    or (public.is_portal_customer() and id in (select customer_id from public.customer_portal_users where user_id = auth.uid()))
  )
);
create policy "Insert customers" on public.customers for insert with check (
  auth.uid() is not null and (public.can_write_master_data() or public.is_demo())
);
create policy "Update customers" on public.customers for update using (
  auth.uid() is not null and (
    (public.can_write_master_data() and (demo_user_id is null or public.is_admin()))
    or (public.is_demo() and demo_user_id = auth.uid())
  )
);
create policy "Delete customers" on public.customers for delete using (
  auth.uid() is not null and (public.is_admin() or (public.is_demo() and demo_user_id = auth.uid()))
);

create or replace function public.customer_visible_to_user(cid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.customers c where c.id = cid and auth.uid() is not null
    and (
      (not public.is_demo() and not public.is_portal_customer() and c.demo_user_id is null)
      or (public.is_demo() and c.demo_user_id = auth.uid())
      or (public.is_portal_customer() and c.id in (select customer_id from public.customer_portal_users where user_id = auth.uid()))
    )
  );
$$;
grant execute on function public.customer_visible_to_user(uuid) to authenticated;

create or replace function public.bv_customer_visible(bid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.customer_visible_to_user((select customer_id from public.bvs where id = bid));
$$;
grant execute on function public.bv_customer_visible(uuid) to authenticated;

-- 2.2 BVs
create table if not exists public.bvs (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  name text not null,
  street text, house_number text, postal_code text, city text,
  email text, phone text, contact_name text, contact_email text, contact_phone text,
  maintenance_report_email boolean default true, maintenance_report_email_address text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.bvs add column if not exists house_number text;
alter table public.bvs enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'bvs' loop
    execute format('drop policy if exists %I on public.bvs', r.policyname);
  end loop;
end $$;
create policy "Read bvs" on public.bvs for select using (auth.uid() is not null and public.customer_visible_to_user(customer_id));
create policy "Insert bvs" on public.bvs for insert with check (auth.uid() is not null and (public.can_write_master_data() or public.customer_visible_to_user(customer_id)));
create policy "Update bvs" on public.bvs for update using (auth.uid() is not null and (public.can_write_master_data() or public.customer_visible_to_user(customer_id)));
create policy "Delete bvs" on public.bvs for delete using (auth.uid() is not null and (public.is_admin() or (public.is_demo() and public.customer_visible_to_user(customer_id))));

-- 2.3 Objects (bv_id optional: Tür/Tor direkt unter Kunde wenn customer_id gesetzt)
create table if not exists public.objects (
  id uuid default gen_random_uuid() primary key,
  bv_id uuid references public.bvs(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  name text, internal_id text unique, door_position text, internal_door_number text, floor text, room text,
  type_tuer boolean default false, type_sektionaltor boolean default false, type_schiebetor boolean default false, type_freitext text,
  wing_count int, manufacturer text, build_year text, lock_manufacturer text, lock_type text,
  has_hold_open boolean default false, hold_open_manufacturer text, hold_open_type text, hold_open_approval_no text, hold_open_approval_date text,
  smoke_detector_count int default 0, smoke_detector_build_years jsonb default '[]'::jsonb,
  panic_function text, accessories text, maintenance_by_manufacturer boolean default false, hold_open_maintenance boolean default false,
  defects text, remarks text, maintenance_interval_months int,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint objects_bv_or_customer check (bv_id is not null or customer_id is not null)
);
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'customer_id') then
    alter table public.objects add column customer_id uuid references public.customers(id) on delete cascade;
  end if;
  alter table public.objects drop constraint if exists objects_bv_id_not_null;
  alter table public.objects alter column bv_id drop not null;
  if not exists (select 1 from pg_constraint where conname = 'objects_bv_or_customer') then
    alter table public.objects add constraint objects_bv_or_customer check (bv_id is not null or customer_id is not null);
  end if;
exception when others then null;
end $$;
alter table public.objects add column if not exists name text;
alter table public.objects add column if not exists smoke_detector_build_years jsonb default '[]'::jsonb;
alter table public.objects add column if not exists maintenance_interval_months int;
alter table public.objects enable row level security;

create or replace function public.object_visible_to_user(o_bv_id uuid, o_customer_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select auth.uid() is not null and (
    (o_bv_id is not null and public.bv_customer_visible(o_bv_id))
    or (o_customer_id is not null and public.customer_visible_to_user(o_customer_id))
  );
$$;
grant execute on function public.object_visible_to_user(uuid, uuid) to authenticated;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'objects' loop
    execute format('drop policy if exists %I on public.objects', r.policyname);
  end loop;
end $$;
create policy "Read objects" on public.objects for select using (public.object_visible_to_user(bv_id, customer_id));
create policy "Insert objects" on public.objects for insert with check (auth.uid() is not null and (public.can_write_master_data() or public.object_visible_to_user(bv_id, customer_id)));
create policy "Update objects" on public.objects for update using (auth.uid() is not null and (public.can_write_master_data() or public.object_visible_to_user(bv_id, customer_id)));
create policy "Delete objects" on public.objects for delete using (auth.uid() is not null and (public.is_admin() or (public.is_demo() and public.object_visible_to_user(bv_id, customer_id))));

-- 2.4 Object Photos
create table if not exists public.object_photos (
  id uuid default gen_random_uuid() primary key,
  object_id uuid references public.objects(id) on delete cascade not null,
  storage_path text not null, caption text,
  created_at timestamptz default now()
);
alter table public.object_photos enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'object_photos' loop
    execute format('drop policy if exists %I on public.object_photos', r.policyname);
  end loop;
end $$;
create policy "Authenticated users can read object_photos" on public.object_photos for select using (auth.uid() is not null);
create policy "Mitarbeiter/Admin can insert object_photos" on public.object_photos for insert with check (auth.uid() is not null and public.can_write_master_data());
create policy "Mitarbeiter/Admin can update object_photos" on public.object_photos for update using (auth.uid() is not null and public.can_write_master_data());
create policy "Admin can delete object_photos" on public.object_photos for delete using (auth.uid() is not null and public.is_admin());

-- 2.5 Object Documents (Zeichnungen, Zertifikate)
create table if not exists public.object_documents (
  id uuid default gen_random_uuid() primary key,
  object_id uuid references public.objects(id) on delete cascade not null,
  storage_path text not null,
  document_type text not null check (document_type in ('zeichnung', 'zertifikat', 'sonstiges')),
  title text,
  file_name text,
  created_at timestamptz default now()
);
alter table public.object_documents enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'object_documents' loop
    execute format('drop policy if exists %I on public.object_documents', r.policyname);
  end loop;
end $$;
create policy "Authenticated users can read object_documents" on public.object_documents for select using (auth.uid() is not null);
create policy "Mitarbeiter/Admin can insert object_documents" on public.object_documents for insert with check (auth.uid() is not null and public.can_write_master_data());
create policy "Mitarbeiter/Admin can update object_documents" on public.object_documents for update using (auth.uid() is not null and public.can_write_master_data());
create policy "Admin can delete object_documents" on public.object_documents for delete using (auth.uid() is not null and public.is_admin());

-- 2.6 Wartungsverträge (unter Kunde oder unter Objekt/BV)
create table if not exists public.maintenance_contracts (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade,
  bv_id uuid references public.bvs(id) on delete cascade,
  contract_number text not null,
  start_date date not null,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint maintenance_contracts_customer_or_bv check (customer_id is not null or bv_id is not null)
);
alter table public.maintenance_contracts enable row level security;

create or replace function public.maintenance_contract_visible_to_user(c_customer_id uuid, c_bv_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select auth.uid() is not null and (
    (c_customer_id is not null and public.customer_visible_to_user(c_customer_id))
    or (c_bv_id is not null and public.bv_customer_visible(c_bv_id))
  );
$$;
grant execute on function public.maintenance_contract_visible_to_user(uuid, uuid) to authenticated;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'maintenance_contracts' loop
    execute format('drop policy if exists %I on public.maintenance_contracts', r.policyname);
  end loop;
end $$;
create policy "Read maintenance_contracts" on public.maintenance_contracts for select using (public.maintenance_contract_visible_to_user(customer_id, bv_id));
create policy "Insert maintenance_contracts" on public.maintenance_contracts for insert with check (auth.uid() is not null and (public.can_write_master_data() or public.maintenance_contract_visible_to_user(customer_id, bv_id)));
create policy "Update maintenance_contracts" on public.maintenance_contracts for update using (auth.uid() is not null and (public.can_write_master_data() or public.maintenance_contract_visible_to_user(customer_id, bv_id)));
create policy "Delete maintenance_contracts" on public.maintenance_contracts for delete using (auth.uid() is not null and (public.is_admin() or (public.is_demo() and public.maintenance_contract_visible_to_user(customer_id, bv_id))));

-- =============================================================================
-- 3. WARTUNGSPROTOKOLLE
-- =============================================================================

create table if not exists public.maintenance_reports (
  id uuid default gen_random_uuid() primary key,
  object_id uuid references public.objects(id) on delete cascade not null,
  maintenance_date date not null, maintenance_time text, technician_id uuid references public.profiles(id),
  reason text check (reason in ('regelwartung', 'reparatur', 'nachpruefung', 'sonstiges')), reason_other text,
  manufacturer_maintenance_done boolean default false, hold_open_checked boolean,
  deficiencies_found boolean default false, deficiency_description text,
  urgency text check (urgency in ('niedrig', 'mittel', 'hoch')), fixed_immediately boolean default false,
  customer_signature_path text, technician_signature_path text, technician_name_printed text, customer_name_printed text,
  pdf_path text, synced boolean default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.maintenance_reports enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'maintenance_reports' loop
    execute format('drop policy if exists %I on public.maintenance_reports', r.policyname);
  end loop;
end $$;
create policy "Authenticated users can read maintenance_reports" on public.maintenance_reports for select using (auth.uid() is not null);
create policy "Non-leser can insert maintenance_reports" on public.maintenance_reports for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can update maintenance_reports" on public.maintenance_reports for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can delete maintenance_reports" on public.maintenance_reports for delete using (auth.uid() is not null and not public.is_leser());

create table if not exists public.maintenance_report_photos (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.maintenance_reports(id) on delete cascade not null,
  storage_path text, caption text, created_at timestamptz default now()
);
alter table public.maintenance_report_photos enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'maintenance_report_photos' loop
    execute format('drop policy if exists %I on public.maintenance_report_photos', r.policyname);
  end loop;
end $$;
create policy "Authenticated users can read maintenance_report_photos" on public.maintenance_report_photos for select using (auth.uid() is not null);
create policy "Non-leser can insert maintenance_report_photos" on public.maintenance_report_photos for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can update maintenance_report_photos" on public.maintenance_report_photos for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can delete maintenance_report_photos" on public.maintenance_report_photos for delete using (auth.uid() is not null and not public.is_leser());

create table if not exists public.maintenance_report_smoke_detectors (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.maintenance_reports(id) on delete cascade not null,
  smoke_detector_label text not null, status text not null check (status in ('ok', 'defekt', 'ersetzt')),
  created_at timestamptz default now()
);
alter table public.maintenance_report_smoke_detectors enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'maintenance_report_smoke_detectors' loop
    execute format('drop policy if exists %I on public.maintenance_report_smoke_detectors', r.policyname);
  end loop;
end $$;
create policy "Authenticated users can read maintenance_report_smoke_detectors" on public.maintenance_report_smoke_detectors for select using (auth.uid() is not null);
create policy "Non-leser can insert maintenance_report_smoke_detectors" on public.maintenance_report_smoke_detectors for insert with check (auth.uid() is not null and not public.is_leser());

-- =============================================================================
-- 4. AUFTRÄGE, SETTINGS, AUDIT
-- =============================================================================

create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  bv_id uuid references public.bvs(id) on delete cascade not null,
  object_id uuid references public.objects(id) on delete set null,
  order_date date not null,
  order_type text not null check (order_type in ('wartung', 'reparatur', 'montage', 'sonstiges')),
  status text not null default 'offen' check (status in ('offen', 'in_bearbeitung', 'erledigt', 'storniert')),
  description text, assigned_to uuid references public.profiles(id), created_by uuid references public.profiles(id),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_time') then
    alter table public.orders add column order_time time;
  end if;
end $$;
alter table public.orders enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'orders' loop
    execute format('drop policy if exists %I on public.orders', r.policyname);
  end loop;
end $$;
create policy "Authenticated users can read orders" on public.orders for select using (auth.uid() is not null);
create policy "Mitarbeiter/Admin can insert orders" on public.orders for insert with check (auth.uid() is not null and public.can_write_master_data());
create policy "Mitarbeiter/Admin can update orders" on public.orders for update using (auth.uid() is not null and public.can_write_master_data());
create policy "Mitarbeiter/Admin can delete orders" on public.orders for delete using (auth.uid() is not null and public.can_write_master_data());

-- Demo- und Portal-Benutzer dürfen keinen Aufträgen zugewiesen werden
drop function if exists public.check_order_assigned_to_not_demo() cascade;
create or replace function public.check_order_assigned_to_valid_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_role text;
begin
  if new.assigned_to is null then return new; end if;
  select role into target_role from public.profiles where id = new.assigned_to limit 1;
  if target_role = 'demo' then
    raise exception 'Demo-Benutzer können keinen Aufträgen zugewiesen werden.';
  end if;
  if target_role = 'kunde' then
    raise exception 'Portal-Benutzer können keinen Aufträgen zugewiesen werden.';
  end if;
  return new;
end;
$$;
drop trigger if exists check_order_assigned_to_not_demo on public.orders;
drop trigger if exists check_order_assigned_to_valid_role on public.orders;
create trigger check_order_assigned_to_valid_role
  before insert or update of assigned_to on public.orders
  for each row execute function public.check_order_assigned_to_valid_role();

-- Monteursbericht / Auftragsabarbeitung (1:1 pro Auftrag)
create table if not exists public.order_completions (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null unique,
  ausgeführte_arbeiten text,
  material text,
  arbeitszeit_minuten integer,
  unterschrift_mitarbeiter_path text,
  unterschrift_mitarbeiter_name text,
  unterschrift_mitarbeiter_date timestamptz,
  unterschrift_kunde_path text,
  unterschrift_kunde_name text,
  unterschrift_kunde_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.order_completions enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'order_completions' loop
    execute format('drop policy if exists %I on public.order_completions', r.policyname);
  end loop;
end $$;
create policy "Authenticated users can read order_completions" on public.order_completions for select using (auth.uid() is not null);
create policy "Mitarbeiter/Admin can insert order_completions" on public.order_completions for insert with check (auth.uid() is not null and public.can_write_master_data());
create policy "Mitarbeiter/Admin can update order_completions" on public.order_completions for update using (auth.uid() is not null and public.can_write_master_data());
create policy "Mitarbeiter/Admin can delete order_completions" on public.order_completions for delete using (auth.uid() is not null and public.can_write_master_data());

-- Arbeitszeiterfassung
create table if not exists public.time_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  start timestamptz not null,
  "end" timestamptz,
  notes text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.time_entries add column if not exists location_start_lat double precision default null;
alter table public.time_entries add column if not exists location_start_lon double precision default null;
alter table public.time_entries add column if not exists location_end_lat double precision default null;
alter table public.time_entries add column if not exists location_end_lon double precision default null;
alter table public.time_entries enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'time_entries' loop
    execute format('drop policy if exists %I on public.time_entries', r.policyname);
  end loop;
end $$;
create policy "User can read own time_entries" on public.time_entries for select using (auth.uid() = user_id);
create policy "Admin can read all time_entries" on public.time_entries for select using (public.is_admin());
create policy "Teamleiter can read time_entries of team" on public.time_entries for select using (
  public.is_teamleiter() and user_id in (
    select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null
  )
);
create policy "User can insert own time_entries" on public.time_entries for insert with check (auth.uid() = user_id);
create policy "Admin can update time_entries" on public.time_entries for update using (public.is_admin());
create policy "Teamleiter can update time_entries of team" on public.time_entries for update using (
  public.is_teamleiter() and user_id in (
    select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null
  )
);

create table if not exists public.time_breaks (
  id uuid default gen_random_uuid() primary key,
  time_entry_id uuid references public.time_entries(id) on delete cascade not null,
  start timestamptz not null,
  "end" timestamptz,
  created_at timestamptz default now()
);
alter table public.time_breaks enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'time_breaks' loop
    execute format('drop policy if exists %I on public.time_breaks', r.policyname);
  end loop;
end $$;
create policy "User can read own time_breaks" on public.time_breaks for select using (
  exists (select 1 from public.time_entries te where te.id = time_entry_id and te.user_id = auth.uid())
);
create policy "Admin can read all time_breaks" on public.time_breaks for select using (public.is_admin());
create policy "Teamleiter can read time_breaks of team" on public.time_breaks for select using (
  public.is_teamleiter() and exists (
    select 1 from public.time_entries te
    join public.profiles p on p.id = te.user_id and p.team_id = public.get_my_team_id() and p.team_id is not null
    where te.id = time_entry_id
  )
);
create policy "User can insert time_breaks" on public.time_breaks for insert with check (
  exists (select 1 from public.time_entries te where te.id = time_entry_id and te.user_id = auth.uid())
);
create policy "User can update own time_breaks" on public.time_breaks for update using (
  exists (select 1 from public.time_entries te where te.id = time_entry_id and te.user_id = auth.uid())
);

-- Zeiterfassung: Log für Admin-/Teamleiter-Bearbeitungen (Phase 2)
create table if not exists public.time_entry_edit_log (
  id uuid default gen_random_uuid() primary key,
  time_entry_id uuid references public.time_entries(id) on delete cascade not null,
  edited_by uuid references public.profiles(id) on delete set null not null,
  edited_at timestamptz default now(),
  reason text not null,
  reason_code text,
  old_start timestamptz not null,
  old_end timestamptz,
  new_start timestamptz not null,
  new_end timestamptz
);
alter table public.time_entry_edit_log enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'time_entry_edit_log' loop
    execute format('drop policy if exists %I on public.time_entry_edit_log', r.policyname);
  end loop;
end $$;
create policy "Admin can read time_entry_edit_log" on public.time_entry_edit_log for select using (public.is_admin());
create policy "Teamleiter can read time_entry_edit_log of team" on public.time_entry_edit_log for select using (
  public.is_teamleiter() and exists (
    select 1 from public.time_entries te
    join public.profiles p on p.id = te.user_id and p.team_id = public.get_my_team_id() and p.team_id is not null
    where te.id = time_entry_id
  )
);
create policy "User can read own time_entry_edit_log" on public.time_entry_edit_log for select using (
  exists (select 1 from public.time_entries te where te.id = time_entry_id and te.user_id = auth.uid())
);
create policy "Admin can insert time_entry_edit_log" on public.time_entry_edit_log for insert with check (public.is_admin());
create policy "Teamleiter can insert time_entry_edit_log for team" on public.time_entry_edit_log for insert with check (
  public.is_teamleiter() and exists (
    select 1 from public.time_entries te
    join public.profiles p on p.id = te.user_id and p.team_id = public.get_my_team_id() and p.team_id is not null
    where te.id = time_entry_id
  )
);

-- RPC: Admin aktualisiert time_entry und schreibt Eintrag in time_entry_edit_log (eine Transaktion). order_id optional.
create or replace function public.update_time_entry_admin(
  p_entry_id uuid,
  p_new_start timestamptz,
  p_new_end timestamptz,
  p_reason text,
  p_reason_code text default 'korrektur',
  p_order_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_start timestamptz;
  v_old_end timestamptz;
  v_user_id uuid;
begin
  if not public.is_admin() and not (
    public.is_teamleiter() and exists (
      select 1 from public.time_entries te
      join public.profiles p on p.id = te.user_id and p.team_id = public.get_my_team_id() and p.team_id is not null
      where te.id = p_entry_id
    )
  ) then
    raise exception 'Nur Admin oder Teamleiter (eigenes Team) darf Zeiteinträge bearbeiten';
  end if;
  select te.start, te."end", te.user_id into v_old_start, v_old_end, v_user_id
  from public.time_entries te where te.id = p_entry_id;
  if v_old_start is null then
    raise exception 'Zeiteintrag nicht gefunden';
  end if;
  update public.time_entries
  set start = p_new_start, "end" = p_new_end, order_id = p_order_id, updated_at = now()
  where id = p_entry_id;
  insert into public.time_entry_edit_log (time_entry_id, edited_by, reason, reason_code, old_start, old_end, new_start, new_end)
  values (p_entry_id, auth.uid(), coalesce(nullif(trim(p_reason), ''), 'Kein Grund angegeben'), p_reason_code, v_old_start, v_old_end, p_new_start, p_new_end);
end;
$$;
grant execute on function public.update_time_entry_admin(uuid, timestamptz, timestamptz, text, text, uuid) to authenticated;

-- RPC: Zeiterfassungs-Bearbeitungslog (Admin: alle, User: nur eigene Einträge). Filter optional.
create or replace function public.get_time_entry_edit_log(
  p_limit int default 100,
  p_offset int default 0,
  p_date_from date default null,
  p_date_to date default null,
  p_entry_user_id uuid default null
)
returns table (
  id uuid,
  time_entry_id uuid,
  edited_by uuid,
  edited_at timestamptz,
  reason text,
  reason_code text,
  old_start timestamptz,
  old_end timestamptz,
  new_start timestamptz,
  new_end timestamptz,
  entry_user_id uuid,
  entry_date date,
  editor_display_name text
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.time_entry_id,
    l.edited_by,
    l.edited_at,
    l.reason,
    l.reason_code,
    l.old_start,
    l.old_end,
    l.new_start,
    l.new_end,
    te.user_id as entry_user_id,
    te.date as entry_date,
    coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), p.email, l.edited_by::text) as editor_display_name
  from public.time_entry_edit_log l
  join public.time_entries te on te.id = l.time_entry_id
  left join public.profiles p on p.id = l.edited_by
  where (public.is_admin() or (public.is_teamleiter() and te.user_id in (select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null)) or te.user_id = auth.uid())
    and (p_date_from is null or te.date >= p_date_from)
    and (p_date_to is null or te.date <= p_date_to)
    and (p_entry_user_id is null or (public.is_admin() and te.user_id = p_entry_user_id) or (public.is_teamleiter() and te.user_id = p_entry_user_id and p_entry_user_id in (select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null)))
  order by l.edited_at desc
  limit greatest(1, least(p_limit, 500))
  offset greatest(0, p_offset);
$$;
grant execute on function public.get_time_entry_edit_log(int, int, date, date, uuid) to authenticated;

-- RPC: User-IDs, die der aktuelle User für Zeiterfassung sehen darf (Admin: alle mit Rolle; Teamleiter: gleiches Team).
create or replace function public.get_zeiterfassung_visible_user_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.id from public.profiles p
  where p.role in ('admin', 'teamleiter', 'mitarbeiter', 'operator', 'leser')
  and (public.is_admin() or (public.is_teamleiter() and p.team_id = public.get_my_team_id() and p.team_id is not null));
$$;
grant execute on function public.get_zeiterfassung_visible_user_ids() to authenticated;

-- Bug-Erfassungsmodul: automatisch erfasste Fehler (onerror, unhandledrejection, ErrorBoundary)
create table if not exists public.app_errors (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  source text not null check (source in ('main_app', 'portal', 'admin', 'zeiterfassung', 'arbeitszeit_portal')),
  message text not null,
  stack text,
  path text,
  user_agent text,
  created_at timestamptz default now(),
  status text not null default 'new' check (status in ('new', 'acknowledged', 'resolved')),
  fingerprint text
);
alter table public.app_errors enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'app_errors' loop
    execute format('drop policy if exists %I on public.app_errors', r.policyname);
  end loop;
end $$;
create policy "Authenticated can insert app_errors" on public.app_errors for insert with check (auth.uid() is not null);
create policy "Admins can read app_errors" on public.app_errors for select using (public.is_admin());
create policy "Admins can update app_errors" on public.app_errors for update using (public.is_admin());
create policy "Admins can delete app_errors" on public.app_errors for delete using (public.is_admin());

create or replace function public.report_app_error(
  p_message text,
  p_stack text default null,
  p_path text default null,
  p_source text default 'main_app',
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_message is null or trim(p_message) = '' then
    return;
  end if;
  insert into public.app_errors (user_id, source, message, stack, path, user_agent)
  values (
    auth.uid(),
    case when p_source in ('main_app', 'portal', 'admin', 'zeiterfassung', 'arbeitszeit_portal') then p_source else 'main_app' end,
    left(trim(p_message), 2000),
    left(p_stack, 8000),
    left(p_path, 2000),
    left(p_user_agent, 500)
  );
end;
$$;
grant execute on function public.report_app_error(text, text, text, text, text) to authenticated;

create table if not exists public.component_settings (
  id uuid default gen_random_uuid() primary key,
  component_key text unique not null, label text not null, enabled boolean default true, sort_order int default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.component_settings enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'component_settings' loop
    execute format('drop policy if exists %I on public.component_settings', r.policyname);
  end loop;
end $$;
create policy "Authenticated users can read component_settings" on public.component_settings for select using (auth.uid() is not null);
create policy "Authenticated users can manage component_settings" on public.component_settings for all using (auth.uid() is not null);

create table if not exists public.audit_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id), action text not null, table_name text not null, record_id text,
  created_at timestamptz default now()
);
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_log' and column_name = 'record_id') then
    alter table public.audit_log alter column record_id type text using record_id::text;
  end if;
exception when others then null;
end $$;
alter table public.audit_log enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'audit_log' loop
    execute format('drop policy if exists %I on public.audit_log', r.policyname);
  end loop;
end $$;
create policy "Admins can read audit_log" on public.audit_log for select using (public.is_admin());

-- Audit-Trigger für alle Tabellen, die zu diesem Zeitpunkt existieren.
-- Tabellen die später angelegt werden (portal_user_object_visibility) erhalten ihren Trigger an ihrer Definition.
create or replace function public.audit_trigger_fn()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (user_id, action, table_name, record_id)
  values (auth.uid(),
    case tg_op when 'INSERT' then 'insert' when 'UPDATE' then 'update' when 'DELETE' then 'delete' end,
    tg_table_name,
    coalesce((case tg_op when 'DELETE' then old else new end).id::text, ''));
  return coalesce(new, old);
end;
$$;
do $$
declare t text;
  tbls text[] := array['customers','bvs','objects','object_photos','object_documents','maintenance_contracts','orders','order_completions','time_entries','time_breaks','profiles','maintenance_reports','maintenance_report_photos','maintenance_report_smoke_detectors','customer_portal_users','portal_user_object_visibility'];
begin
  foreach t in array tbls loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('drop trigger if exists audit_%I on public.%I', t, t);
      execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_trigger_fn()', t, t);
    end if;
  end loop;
end $$;

-- =============================================================================
-- 5. RPC FUNCTIONS
-- =============================================================================

create or replace function public.get_my_role()
returns text language sql security definer set search_path = public stable as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;
grant execute on function public.get_my_role() to authenticated;

drop function if exists public.get_all_profiles_for_admin();
create or replace function public.get_all_profiles_for_admin()
returns table (id uuid, email text, first_name text, last_name text, role text, soll_minutes_per_month int, soll_minutes_per_week int, team_id uuid, team_name text)
language sql security definer set search_path = public stable as $$
  select p.id, p.email, p.first_name, p.last_name, p.role, p.soll_minutes_per_month, p.soll_minutes_per_week, p.team_id, t.name as team_name
  from public.profiles p
  left join public.teams t on t.id = p.team_id
  where auth.uid() is not null
  order by p.email nulls last;
$$;
grant execute on function public.get_all_profiles_for_admin() to authenticated;

-- Für Arbeitszeitenportal: nur Profile, die der User sehen darf (Admin: alle mit Zeiterfassung-Rollen, Teamleiter: gleiches Team).
create or replace function public.get_profiles_for_zeiterfassung()
returns table (id uuid, email text, first_name text, last_name text, role text, soll_minutes_per_month int, soll_minutes_per_week int)
language sql security definer set search_path = public stable as $$
  select p.id, p.email, p.first_name, p.last_name, p.role, p.soll_minutes_per_month, p.soll_minutes_per_week
  from public.profiles p
  where p.role in ('admin', 'teamleiter', 'mitarbeiter', 'operator', 'leser')
  and (public.is_admin() or (public.is_teamleiter() and p.team_id = public.get_my_team_id() and p.team_id is not null))
  order by p.email nulls last;
$$;
grant execute on function public.get_profiles_for_zeiterfassung() to authenticated;

create or replace function public.get_audit_log(limit_rows int default 200, offset_rows int default 0)
returns table (id uuid, user_id uuid, user_email text, action text, table_name text, record_id text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select al.id, al.user_id, p.email as user_email, al.action, al.table_name, al.record_id, al.created_at
  from public.audit_log al left join public.profiles p on p.id = al.user_id
  where public.is_admin()
  order by al.created_at desc
  limit nullif(least(limit_rows, 1000), 0)
  offset greatest(offset_rows, 0);
$$;
grant execute on function public.get_audit_log(int, int) to authenticated;

drop function if exists public.get_audit_log_detail(uuid);
create or replace function public.get_audit_log_detail(entry_id uuid)
returns table (id uuid, user_id uuid, user_email text, user_name text, action text, table_name text, record_id text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select al.id, al.user_id, p.email as user_email,
    trim(concat_ws(' ', p.first_name, p.last_name)) as user_name,
    al.action, al.table_name, al.record_id, al.created_at
  from public.audit_log al
  left join public.profiles p on p.id = al.user_id
  where public.is_admin() and al.id = entry_id;
$$;
grant execute on function public.get_audit_log_detail(uuid) to authenticated;

drop function if exists public.get_maintenance_reminders();
create or replace function public.get_maintenance_reminders()
returns table (object_id uuid, customer_id uuid, customer_name text, bv_id uuid, bv_name text, internal_id text,
  object_name text, object_room text, object_floor text, object_manufacturer text,
  maintenance_interval_months int, last_maintenance_date date, next_maintenance_date date, status text, days_until_due int)
language sql security definer set search_path = public stable as $$
  with last_maint as (select object_id, max(maintenance_date) as d from public.maintenance_reports group by object_id),
  objs as (
    select o.id as object_id, o.bv_id, o.customer_id, o.internal_id, o.name as object_name, o.room as object_room, o.floor as object_floor, o.manufacturer as object_manufacturer,
           o.maintenance_interval_months,
           coalesce(lm.d, null::date) as last_maintenance_date,
           case when o.maintenance_interval_months is not null and o.maintenance_interval_months > 0
             then (coalesce(lm.d, current_date) + (o.maintenance_interval_months || ' months')::interval)::date else null end as next_maintenance_date
    from public.objects o left join last_maint lm on lm.object_id = o.id
    where o.maintenance_interval_months is not null and o.maintenance_interval_months > 0
  )
  select ob.object_id, c.id as customer_id, c.name as customer_name, b.id as bv_id, b.name as bv_name, ob.internal_id,
         ob.object_name, ob.object_room, ob.object_floor, ob.object_manufacturer,
         ob.maintenance_interval_months, ob.last_maintenance_date, ob.next_maintenance_date,
         case when ob.next_maintenance_date is null then 'ok' when ob.next_maintenance_date < current_date then 'overdue'
              when ob.next_maintenance_date <= current_date + interval '30 days' then 'due_soon' else 'ok' end as status,
         case when ob.next_maintenance_date is not null then (ob.next_maintenance_date - current_date)::int else null end as days_until_due
  from objs ob left join public.bvs b on b.id = ob.bv_id join public.customers c on c.id = coalesce(b.customer_id, ob.customer_id)
  where auth.uid() is not null and ((c.demo_user_id is null and not public.is_demo()) or (c.demo_user_id = auth.uid()));
$$;
grant execute on function public.get_maintenance_reminders() to authenticated;

drop function if exists public.search_entities(text);
create or replace function public.search_entities(q text)
returns table (
  entity_type text,
  customer_id uuid,
  customer_name text,
  customer_street text,
  customer_house_number text,
  customer_city text,
  bv_id uuid,
  bv_name text,
  bv_street text,
  bv_house_number text,
  bv_city text,
  object_id uuid,
  object_name text,
  object_internal_id text,
  object_room text,
  object_floor text,
  object_manufacturer text,
  object_build_year text
)
language sql security definer set search_path = public stable as $$
  with pattern as (
    select '%' || trim(coalesce(q, '')) || '%' as p
  )
  select
    'customer'::text as entity_type,
    c.id as customer_id,
    c.name as customer_name,
    c.street as customer_street,
    c.house_number as customer_house_number,
    c.city as customer_city,
    null::uuid as bv_id,
    null::text as bv_name,
    null::text as bv_street,
    null::text as bv_house_number,
    null::text as bv_city,
    null::uuid as object_id,
    null::text as object_name,
    null::text as object_internal_id,
    null::text as object_room,
    null::text as object_floor,
    null::text as object_manufacturer,
    null::text as object_build_year
  from pattern pat
  join public.customers c on public.customer_visible_to_user(c.id)
  where trim(coalesce(q, '')) <> ''
    and (
      c.name ilike pat.p
      or coalesce(c.city, '') ilike pat.p
      or coalesce(c.street, '') ilike pat.p
      or coalesce(c.house_number, '') ilike pat.p
    )
  union all
  select
    'bv'::text as entity_type,
    c.id as customer_id,
    c.name as customer_name,
    c.street as customer_street,
    c.house_number as customer_house_number,
    c.city as customer_city,
    b.id as bv_id,
    b.name as bv_name,
    b.street as bv_street,
    b.house_number as bv_house_number,
    b.city as bv_city,
    null::uuid as object_id,
    null::text as object_name,
    null::text as object_internal_id,
    null::text as object_room,
    null::text as object_floor,
    null::text as object_manufacturer,
    null::text as object_build_year
  from pattern pat
  join public.bvs b on true
  join public.customers c on c.id = b.customer_id
  where trim(coalesce(q, '')) <> ''
    and public.customer_visible_to_user(c.id)
    and (
      b.name ilike pat.p
      or coalesce(b.city, '') ilike pat.p
      or coalesce(b.street, '') ilike pat.p
      or coalesce(b.house_number, '') ilike pat.p
    )
  union all
  select
    'object'::text as entity_type,
    c.id as customer_id,
    c.name as customer_name,
    c.street as customer_street,
    c.house_number as customer_house_number,
    c.city as customer_city,
    b.id as bv_id,
    b.name as bv_name,
    b.street as bv_street,
    b.house_number as bv_house_number,
    b.city as bv_city,
    o.id as object_id,
    o.name as object_name,
    o.internal_id as object_internal_id,
    o.room as object_room,
    o.floor as object_floor,
    o.manufacturer as object_manufacturer,
    o.build_year as object_build_year
  from pattern pat
  join public.objects o on true
  left join public.bvs b on b.id = o.bv_id
  join public.customers c on c.id = coalesce(b.customer_id, o.customer_id)
  where trim(coalesce(q, '')) <> ''
    and public.object_visible_to_user(o.bv_id, o.customer_id)
    and (
      coalesce(o.name, '') ilike pat.p
      or coalesce(o.internal_id, '') ilike pat.p
      or coalesce(o.room, '') ilike pat.p
      or coalesce(o.floor, '') ilike pat.p
      or coalesce(o.manufacturer, '') ilike pat.p
      or coalesce(o.build_year, '') ilike pat.p
    )
  order by customer_name, bv_name nulls first, object_name nulls first;
$$;
grant execute on function public.search_entities(text) to authenticated;

drop function if exists public.resolve_object_to_navigation(text);
create or replace function public.resolve_object_to_navigation(identifier text)
returns table (customer_id uuid, bv_id uuid, object_id uuid)
language sql security definer set search_path = public stable as $$
  select
    c.id as customer_id,
    b.id as bv_id,
    o.id as object_id
  from public.objects o
  left join public.bvs b on b.id = o.bv_id
  join public.customers c on c.id = coalesce(b.customer_id, o.customer_id)
  where public.object_visible_to_user(o.bv_id, o.customer_id)
    and trim(coalesce(identifier, '')) <> ''
    and (
      o.id::text = trim(identifier)
      or coalesce(o.internal_id, '') = trim(identifier)
    )
  order by o.created_at desc
  limit 1;
$$;
grant execute on function public.resolve_object_to_navigation(text) to authenticated;

create or replace function public.cleanup_demo_customers_older_than_24h()
returns json language plpgsql security definer set search_path = public as $$
declare
  ids uuid[];
  cnt bigint;
begin
  with deleted as (
    delete from public.customers
    where demo_user_id is not null and created_at < now() - interval '24 hours'
    returning id
  )
  select array_agg(id), count(*)::bigint into ids, cnt from deleted;
  return json_build_object('deleted_count', coalesce(cnt, 0), 'deleted_ids', coalesce(ids, array[]::uuid[]));
end;
$$;
grant execute on function public.cleanup_demo_customers_older_than_24h() to authenticated;

-- =============================================================================
-- 5b. LIZENZMODELL
-- =============================================================================

create table if not exists public.license (
  id uuid primary key default gen_random_uuid(),
  tier text not null default 'professional',
  valid_until date,
  max_customers int,
  max_users int,
  features jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.license enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'license' loop
    execute format('drop policy if exists %I on public.license', r.policyname);
  end loop;
end $$;
create policy "Authenticated users can read license" on public.license for select using (auth.uid() is not null);
create policy "Admins can manage license" on public.license for all using (public.is_admin());

insert into public.license (tier, valid_until, max_customers, max_users, features)
select 'professional', '2026-12-31'::date, 50, 10, '{"kundenportal": true, "historie": true}'::jsonb
where not exists (select 1 from public.license);

drop function if exists public.get_license_status();
create or replace function public.get_license_status()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  lic record;
  customer_count bigint;
  user_count bigint;
  is_expired boolean;
begin
  select * into lic from public.license limit 1;
  if lic is null then
    return jsonb_build_object('tier', 'none', 'valid', false);
  end if;
  select count(*) into customer_count from public.customers where demo_user_id is null;
  select count(*) into user_count from public.profiles where role not in ('demo', 'kunde');
  is_expired := lic.valid_until is not null and lic.valid_until < current_date;
  return jsonb_build_object(
    'tier', lic.tier,
    'valid_until', lic.valid_until,
    'max_customers', lic.max_customers,
    'max_users', lic.max_users,
    'current_customers', customer_count,
    'current_users', user_count,
    'features', lic.features,
    'valid', not is_expired,
    'expired', is_expired
  );
end;
$$;
grant execute on function public.get_license_status() to authenticated;

drop function if exists public.check_can_create_customer();
create or replace function public.check_can_create_customer()
returns boolean language plpgsql security definer set search_path = public stable as $$
declare
  lic record;
  cnt bigint;
begin
  select * into lic from public.license limit 1;
  if lic is null then return true; end if;
  if lic.valid_until is not null and lic.valid_until < current_date then return false; end if;
  if lic.max_customers is null then return true; end if;
  select count(*) into cnt from public.customers where demo_user_id is null;
  return cnt < lic.max_customers;
end;
$$;
grant execute on function public.check_can_create_customer() to authenticated;

drop function if exists public.check_can_invite_user();
create or replace function public.check_can_invite_user()
returns boolean language plpgsql security definer set search_path = public stable as $$
declare
  lic record;
  cnt bigint;
begin
  select * into lic from public.license limit 1;
  if lic is null then return true; end if;
  if lic.valid_until is not null and lic.valid_until < current_date then return false; end if;
  if lic.max_users is null then return true; end if;
  select count(*) into cnt from public.profiles where role not in ('demo', 'kunde');
  return cnt < lic.max_users;
end;
$$;
grant execute on function public.check_can_invite_user() to authenticated;

-- =============================================================================
-- 6. KUNDENPORTAL
-- =============================================================================
-- Tabelle customer_portal_users wurde bereits in Sektion 2 angelegt (Trigger handle_new_user).
-- Hier: Unique-Constraint, RLS, Policies, Helper-Funktionen, Indizes.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customer_portal_users_customer_id_email_key'
  ) then
    alter table public.customer_portal_users add constraint customer_portal_users_customer_id_email_key unique (customer_id, email);
  end if;
exception when others then null;
end $$;

alter table public.customer_portal_users enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'customer_portal_users' loop
    execute format('drop policy if exists %I on public.customer_portal_users', r.policyname);
  end loop;
end $$;
create policy "Admins can manage portal users" on public.customer_portal_users for all using (public.is_admin());
create policy "Portal users can read own entries" on public.customer_portal_users for select using (
  auth.uid() is not null and user_id = auth.uid()
);

-- Whitelist Sichtbarkeit Objekte/BV pro Portalbenutzer (Standard: alle sichtbar; bei Einträgen nur ausgewählte)
-- bv_id null = Objekte direkt unter Kunde sichtbar
create table if not exists public.portal_user_object_visibility (
  user_id uuid references auth.users(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete cascade not null,
  bv_id uuid references public.bvs(id) on delete cascade,
  primary key (user_id, customer_id, bv_id)
);
do $$ begin
  alter table public.portal_user_object_visibility alter column bv_id drop not null;
exception when others then null;
end $$;
alter table public.portal_user_object_visibility enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'portal_user_object_visibility' loop
    execute format('drop policy if exists %I on public.portal_user_object_visibility', r.policyname);
  end loop;
end $$;
create policy "Admins can manage portal visibility" on public.portal_user_object_visibility for all using (public.is_admin());
create policy "Portal users can read own visibility" on public.portal_user_object_visibility for select using (
  auth.uid() is not null and user_id = auth.uid()
);
create index if not exists idx_portal_user_object_visibility_user_id on public.portal_user_object_visibility(user_id);
create index if not exists idx_portal_user_object_visibility_customer_id on public.portal_user_object_visibility(customer_id);

drop trigger if exists audit_portal_user_object_visibility on public.portal_user_object_visibility;
create trigger audit_portal_user_object_visibility after insert or update or delete on public.portal_user_object_visibility for each row execute function public.audit_trigger_fn();

-- Liefert true, wenn Portal-User alle Objekte des Kunden sieht (keine Einschränkung in portal_user_object_visibility).
create or replace function public.portal_user_sees_all_for_customer(p_user_id uuid, p_customer_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.portal_user_object_visibility v where v.user_id = p_user_id and v.customer_id = p_customer_id);
$$;
-- Liefert true, wenn dieses Objekt (customer_id + bv_id) für den Portal-User sichtbar ist.
create or replace function public.portal_object_visible_to_user(p_user_id uuid, p_customer_id uuid, p_bv_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.customer_portal_users cpu where cpu.user_id = p_user_id and cpu.customer_id = p_customer_id)
  and (
    public.portal_user_sees_all_for_customer(p_user_id, p_customer_id)
    or exists (
      select 1 from public.portal_user_object_visibility v
      where v.user_id = p_user_id and v.customer_id = p_customer_id and v.bv_id is not distinct from p_bv_id
    )
  );
$$;
grant execute on function public.portal_user_sees_all_for_customer(uuid, uuid) to authenticated;
grant execute on function public.portal_object_visible_to_user(uuid, uuid, uuid) to authenticated;

create or replace function public.customer_ids_for_portal_user(uid uuid)
returns setof uuid language sql security definer set search_path = public stable as $$
  select customer_id from public.customer_portal_users where user_id = uid;
$$;
grant execute on function public.customer_ids_for_portal_user(uuid) to authenticated;

drop function if exists public.get_portal_maintenance_reports(uuid);
create or replace function public.get_portal_maintenance_reports(p_user_id uuid)
returns table (
  report_id uuid, object_id uuid, maintenance_date date, maintenance_time text,
  reason text, reason_other text, manufacturer_maintenance_done boolean,
  hold_open_checked boolean, deficiencies_found boolean, deficiency_description text,
  urgency text, fixed_immediately boolean, pdf_path text, created_at timestamptz,
  object_name text, object_internal_id text, object_floor text, object_room text,
  bv_name text, customer_name text
)
language sql security definer set search_path = public stable as $$
  select
    mr.id as report_id, mr.object_id, mr.maintenance_date, mr.maintenance_time,
    mr.reason, mr.reason_other, mr.manufacturer_maintenance_done,
    mr.hold_open_checked, mr.deficiencies_found, mr.deficiency_description,
    mr.urgency, mr.fixed_immediately, mr.pdf_path, mr.created_at,
    o.name as object_name, o.internal_id as object_internal_id, o.floor as object_floor, o.room as object_room,
    b.name as bv_name, c.name as customer_name
  from public.maintenance_reports mr
  join public.objects o on o.id = mr.object_id
  left join public.bvs b on b.id = o.bv_id
  join public.customers c on c.id = coalesce(b.customer_id, o.customer_id)
  where c.id in (select customer_id from public.customer_portal_users where user_id = p_user_id)
    and public.portal_object_visible_to_user(p_user_id, c.id, o.bv_id)
  order by mr.maintenance_date desc;
$$;
grant execute on function public.get_portal_maintenance_reports(uuid) to authenticated;

create or replace function public.get_portal_pdf_path(p_report_id uuid)
returns text language sql security definer set search_path = public stable as $$
  select mr.pdf_path
  from public.maintenance_reports mr
  join public.objects o on o.id = mr.object_id
  left join public.bvs b on b.id = o.bv_id
  join public.customers c on c.id = coalesce(b.customer_id, o.customer_id)
  where mr.id = p_report_id
    and c.id in (select customer_id from public.customer_portal_users where user_id = auth.uid())
    and public.portal_object_visible_to_user(auth.uid(), c.id, o.bv_id);
$$;
grant execute on function public.get_portal_pdf_path(uuid) to authenticated;

-- =============================================================================
-- 7. STORAGE BUCKETS
-- =============================================================================

insert into storage.buckets (id, name, public) values ('object-photos', 'object-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('object-documents', 'object-documents', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('maintenance-photos', 'maintenance-photos', true) on conflict (id) do nothing;

drop policy if exists "Authenticated users can read object-photos" on storage.objects;
drop policy if exists "Authenticated users can upload object-photos" on storage.objects;
drop policy if exists "Authenticated users can delete object-photos" on storage.objects;
create policy "Authenticated users can read object-photos" on storage.objects for select using (bucket_id = 'object-photos' and auth.uid() is not null);
create policy "Authenticated users can upload object-photos" on storage.objects for insert with check (bucket_id = 'object-photos' and auth.uid() is not null);
create policy "Authenticated users can delete object-photos" on storage.objects for delete using (bucket_id = 'object-photos' and auth.uid() is not null);

drop policy if exists "Authenticated users can read object-documents" on storage.objects;
drop policy if exists "Authenticated users can upload object-documents" on storage.objects;
drop policy if exists "Authenticated users can delete object-documents" on storage.objects;
create policy "Authenticated users can read object-documents" on storage.objects for select using (bucket_id = 'object-documents' and auth.uid() is not null);
create policy "Authenticated users can upload object-documents" on storage.objects for insert with check (bucket_id = 'object-documents' and auth.uid() is not null);
create policy "Authenticated users can delete object-documents" on storage.objects for delete using (bucket_id = 'object-documents' and auth.uid() is not null);

drop policy if exists "Authenticated users can read maintenance-photos" on storage.objects;
drop policy if exists "Authenticated users can upload maintenance-photos" on storage.objects;
drop policy if exists "Authenticated users can delete maintenance-photos" on storage.objects;
create policy "Authenticated users can read maintenance-photos" on storage.objects for select using (bucket_id = 'maintenance-photos' and auth.uid() is not null);
create policy "Authenticated users can upload maintenance-photos" on storage.objects for insert with check (bucket_id = 'maintenance-photos' and auth.uid() is not null);
create policy "Authenticated users can delete maintenance-photos" on storage.objects for delete using (bucket_id = 'maintenance-photos' and auth.uid() is not null);

-- =============================================================================
-- 8. INDIZES & REALTIME
-- =============================================================================
-- Indizes nach Domäne gruppiert; partial indices wo sinnvoll (z. B. demo_user_id is null).

-- Stammdaten & Lizenz-Counts
create index if not exists idx_customers_demo_user_id on public.customers(demo_user_id) where demo_user_id is not null;
create index if not exists idx_customers_demo_user_id_null on public.customers(demo_user_id) where demo_user_id is null;
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_team_id on public.profiles(team_id) where team_id is not null;
create index if not exists idx_bvs_customer_id on public.bvs(customer_id);
create index if not exists idx_objects_bv_id on public.objects(bv_id);
create index if not exists idx_objects_customer_id on public.objects(customer_id) where customer_id is not null;
create index if not exists idx_maintenance_contracts_customer_id on public.maintenance_contracts(customer_id) where customer_id is not null;
create index if not exists idx_maintenance_contracts_bv_id on public.maintenance_contracts(bv_id) where bv_id is not null;
create index if not exists idx_object_photos_object_id on public.object_photos(object_id);
create index if not exists idx_object_documents_object_id on public.object_documents(object_id);

-- Lizenz (Ablaufprüfung)
create index if not exists idx_license_valid_until on public.license(valid_until);

-- Wartung
create index if not exists idx_maintenance_reports_object_id on public.maintenance_reports(object_id);
create index if not exists idx_maintenance_reports_object_date on public.maintenance_reports(object_id, maintenance_date desc);
create index if not exists idx_maintenance_report_photos_report_id on public.maintenance_report_photos(report_id);
create index if not exists idx_maintenance_report_smoke_detectors_report_id on public.maintenance_report_smoke_detectors(report_id);

-- Aufträge, Zeit, Audit, Settings
create index if not exists idx_orders_order_date on public.orders(order_date);
create index if not exists idx_orders_assigned_to on public.orders(assigned_to);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_bv_id on public.orders(bv_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_time_entries_user_date on public.time_entries(user_id, date desc);
create index if not exists idx_time_breaks_time_entry_id on public.time_breaks(time_entry_id);
create index if not exists idx_time_entry_edit_log_time_entry_id on public.time_entry_edit_log(time_entry_id);
create index if not exists idx_time_entry_edit_log_edited_at on public.time_entry_edit_log(edited_at desc);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);
create index if not exists idx_app_errors_created_at on public.app_errors(created_at desc);
create index if not exists idx_app_errors_status on public.app_errors(status);
create index if not exists idx_component_settings_sort_order on public.component_settings(sort_order);

-- Kundenportal
create index if not exists idx_customer_portal_users_user_id on public.customer_portal_users(user_id);
create index if not exists idx_customer_portal_users_email on public.customer_portal_users(email);
create index if not exists idx_customer_portal_users_customer_id on public.customer_portal_users(customer_id);

-- Realtime für Aufträge (Sync bei Zuweisung)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
