-- -----------------------------------------------------------------------------
-- Vico – Datenbank-Schema (vollständig, Mandanten-Haupt-App)
-- Supabase SQL Editor: Inhalt einfügen und Run ausführen. Idempotent.
-- Zuletzt strukturell aufgeräumt: 2026-03 (Header, keine fachliche Logik geändert).
-- -----------------------------------------------------------------------------
-- Zuständigkeit / Source of Truth
--   • Diese Datei: Mandanten-Haupt-App-DB (Stammdaten, Aufträge, Protokolle, Portal-Daten).
--   • Lizenzportal-DB: `supabase-license-portal.sql` (tenants, licenses, Branding/Domain-Mapping).
--   • Werte wie `design.kundenportal_url` kommen über die Lizenz-API aus der Lizenzportal-DB.
-- Drift-Matrix (Kurz)
--   • Haupt-App-DB (`supabase-complete.sql`):
--       customers, bvs, objects, orders, maintenance_reports, customer_portal_users,
--       admin_config, location_requests, push_subscriptions, app_maintenance_mode, monteur_report_settings
--   • Lizenzportal-DB (`supabase-license-portal.sql`):
--       tenants, licenses, license_models, platform_config, app_releases,
--       release_incoming_tenants, tenant_release_assignments, beta_feedback, roadmap_items
--   • Brücke:
--       Mandanten-Apps lesen Lizenz-/Brandingdaten ausschließlich über die Lizenz-API (`design.*`, `license.*`).
-- -----------------------------------------------------------------------------
--
-- Inhaltsverzeichnis (Reihenfolge = Abhängigkeiten)
--   1. Profiles & Rollen, RLS, Trigger (inkl. maintenance_reminder_* / Urlaub-Spalten)
--   2. Stammdaten: customers, bvs, objects, Fotos/Dokumente, maintenance_contracts, …
--   3. Wartungsprotokolle (Reports, Fotos, Rauchmelder)
--   4. orders, time_*, leave_*, work_*, component_settings, audit_log (+ Trigger)
--   4b. Soll-Berechnung: Feiertage, Arbeitseinstellungen, freie Tage
--   5. RPCs (Zeit, Urlaub, Audit, Suche, …)
--   5b. Lizenz: license, get_license_status, Grenz-Checks
--   5c. Standortabfrage: admin_config, location_requests, push_subscriptions, …
--   6. Kundenportal (RLS, Sichtbarkeit, get_portal_*)
--   7. Storage-Buckets + Policies
--   7b. Urlaub Phase 3 (Zusatzposten, VJ-Ack, erweiterte RPCs) – nach Storage, vor Indizes
--   8. Indizes & Realtime (Querschnitt; weitere idx_* auch direkt bei neuen Tabellen in §4/5c)
--
-- Hinweise
--   • DDL vor Funktionen: Tabellen/Spalten, die RPCs nutzen, müssen zuerst existieren
--     (z. B. leave_requests.approved_*, profiles.urlaub_vj_*).
--   • Indizes: überwiegend CREATE INDEX IF NOT EXISTS; doppelte Strategie ist Absicht –
--     „nah an der Tabelle“ für Lesbarkeit bei großen Blöcken, Abschn. 8 für Überblick & Realtime.
--   • Laufzeit-Optimierung: EXPLAIN/ANALYZE in Staging; ggf. pg_stat_statements; keine
--     Index-Löschungen hier ohne Messung (Partial Indizes z. B. demo_user_id bewusst gesetzt).
--   • Namenskonventionen:
--       - Constraints: <tabelle>_<spalte/zweck>_(check|fkey|key)
--       - Indizes: idx_<tabelle>_<spalte/zweck>
--       - Policies: "<Rolle/Ziel> <Aktion> <tabelle>"
--       - Trigger-Funktionen: <tabelle>_<regel_verb>
--   • Pflege-Checkliste bei neuen SQL-Änderungen:
--       1) Im passenden Abschnitt einsortieren (nicht nur am Dateiende anhängen)
--       2) Falls nötig: Nachmigration (add column if not exists / do $$) direkt unter der Tabelle
--       3) Constraints + Default-Backfill im selben Block dokumentieren
--       4) RLS/Policies unmittelbar beim betroffenen Objekt anpassen
--       5) Indexe entweder lokal am Objekt oder bewusst im Abschnitt 8 ergänzen

-- -----------------------------------------------------------------------------
-- 1. PROFILES & ROLLEN
-- -----------------------------------------------------------------------------

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
alter table public.profiles add column if not exists standortabfrage_consent_at timestamptz default null;
alter table public.profiles add column if not exists standortabfrage_consent_revoked_at timestamptz default null;
alter table public.profiles add column if not exists dashboard_layout jsonb default null;
alter table public.profiles add column if not exists theme_preference text default null;

do $$
begin
  alter table public.profiles drop constraint if exists profiles_theme_preference_check;
exception when others then null;
end $$;
alter table public.profiles add constraint profiles_theme_preference_check
  check (theme_preference is null or theme_preference in ('light', 'dark', 'system'));

-- Wartungs-Erinnerungen per E-Mail (Roadmap J1; Versand via Edge Function + Cron)
alter table public.profiles add column if not exists maintenance_reminder_email_enabled boolean default false not null;
alter table public.profiles add column if not exists maintenance_reminder_email_frequency text default 'weekly' not null;
alter table public.profiles add column if not exists maintenance_reminder_email_last_sent_at timestamptz default null;
alter table public.profiles add column if not exists maintenance_reminder_email_consent_at timestamptz default null;
do $$
begin
  alter table public.profiles drop constraint if exists profiles_maint_email_freq_check;
exception when others then null;
end $$;
alter table public.profiles add constraint profiles_maint_email_freq_check
  check (maintenance_reminder_email_frequency in ('daily', 'weekly'));

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
create policy "Teamleiter can update soll_minutes for team members" on public.profiles for update using (
  public.is_teamleiter()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.team_id is not null
    and me.team_id = profiles.team_id
  )
);
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

-- profiles → auth.users: Löschen im Supabase-Dashboard (auth.users) kaskadiert Profil
do $$
begin
  alter table public.profiles drop constraint if exists profiles_id_fkey;
  alter table public.profiles
    add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- 2. STAMMDATEN
-- -----------------------------------------------------------------------------

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
alter table public.customers add column if not exists monteur_report_internal_only boolean not null default false;
alter table public.customers add column if not exists monteur_report_portal boolean not null default true;
alter table public.customers add column if not exists maintenance_report_portal boolean not null default true;
alter table public.customers add column if not exists archived_at timestamptz;
alter table public.customers add column if not exists house_number text;
alter table public.customers add column if not exists demo_user_id uuid references auth.users(id) on delete cascade;
alter table public.customers enable row level security;

-- 2.1a Kundenportal-Zuordnung (Basis für Portal-Login-Mapping)
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
do $$
begin
  alter table public.customer_portal_users drop constraint if exists customer_portal_users_invited_by_fkey;
  alter table public.customer_portal_users
    add constraint customer_portal_users_invited_by_fkey foreign key (invited_by) references public.profiles(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

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
alter table public.bvs add column if not exists archived_at timestamptz;
alter table public.bvs add column if not exists uses_customer_report_delivery boolean not null default true;
alter table public.bvs add column if not exists maintenance_report_portal boolean not null default true;
alter table public.bvs add column if not exists monteur_report_portal boolean not null default true;
alter table public.bvs add column if not exists monteur_report_internal_only boolean not null default false;
alter table public.bvs enable row level security;

-- Nach create table bvs (Funktion referenziert public.bvs)
create or replace function public.bv_customer_visible(bid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.customer_visible_to_user((select customer_id from public.bvs where id = bid));
$$;
grant execute on function public.bv_customer_visible(uuid) to authenticated;

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
alter table public.objects add column if not exists accessories_items jsonb default '[]'::jsonb;
alter table public.objects add column if not exists profile_photo_path text;
alter table public.objects add column if not exists archived_at timestamptz;
alter table public.objects add column if not exists last_door_maintenance_date date;
alter table public.objects add column if not exists door_maintenance_date_manual boolean default false;
alter table public.objects add column if not exists hold_open_last_maintenance_date date;
alter table public.objects add column if not exists hold_open_maintenance_interval_months int;
alter table public.objects add column if not exists hold_open_last_maintenance_manual boolean default false;
alter table public.objects add column if not exists defects_structured jsonb default '[]'::jsonb;
alter table public.objects enable row level security;

-- Stammdaten-Katalog Tür/Schließmittel (eine Zeile pro Mandanten-DB)
create table if not exists public.door_field_catalog (
  id smallint primary key default 1,
  door_manufacturers jsonb not null default '[]'::jsonb,
  lock_manufacturers jsonb not null default '[]'::jsonb,
  lock_types jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  constraint door_field_catalog_single_row check (id = 1)
);
insert into public.door_field_catalog (id) values (1)
  on conflict (id) do nothing;
alter table public.door_field_catalog enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'door_field_catalog' loop
    execute format('drop policy if exists %I on public.door_field_catalog', r.policyname);
  end loop;
end $$;
create policy "door_field_catalog read" on public.door_field_catalog for select using (auth.uid() is not null);
create policy "door_field_catalog admin insert" on public.door_field_catalog for insert with check (public.is_admin());
create policy "door_field_catalog admin update" on public.door_field_catalog for update using (public.is_admin()) with check (public.is_admin());

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

-- -----------------------------------------------------------------------------
-- 3. WARTUNGSPROTOKOLLE
-- -----------------------------------------------------------------------------

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
do $$
begin
  alter table public.maintenance_reports drop constraint if exists maintenance_reports_technician_id_fkey;
  alter table public.maintenance_reports
    add constraint maintenance_reports_technician_id_fkey foreign key (technician_id) references public.profiles(id) on delete set null;
exception
  when duplicate_object then null;
end $$;
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

create table if not exists public.checklist_defect_photos (
  id uuid default gen_random_uuid() primary key,
  maintenance_report_id uuid references public.maintenance_reports(id) on delete cascade not null,
  object_id uuid references public.objects(id) on delete cascade not null,
  checklist_scope text not null check (checklist_scope in ('door', 'feststell')),
  checklist_item_id text not null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.checklist_defect_photos enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'checklist_defect_photos' loop
    execute format('drop policy if exists %I on public.checklist_defect_photos', r.policyname);
  end loop;
end $$;
create policy "Authenticated read checklist_defect_photos" on public.checklist_defect_photos for select using (auth.uid() is not null);
create policy "Non-leser insert checklist_defect_photos" on public.checklist_defect_photos for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser update checklist_defect_photos" on public.checklist_defect_photos for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser delete checklist_defect_photos" on public.checklist_defect_photos for delete using (auth.uid() is not null and not public.is_leser());

-- Mangelfotos zur Wartungscheckliste **bevor** die Prüfprotokoll-Zeile (maintenance_reports) existiert;
-- werden bei erfolgreicher Checkliste in checklist_defect_photos übernommen (gleicher storage_path).
create table if not exists public.checklist_defect_photo_drafts (
  id uuid default gen_random_uuid() primary key,
  source_order_id uuid not null references public.orders(id) on delete cascade,
  object_id uuid not null references public.objects(id) on delete cascade,
  checklist_scope text not null check (checklist_scope in ('door', 'feststell')),
  checklist_item_id text not null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_checklist_defect_photo_drafts_order_object
  on public.checklist_defect_photo_drafts (source_order_id, object_id);
alter table public.checklist_defect_photo_drafts enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'checklist_defect_photo_drafts' loop
    execute format('drop policy if exists %I on public.checklist_defect_photo_drafts', r.policyname);
  end loop;
end $$;
create policy "Authenticated read checklist_defect_photo_drafts" on public.checklist_defect_photo_drafts for select using (auth.uid() is not null);
create policy "Non-leser insert checklist_defect_photo_drafts" on public.checklist_defect_photo_drafts for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser update checklist_defect_photo_drafts" on public.checklist_defect_photo_drafts for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser delete checklist_defect_photo_drafts" on public.checklist_defect_photo_drafts for delete using (auth.uid() is not null and not public.is_leser());

-- Fotos zu Stammdaten-Mängeln (objects.defects_structured Einträge per defect_entry_id), max. 3 pro Mangel in der App
create table if not exists public.object_defect_photos (
  id uuid default gen_random_uuid() primary key,
  object_id uuid not null references public.objects(id) on delete cascade,
  defect_entry_id text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_object_defect_photos_object_defect
  on public.object_defect_photos (object_id, defect_entry_id);
alter table public.object_defect_photos enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'object_defect_photos' loop
    execute format('drop policy if exists %I on public.object_defect_photos', r.policyname);
  end loop;
end $$;
create policy "Authenticated read object_defect_photos" on public.object_defect_photos for select using (auth.uid() is not null);
create policy "Non-leser insert object_defect_photos" on public.object_defect_photos for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser delete object_defect_photos" on public.object_defect_photos for delete using (auth.uid() is not null and not public.is_leser());

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

-- Wartungsprotokoll aus Auftrags-Checkliste (je Auftrag + Objekt eine Zeile, revisionssicher nachgespeichert)
alter table public.maintenance_reports add column if not exists source_order_id uuid references public.orders(id) on delete set null;
alter table public.maintenance_reports add column if not exists checklist_protocol jsonb not null default '{}'::jsonb;
alter table public.maintenance_reports add column if not exists pruefprotokoll_pdf_path text;

-- Laufende Prüfprotokoll-Nummer (mandantenweit fortlaufend, bei INSERT automatisch)
create sequence if not exists public.maintenance_reports_pruefprotokoll_laufnummer_seq;
alter table public.maintenance_reports add column if not exists pruefprotokoll_laufnummer bigint;
do $$
declare r record;
begin
  for r in
    select id from public.maintenance_reports
    where pruefprotokoll_laufnummer is null
    order by created_at nulls last, id
  loop
    update public.maintenance_reports
    set pruefprotokoll_laufnummer = nextval('public.maintenance_reports_pruefprotokoll_laufnummer_seq')
    where id = r.id;
  end loop;
end $$;
select setval(
  'public.maintenance_reports_pruefprotokoll_laufnummer_seq',
  coalesce((select max(pruefprotokoll_laufnummer) from public.maintenance_reports), 0)
);
alter table public.maintenance_reports
  alter column pruefprotokoll_laufnummer set default nextval('public.maintenance_reports_pruefprotokoll_laufnummer_seq'::regclass);
alter table public.maintenance_reports alter column pruefprotokoll_laufnummer set not null;
create unique index if not exists idx_maintenance_reports_pruefprotokoll_laufnummer
  on public.maintenance_reports (pruefprotokoll_laufnummer);

create unique index if not exists idx_maintenance_reports_order_object
  on public.maintenance_reports (source_order_id, object_id)
  where source_order_id is not null;

-- Follow-up Mängelbeseitigung (Zähler Badges, Workflow)
create table if not exists public.defect_followups (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  object_id uuid not null references public.objects(id) on delete cascade,
  maintenance_report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  status text not null default 'offen'
    check (status in ('offen', 'kv_versendet', 'kunde_bestaetigt', 'freigegeben', 'in_arbeit', 'behoben')),
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  quote_attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.defect_followups enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'defect_followups' loop
    execute format('drop policy if exists %I on public.defect_followups', r.policyname);
  end loop;
end $$;
create policy "Authenticated read defect_followups" on public.defect_followups
  for select using (auth.uid() is not null);
create policy "Non-leser manage defect_followups" on public.defect_followups
  for all using (auth.uid() is not null and not public.is_leser());

-- -----------------------------------------------------------------------------
-- 4. AUFTRÄGE, ZEIT, URLAUB (leave_*), WORK SETTINGS, COMPONENT SETTINGS, AUDIT
-- -----------------------------------------------------------------------------
-- 4a. Orders

create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  bv_id uuid references public.bvs(id) on delete cascade not null,
  related_order_id uuid references public.orders(id) on delete set null,
  object_id uuid references public.objects(id) on delete set null,
  order_date date not null,
  order_type text not null check (order_type in ('wartung', 'reparatur', 'montage', 'sonstiges')),
  status text not null default 'offen' check (status in ('offen', 'in_bearbeitung', 'erledigt', 'storniert')),
  description text, assigned_to uuid references public.profiles(id), created_by uuid references public.profiles(id),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
do $$
begin
  alter table public.orders drop constraint if exists orders_assigned_to_fkey;
  alter table public.orders
    add constraint orders_assigned_to_fkey foreign key (assigned_to) references public.profiles(id) on delete set null;
exception
  when duplicate_object then null;
end $$;
-- 4a.1 Nachmigrationen (Legacy-DBs)
do $$
begin
  alter table public.orders drop constraint if exists orders_created_by_fkey;
  alter table public.orders
    add constraint orders_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;
exception
  when duplicate_object then null;
end $$;
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_time') then
    alter table public.orders add column order_time time;
  end if;
end $$;
-- Mehrere Türen/Tore pro Auftrag; Aufträge ohne Objekt/BV (nur Türen direkt unter Kunde)
alter table public.orders alter column bv_id drop not null;
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'object_ids') then
    alter table public.orders add column object_ids uuid[];
  end if;
end $$;
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'related_order_id') then
    alter table public.orders add column related_order_id uuid;
  end if;
end $$;
do $$
begin
  alter table public.orders drop constraint if exists orders_related_order_id_fkey;
  alter table public.orders
    add constraint orders_related_order_id_fkey
    foreign key (related_order_id) references public.orders(id) on delete set null;
exception
  when duplicate_object then null;
end $$;
create index if not exists idx_orders_related_order_id on public.orders(related_order_id);
update public.orders o
set object_ids = array[o.object_id]::uuid[]
where o.object_id is not null
  and (o.object_ids is null or cardinality(o.object_ids) = 0);
-- 4a.2 RLS / Policies
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

-- 4a.3 Business-Regeln / Trigger
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

-- Höchstens ein aktiver Auftrag (offen / in_bearbeitung) pro Tür/Tor (object_id) – §11.19 / WP-ORD-01
drop function if exists public.orders_enforce_single_active_per_object() cascade;
create or replace function public.orders_enforce_single_active_per_object()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  conflict_id uuid;
begin
  if new.status is distinct from 'offen' and new.status is distinct from 'in_bearbeitung' then
    return new;
  end if;

  for oid in
    select distinct u.x
    from unnest(
      coalesce(
        new.object_ids,
        case when new.object_id is not null then array[new.object_id] else array[]::uuid[] end
      )
    ) as u(x)
  loop
    if oid is null then
      continue;
    end if;
    select o.id into conflict_id
    from public.orders o
    where o.id is distinct from new.id
      and o.status in ('offen', 'in_bearbeitung')
      and oid = any(
        coalesce(
          o.object_ids,
          case when o.object_id is not null then array[o.object_id] else array[]::uuid[] end
        )
      )
    limit 1;
    if conflict_id is not null then
      raise exception
        'Für mindestens eine gewählte Tür/Tor existiert bereits ein aktiver Auftrag (offen oder in Bearbeitung). Bestehende Auftrags-ID: %',
        conflict_id
        using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists orders_single_active_per_object on public.orders;
create trigger orders_single_active_per_object
  before insert or update of object_id, object_ids, status on public.orders
  for each row execute function public.orders_enforce_single_active_per_object();

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

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_completions' and column_name = 'completion_extra') then
    alter table public.order_completions add column completion_extra jsonb default '{}'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_completions' and column_name = 'monteur_pdf_path') then
    alter table public.order_completions add column monteur_pdf_path text;
  end if;
end $$;

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
alter table public.time_entries add column if not exists approval_status text default 'approved';
alter table public.time_entries add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.time_entries add column if not exists approved_at timestamptz default null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'time_entries_approval_status_check') then
    alter table public.time_entries add constraint time_entries_approval_status_check
      check (approval_status in ('submitted', 'approved', 'rejected'));
  end if;
end $$;
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

-- -----------------------------------------------------------------------------
-- 4b. SOLL-BERECHNUNG: FEIERTAGE, ARBEITSEINSTELLUNGEN, FREIE TAGE
-- -----------------------------------------------------------------------------

create table if not exists public.public_holidays (
  id uuid default gen_random_uuid() primary key,
  bundesland text not null,
  "date" date not null,
  name text,
  created_at timestamptz default now(),
  unique (bundesland, "date")
);
alter table public.public_holidays enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'public_holidays' loop
    execute format('drop policy if exists %I on public.public_holidays', r.policyname);
  end loop;
end $$;
create policy "Authenticated can read public_holidays" on public.public_holidays for select using (auth.uid() is not null);
create policy "Admins can manage public_holidays" on public.public_holidays for all using (public.is_admin());

-- Seed: Berlin Feiertage 2024–2026 (idempotent)
insert into public.public_holidays (bundesland, "date", name) values
  ('BE','2024-01-01','Neujahr'),('BE','2024-03-08','Frauentag'),('BE','2024-03-29','Karfreitag'),('BE','2024-04-01','Ostermontag'),
  ('BE','2024-05-01','Tag der Arbeit'),('BE','2024-05-09','Christi Himmelfahrt'),('BE','2024-05-20','Pfingstmontag'),
  ('BE','2024-10-03','Tag der Deutschen Einheit'),('BE','2024-12-25','1. Weihnachtstag'),('BE','2024-12-26','2. Weihnachtstag'),
  ('BE','2025-01-01','Neujahr'),('BE','2025-03-08','Frauentag'),('BE','2025-04-18','Karfreitag'),('BE','2025-04-21','Ostermontag'),
  ('BE','2025-05-01','Tag der Arbeit'),('BE','2025-05-08','Befreiungstag'),('BE','2025-05-29','Christi Himmelfahrt'),
  ('BE','2025-06-09','Pfingstmontag'),('BE','2025-10-03','Tag der Deutschen Einheit'),('BE','2025-12-25','1. Weihnachtstag'),('BE','2025-12-26','2. Weihnachtstag'),
  ('BE','2026-01-01','Neujahr'),('BE','2026-03-08','Frauentag'),('BE','2026-04-03','Karfreitag'),('BE','2026-04-06','Ostermontag'),
  ('BE','2026-05-01','Tag der Arbeit'),('BE','2026-05-14','Christi Himmelfahrt'),('BE','2026-05-25','Pfingstmontag'),
  ('BE','2026-10-03','Tag der Deutschen Einheit'),('BE','2026-12-25','1. Weihnachtstag'),('BE','2026-12-26','2. Weihnachtstag')
on conflict (bundesland, "date") do nothing;

create table if not exists public.work_settings (
  id uuid default gen_random_uuid() primary key,
  bundesland text default 'BE',
  work_days int[] default array[1,2,3,4,5],
  hours_per_day numeric(4,2) default 8,
  updated_at timestamptz default now()
);
insert into public.work_settings (id, bundesland, work_days, hours_per_day)
select gen_random_uuid(), 'BE', array[1,2,3,4,5], 8
where not exists (select 1 from public.work_settings limit 1);
alter table public.work_settings enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'work_settings' loop
    execute format('drop policy if exists %I on public.work_settings', r.policyname);
  end loop;
end $$;
create policy "Authenticated can read work_settings" on public.work_settings for select using (auth.uid() is not null);
create policy "Admins can manage work_settings" on public.work_settings for all using (public.is_admin());

create table if not exists public.work_free_days (
  id uuid default gen_random_uuid() primary key,
  "date" date not null unique,
  type text not null,
  label text,
  created_at timestamptz default now()
);
alter table public.work_free_days enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'work_free_days' loop
    execute format('drop policy if exists %I on public.work_free_days', r.policyname);
  end loop;
end $$;
create policy "Authenticated can read work_free_days" on public.work_free_days for select using (auth.uid() is not null);
create policy "Admins can manage work_free_days" on public.work_free_days for all using (public.is_admin());

-- Phase 2: Urlaubsverwaltung
create table if not exists public.leave_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  leave_type text not null default 'urlaub' check (leave_type in ('urlaub', 'krank', 'sonderurlaub', 'unbezahlt', 'sonstiges')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  days_count numeric(4,2),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint leave_requests_dates check (to_date >= from_date)
);
do $$
begin
  alter table public.leave_requests drop constraint if exists leave_requests_approved_by_fkey;
  alter table public.leave_requests
    add constraint leave_requests_approved_by_fkey foreign key (approved_by) references public.profiles(id) on delete set null;
exception
  when duplicate_object then null;
end $$;
-- Indizes siehe Abschn. 8 (idx_leave_requests_user_status_dates u. a.)
create index if not exists idx_leave_requests_dates on public.leave_requests(from_date, to_date);
create index if not exists idx_leave_requests_status on public.leave_requests(status);
alter table public.leave_requests enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'leave_requests' loop
    execute format('drop policy if exists %I on public.leave_requests', r.policyname);
  end loop;
end $$;
create policy "User can read own leave_requests" on public.leave_requests for select using (user_id = auth.uid());
create policy "User can insert own leave_requests" on public.leave_requests for insert with check (user_id = auth.uid());
create policy "Admin and teamleiter can insert leave_requests" on public.leave_requests for insert with check (
  public.is_admin()
  or (public.is_teamleiter() and user_id in (
    select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null
  ))
);
create policy "Admin and teamleiter can read all leave_requests" on public.leave_requests for select using (
  public.is_admin() or (public.is_teamleiter() and user_id in (select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null))
);
create policy "Admin and teamleiter can update leave_requests" on public.leave_requests for update using (
  public.is_admin() or (public.is_teamleiter() and user_id in (select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null))
);

-- Teilgenehmigung (Spalten vor approve_leave_request / get_leave_requests in Abschn. 5)
alter table public.leave_requests add column if not exists approved_from_date date;
alter table public.leave_requests add column if not exists approved_to_date date;

create table if not exists public.leave_entitlements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  year int not null,
  days_total numeric(4,2) not null default 0,
  days_carried_over numeric(4,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, year)
);
alter table public.leave_entitlements enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'leave_entitlements' loop
    execute format('drop policy if exists %I on public.leave_entitlements', r.policyname);
  end loop;
end $$;
create policy "User can read own leave_entitlements" on public.leave_entitlements for select using (user_id = auth.uid());
create policy "Admin and teamleiter can read leave_entitlements" on public.leave_entitlements for select using (
  public.is_admin() or (public.is_teamleiter() and user_id in (select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null))
);
create policy "Admins can manage leave_entitlements" on public.leave_entitlements for all using (public.is_admin());

alter table public.profiles add column if not exists vacation_days_per_year numeric(4,2) default null;
-- Optional: Frist Resturlaub VJ pro Mitarbeiter (Override; global in admin_config)
alter table public.profiles add column if not exists urlaub_vj_deadline_month smallint;
alter table public.profiles add column if not exists urlaub_vj_deadline_day smallint;

alter table public.profiles add column if not exists bundesland text default null;
alter table public.profiles add column if not exists work_days int[] default null;
alter table public.profiles add column if not exists hours_per_day numeric(4,2) default null;
-- AZK: Soll aus Stunden/Tag × Arbeitstage (kein manuelles Soll Min/Monat mehr); nur Tage ab Eintritt bis Austritt
alter table public.profiles add column if not exists employment_start_date date default null;
alter table public.profiles add column if not exists employment_end_date date default null;

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

-- Manuelles Nachtragen (Portal Admin/Teamleiter): neuer Zeiteintrag + Log (old_* = NULL bei Neuanlage)
alter table public.time_entry_edit_log alter column old_start drop not null;
alter table public.time_entry_edit_log alter column old_end drop not null;

create or replace function public.insert_time_entry_admin(
  p_user_id uuid,
  p_date date,
  p_start timestamptz,
  p_end timestamptz,
  p_reason text,
  p_reason_code text default 'nachreichung',
  p_order_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
begin
  if p_user_id is null or p_date is null or p_start is null then
    raise exception 'Benutzer, Arbeitstag und Startzeit sind erforderlich';
  end if;
  if p_end is not null and p_end <= p_start then
    raise exception 'Ende muss nach Start liegen';
  end if;
  if not public.is_admin() and not (
    public.is_teamleiter() and exists (
      select 1 from public.profiles p
      where p.id = p_user_id and p.team_id = public.get_my_team_id() and p.team_id is not null
    )
  ) then
    raise exception 'Nur Admin oder Teamleiter (eigenes Team) darf Zeiten nachtragen';
  end if;

  insert into public.time_entries (
    user_id,
    date,
    start,
    "end",
    notes,
    order_id,
    approval_status,
    approved_by,
    approved_at,
    updated_at
  )
  values (
    p_user_id,
    p_date,
    p_start,
    p_end,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_order_id,
    'approved',
    auth.uid(),
    now(),
    now()
  )
  returning id into v_new_id;

  insert into public.time_entry_edit_log (time_entry_id, edited_by, reason, reason_code, old_start, old_end, new_start, new_end)
  values (
    v_new_id,
    auth.uid(),
    coalesce(nullif(trim(p_reason), ''), 'Manuell nachtragen'),
    p_reason_code,
    null,
    null,
    p_start,
    p_end
  );

  return v_new_id;
end;
$$;
grant execute on function public.insert_time_entry_admin(uuid, date, timestamptz, timestamptz, text, text, uuid, text) to authenticated;

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

-- Firmenweite Zustellung Monteursbericht an Kunden (Abschluss-Auftrag)
-- 4x.1 Basistabelle
create table if not exists public.monteur_report_settings (
  id int primary key default 1 check (id = 1),
  customer_delivery_mode text not null default 'none'
  check (customer_delivery_mode in ('none', 'email_auto', 'email_manual', 'portal_notify')),
  updated_at timestamptz default now()
);
-- 4x.2 Nachmigrationen (Legacy-DBs)
alter table public.monteur_report_settings add column if not exists maintenance_digest_local_time text default '07:00';
alter table public.monteur_report_settings add column if not exists maintenance_digest_timezone text default 'Europe/Berlin';
alter table public.monteur_report_settings add column if not exists app_public_url text default null;
alter table public.monteur_report_settings add column if not exists wartung_checkliste_modus text default 'detail';
alter table public.monteur_report_settings add column if not exists pruefprotokoll_address_mode text default 'both';
alter table public.monteur_report_settings add column if not exists mangel_neuer_auftrag_default boolean default true;
alter table public.monteur_report_settings add column if not exists portal_share_monteur_report_pdf boolean default true;
alter table public.monteur_report_settings add column if not exists portal_share_pruefprotokoll_pdf boolean default true;
alter table public.monteur_report_settings add column if not exists portal_timeline_show_planned boolean default false;
alter table public.monteur_report_settings add column if not exists portal_timeline_show_termin boolean default true;
alter table public.monteur_report_settings add column if not exists portal_timeline_show_in_progress boolean default true;
-- 4x.3 Constraints / Defaults
do $$
begin
  alter table public.monteur_report_settings drop constraint if exists monteur_report_settings_wartung_checkliste_modus_check;
  alter table public.monteur_report_settings drop constraint if exists monteur_report_settings_pruefprotokoll_address_mode_check;
  alter table public.monteur_report_settings
    add constraint monteur_report_settings_wartung_checkliste_modus_check
    check (wartung_checkliste_modus is null or wartung_checkliste_modus in ('compact', 'detail'));
  alter table public.monteur_report_settings
    add constraint monteur_report_settings_pruefprotokoll_address_mode_check
    check (pruefprotokoll_address_mode is null or pruefprotokoll_address_mode in ('both', 'bv_only'));
exception
  when others then null;
end $$;
update public.monteur_report_settings set wartung_checkliste_modus = coalesce(wartung_checkliste_modus, 'detail') where id = 1;
update public.monteur_report_settings set pruefprotokoll_address_mode = coalesce(pruefprotokoll_address_mode, 'both') where id = 1;
update public.monteur_report_settings set mangel_neuer_auftrag_default = coalesce(mangel_neuer_auftrag_default, true) where id = 1;
update public.monteur_report_settings
set
  portal_share_monteur_report_pdf = coalesce(portal_share_monteur_report_pdf, true),
  portal_share_pruefprotokoll_pdf = coalesce(portal_share_pruefprotokoll_pdf, true),
  portal_timeline_show_planned = coalesce(portal_timeline_show_planned, false),
  portal_timeline_show_termin = coalesce(portal_timeline_show_termin, true),
  portal_timeline_show_in_progress = coalesce(portal_timeline_show_in_progress, true)
where id = 1;
insert into public.monteur_report_settings (id, customer_delivery_mode)
values (1, 'none')
on conflict (id) do nothing;
-- 4x.4 RLS / Policies
alter table public.monteur_report_settings enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'monteur_report_settings' loop
    execute format('drop policy if exists %I on public.monteur_report_settings', r.policyname);
  end loop;
end $$;
create policy "Authenticated read monteur_report_settings" on public.monteur_report_settings
  for select using (auth.uid() is not null);
create policy "Admin manage monteur_report_settings" on public.monteur_report_settings
  for all using (public.is_admin());

-- App-Wartungsmodus (Singleton): Hinweistext + serverseitiger Write-Guard
create table if not exists public.app_maintenance_mode (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  message text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.app_maintenance_mode (id, enabled)
values (1, false)
on conflict (id) do nothing;
alter table public.app_maintenance_mode enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'app_maintenance_mode' loop
    execute format('drop policy if exists %I on public.app_maintenance_mode', r.policyname);
  end loop;
end $$;
create policy "Authenticated read app_maintenance_mode" on public.app_maintenance_mode
  for select using (auth.uid() is not null);
create policy "Admin manage app_maintenance_mode" on public.app_maintenance_mode
  for all using (public.is_admin());

create or replace function public.is_app_maintenance_mode()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select enabled from public.app_maintenance_mode where id = 1), false);
$$;
grant execute on function public.is_app_maintenance_mode() to authenticated;

create or replace function public.guard_app_maintenance_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_app_maintenance_mode() and not public.is_admin() then
    raise exception 'APP_MAINTENANCE_MODE_ACTIVE'
      using errcode = 'P0001',
            hint = 'Die App befindet sich im Wartungsmodus. Schreibzugriffe sind vorübergehend deaktiviert.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  tbl text;
  tbls text[] := array[
    'customers',
    'bvs',
    'objects',
    'object_photos',
    'object_documents',
    'maintenance_contracts',
    'orders',
    'order_completions',
    'maintenance_reports',
    'maintenance_report_photos',
    'maintenance_report_smoke_detectors',
    'defect_followups',
    'component_settings',
    'door_field_catalog'
  ];
begin
  foreach tbl in array tbls loop
    execute format('drop trigger if exists trg_guard_app_maintenance_write on public.%I', tbl);
    execute format(
      'create trigger trg_guard_app_maintenance_write before insert or update or delete on public.%I for each row execute function public.guard_app_maintenance_write()',
      tbl
    );
  end loop;
end $$;

create table if not exists public.audit_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id), action text not null, table_name text not null, record_id text,
  created_at timestamptz default now()
);
do $$
begin
  alter table public.audit_log drop constraint if exists audit_log_user_id_fkey;
  alter table public.audit_log
    add constraint audit_log_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
exception
  when duplicate_object then null;
end $$;
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
  tbls text[] := array['customers','bvs','objects','object_photos','object_documents','maintenance_contracts','orders','order_completions','time_entries','time_breaks','profiles','maintenance_reports','maintenance_report_photos','maintenance_report_smoke_detectors','defect_followups','customer_portal_users','portal_user_object_visibility'];
begin
  foreach t in array tbls loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('drop trigger if exists audit_%I on public.%I', t, t);
      execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_trigger_fn()', t, t);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 5. RPC FUNCTIONS
-- -----------------------------------------------------------------------------

create or replace function public.get_my_role()
returns text language sql security definer set search_path = public stable as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;
grant execute on function public.get_my_role() to authenticated;

drop function if exists public.get_all_profiles_for_admin();
create or replace function public.get_all_profiles_for_admin()
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  role text,
  hours_per_day numeric,
  employment_start_date date,
  employment_end_date date,
  team_id uuid,
  team_name text
)
language sql security definer set search_path = public stable as $$
  select p.id, p.email, p.first_name, p.last_name, p.role, p.hours_per_day, p.employment_start_date, p.employment_end_date, p.team_id, t.name as team_name
  from public.profiles p
  left join public.teams t on t.id = p.team_id
  where auth.uid() is not null
  order by p.email nulls last;
$$;
grant execute on function public.get_all_profiles_for_admin() to authenticated;

-- Für Arbeitszeitenportal: nur Profile, die der User sehen darf (Admin: alle mit Zeiterfassung-Rollen, Teamleiter: gleiches Team).
drop function if exists public.get_profiles_for_zeiterfassung();
create or replace function public.get_profiles_for_zeiterfassung()
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  role text,
  hours_per_day numeric,
  employment_start_date date,
  employment_end_date date,
  vacation_days_per_year numeric,
  urlaub_vj_deadline_month smallint,
  urlaub_vj_deadline_day smallint
)
language sql security definer set search_path = public stable as $$
  select p.id, p.email, p.first_name, p.last_name, p.role, p.hours_per_day, p.employment_start_date, p.employment_end_date, p.vacation_days_per_year,
    p.urlaub_vj_deadline_month, p.urlaub_vj_deadline_day
  from public.profiles p
  where p.role in ('admin', 'teamleiter', 'mitarbeiter', 'operator', 'leser')
  and (public.is_admin() or (public.is_teamleiter() and p.team_id = public.get_my_team_id() and p.team_id is not null))
  order by p.email nulls last;
$$;
grant execute on function public.get_profiles_for_zeiterfassung() to authenticated;

-- RPC: Berechnet Soll-Minuten für User/Monat (inkl. genehmigter Urlaubstage)
create or replace function public.calc_soll_minutes_for_month(
  p_user_id uuid,
  p_year int,
  p_month int
)
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_bundesland text;
  v_work_days int[];
  v_hours_per_day numeric;
  v_first date;
  v_last date;
  v_d date;
  v_dow int;
  v_count int := 0;
  v_ws record;
  v_p record;
  v_emp_start date;
  v_emp_end date;
begin
  select bundesland, work_days, hours_per_day into v_ws from public.work_settings limit 1;
  select p.bundesland, p.work_days, p.hours_per_day, p.employment_start_date, p.employment_end_date
  into v_p from public.profiles p where p.id = p_user_id limit 1;
  v_bundesland := coalesce(v_p.bundesland, v_ws.bundesland, 'BE');
  v_work_days := coalesce(v_p.work_days, v_ws.work_days, array[1,2,3,4,5]);
  v_hours_per_day := coalesce(v_p.hours_per_day, v_ws.hours_per_day, 8);
  v_emp_start := v_p.employment_start_date;
  v_emp_end := v_p.employment_end_date;
  v_first := make_date(p_year, p_month, 1);
  v_last := (v_first + interval '1 month' - interval '1 day')::date;
  for v_d in select generate_series(v_first, v_last, '1 day'::interval)::date loop
    if v_emp_start is not null and v_d < v_emp_start then
      continue;
    end if;
    if v_emp_end is not null and v_d > v_emp_end then
      continue;
    end if;
    v_dow := extract(dow from v_d)::int;
    if v_dow = any(v_work_days) then
      if not exists (select 1 from public.public_holidays where bundesland = v_bundesland and "date" = v_d) then
        if not exists (select 1 from public.work_free_days where "date" = v_d) then
          if not exists (
            select 1 from public.leave_requests lr
            where lr.user_id = p_user_id and lr.status = 'approved'
            and v_d >= lr.from_date and v_d <= lr.to_date
          ) then
            v_count := v_count + 1;
          end if;
        end if;
      end if;
    end if;
  end loop;
  return (v_count * v_hours_per_day * 60)::int;
end;
$$;
grant execute on function public.calc_soll_minutes_for_month(uuid, int, int) to authenticated;

-- RPC: Soll-Minuten für ein ganzes Jahr (Summe aller 12 Monate)
create or replace function public.calc_soll_minutes_for_year(
  p_user_id uuid,
  p_year int
)
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_sum int;
begin
  select coalesce(sum(public.calc_soll_minutes_for_month(p_user_id, p_year, m::int)), 0)
  into v_sum
  from generate_series(1, 12) m;
  return v_sum;
end;
$$;
grant execute on function public.calc_soll_minutes_for_year(uuid, int) to authenticated;

-- RPC: Soll-Minuten für ein Datumsintervall (gleiche Logik wie Monat, aber von p_from bis p_to)
-- Für Jahresstand „bis heute“: p_from = (Jahr)-01-01, p_to = min(heute, (Jahr)-12-31)
create or replace function public.calc_soll_minutes_for_date_range(
  p_user_id uuid,
  p_from date,
  p_to date
)
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_bundesland text;
  v_work_days int[];
  v_hours_per_day numeric;
  v_d date;
  v_dow int;
  v_count int := 0;
  v_ws record;
  v_p record;
  v_emp_start date;
  v_emp_end date;
begin
  if p_from > p_to then
    return 0;
  end if;
  select bundesland, work_days, hours_per_day into v_ws from public.work_settings limit 1;
  select p.bundesland, p.work_days, p.hours_per_day, p.employment_start_date, p.employment_end_date
  into v_p from public.profiles p where p.id = p_user_id limit 1;
  v_bundesland := coalesce(v_p.bundesland, v_ws.bundesland, 'BE');
  v_work_days := coalesce(v_p.work_days, v_ws.work_days, array[1,2,3,4,5]);
  v_hours_per_day := coalesce(v_p.hours_per_day, v_ws.hours_per_day, 8);
  v_emp_start := v_p.employment_start_date;
  v_emp_end := v_p.employment_end_date;
  for v_d in select generate_series(p_from, p_to, '1 day'::interval)::date loop
    if v_emp_start is not null and v_d < v_emp_start then
      continue;
    end if;
    if v_emp_end is not null and v_d > v_emp_end then
      continue;
    end if;
    v_dow := extract(dow from v_d)::int;
    if v_dow = any(v_work_days) then
      if not exists (select 1 from public.public_holidays where bundesland = v_bundesland and "date" = v_d) then
        if not exists (select 1 from public.work_free_days where "date" = v_d) then
          if not exists (
            select 1 from public.leave_requests lr
            where lr.user_id = p_user_id and lr.status = 'approved'
            and v_d >= lr.from_date and v_d <= lr.to_date
          ) then
            v_count := v_count + 1;
          end if;
        end if;
      end if;
    end if;
  end loop;
  return (v_count * v_hours_per_day * 60)::int;
end;
$$;
grant execute on function public.calc_soll_minutes_for_date_range(uuid, date, date) to authenticated;

-- RPC: Summe Arbeitsminuten (ohne Pausen) für User in Datumsbereich
create or replace function public.get_work_minutes_for_user_in_range(
  p_user_id uuid,
  p_from_date date,
  p_to_date date
)
returns int
language sql
security definer
set search_path = public
stable
as $$
  with break_mins as (
    select tb.time_entry_id, sum(extract(epoch from (tb."end" - tb.start))::int / 60) as mins
    from public.time_breaks tb
    where tb."end" is not null
      and tb.time_entry_id in (
        select te2.id from public.time_entries te2
        where te2.user_id = p_user_id and te2.date >= p_from_date and te2.date <= p_to_date and te2."end" is not null
      )
    group by tb.time_entry_id
  )
  select coalesce(sum(greatest(0,
    extract(epoch from (te."end" - te.start))::int / 60 - coalesce(bm.mins, 0)
  )), 0)::int
  from public.time_entries te
  left join break_mins bm on bm.time_entry_id = te.id
  where te.user_id = p_user_id
    and te.date >= p_from_date and te.date <= p_to_date
    and te."end" is not null;
$$;
grant execute on function public.get_work_minutes_for_user_in_range(uuid, date, date) to authenticated;

-- RPC: Zählt Arbeitstage in einem Datumsbereich (für Urlaubsanträge)
create or replace function public.count_work_days_in_range(
  p_user_id uuid,
  p_from_date date,
  p_to_date date
)
returns numeric
language plpgsql security definer set search_path = public stable as $$
declare
  v_bundesland text;
  v_work_days int[];
  v_d date;
  v_dow int;
  v_count int := 0;
  v_ws record;
  v_p record;
  v_emp_start date;
  v_emp_end date;
begin
  select bundesland, work_days into v_ws from public.work_settings limit 1;
  select p.bundesland, p.work_days, p.employment_start_date, p.employment_end_date
  into v_p from public.profiles p where p.id = p_user_id limit 1;
  v_bundesland := coalesce(v_p.bundesland, v_ws.bundesland, 'BE');
  v_work_days := coalesce(v_p.work_days, v_ws.work_days, array[1,2,3,4,5]);
  v_emp_start := v_p.employment_start_date;
  v_emp_end := v_p.employment_end_date;
  for v_d in select generate_series(p_from_date, p_to_date, '1 day'::interval)::date loop
    if v_emp_start is not null and v_d < v_emp_start then
      continue;
    end if;
    if v_emp_end is not null and v_d > v_emp_end then
      continue;
    end if;
    v_dow := extract(dow from v_d)::int;
    if v_dow = any(v_work_days) then
      if not exists (select 1 from public.public_holidays where bundesland = v_bundesland and "date" = v_d) then
        if not exists (select 1 from public.work_free_days where "date" = v_d) then
          v_count := v_count + 1;
        end if;
      end if;
    end if;
  end loop;
  return v_count;
end;
$$;
grant execute on function public.count_work_days_in_range(uuid, date, date) to authenticated;

-- RPC: Urlaubsantrag genehmigen oder ablehnen (optional Teilgenehmigung: p_approved_from / p_approved_to)
drop function if exists public.approve_leave_request(uuid, boolean, text);
create or replace function public.approve_leave_request(
  p_request_id uuid,
  p_approved boolean,
  p_rejection_reason text default null,
  p_approved_from date default null,
  p_approved_to date default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_from_date date;
  v_to_date date;
  v_eff_from date;
  v_eff_to date;
  v_days numeric;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert';
  end if;
  if not public.is_admin() and not (
    public.is_teamleiter() and exists (
      select 1 from public.leave_requests lr
      join public.profiles p on p.id = lr.user_id and p.team_id = public.get_my_team_id() and p.team_id is not null
      where lr.id = p_request_id
    )
  ) then
    raise exception 'Nur Admin oder Teamleiter (eigenes Team) darf Urlaubsanträge bearbeiten';
  end if;
  select user_id, from_date, to_date into v_user_id, v_from_date, v_to_date
  from public.leave_requests where id = p_request_id;
  if v_user_id is null then
    raise exception 'Antrag nicht gefunden';
  end if;
  if p_approved then
    v_eff_from := coalesce(p_approved_from, v_from_date);
    v_eff_to := coalesce(p_approved_to, v_to_date);
    if v_eff_from > v_eff_to then
      raise exception 'Genehmigter Zeitraum ungültig (Von nach Bis).';
    end if;
    if v_eff_from < v_from_date or v_eff_to > v_to_date then
      raise exception 'Genehmigter Zeitraum muss innerhalb des Antrags liegen.';
    end if;
    v_days := public.count_work_days_in_range(v_user_id, v_eff_from, v_eff_to);
    update public.leave_requests
    set status = 'approved', days_count = v_days,
        approved_from_date = v_eff_from, approved_to_date = v_eff_to,
        approved_by = auth.uid(), approved_at = now(),
        rejection_reason = null, updated_at = now()
    where id = p_request_id;
  else
    update public.leave_requests
    set status = 'rejected', approved_by = auth.uid(), approved_at = now(),
        rejection_reason = nullif(trim(p_rejection_reason), ''), updated_at = now(),
        approved_from_date = null, approved_to_date = null
    where id = p_request_id;
  end if;
end;
$$;
grant execute on function public.approve_leave_request(uuid, boolean, text, date, date) to authenticated;

-- RPC: Urlaubsanträge abrufen (Admin: alle/gefiltert, Teamleiter: Team, User: eigene)
drop function if exists public.get_leave_requests(uuid, date, date, text);
create or replace function public.get_leave_requests(
  p_user_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_status text default null
)
returns table (
  id uuid,
  user_id uuid,
  user_email text,
  user_name text,
  from_date date,
  to_date date,
  leave_type text,
  status text,
  days_count numeric,
  approved_from_date date,
  approved_to_date date,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select lr.id, lr.user_id, p.email as user_email,
    trim(concat_ws(' ', p.first_name, p.last_name)) as user_name,
    lr.from_date, lr.to_date, lr.leave_type, lr.status, lr.days_count,
    lr.approved_from_date, lr.approved_to_date,
    lr.approved_by, lr.approved_at, lr.rejection_reason, lr.notes, lr.created_at
  from public.leave_requests lr
  join public.profiles p on p.id = lr.user_id
  where (
    (p_user_id is null and (
      lr.user_id = auth.uid()
      or public.is_admin()
      or (public.is_teamleiter() and p.team_id = public.get_my_team_id() and p.team_id is not null)
    ))
    or (p_user_id is not null and lr.user_id = p_user_id and (
      auth.uid() = p_user_id
      or public.is_admin()
      or (public.is_teamleiter() and p.team_id = public.get_my_team_id() and p.team_id is not null)
    ))
  )
  and (p_date_from is null or lr.to_date >= p_date_from)
  and (p_date_to is null or lr.from_date <= p_date_to)
  and (p_status is null or lr.status = p_status)
  order by lr.from_date desc, lr.created_at desc;
$$;
grant execute on function public.get_leave_requests(uuid, date, date, text) to authenticated;

-- RPC: AZK-Stammdaten (Std/Tag individuell, Eintritt/Austritt) – Monatssoll = Arbeitstage × Std/Tag (berechnet)
drop function if exists public.update_profile_soll_minutes(uuid, int, int);
create or replace function public.update_profile_azk_stammdaten(
  p_profile_id uuid,
  p_hours_per_day numeric,
  p_employment_start date,
  p_employment_end date
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller_admin boolean;
  v_caller_team_id uuid;
  v_target_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert';
  end if;
  if p_employment_start is not null and p_employment_end is not null and p_employment_end < p_employment_start then
    raise exception 'Austritt darf nicht vor Eintritt liegen.';
  end if;
  if p_hours_per_day is not null and (p_hours_per_day < 0 or p_hours_per_day > 24) then
    raise exception 'Stunden pro Tag zwischen 0 und 24.';
  end if;
  v_caller_admin := public.is_admin();
  if v_caller_admin then
    update public.profiles
    set hours_per_day = p_hours_per_day,
        employment_start_date = p_employment_start,
        employment_end_date = p_employment_end,
        soll_minutes_per_month = null,
        soll_minutes_per_week = null,
        updated_at = now()
    where id = p_profile_id;
    return;
  end if;
  if public.is_teamleiter() then
    select team_id into v_caller_team_id from public.profiles where id = auth.uid() limit 1;
    select team_id into v_target_team_id from public.profiles where id = p_profile_id limit 1;
    if v_caller_team_id is not null and v_caller_team_id = v_target_team_id then
      update public.profiles
      set hours_per_day = p_hours_per_day,
          employment_start_date = p_employment_start,
          employment_end_date = p_employment_end,
          soll_minutes_per_month = null,
          soll_minutes_per_week = null,
          updated_at = now()
      where id = p_profile_id;
      return;
    end if;
  end if;
  raise exception 'Keine Berechtigung, AZK-Stammdaten zu ändern';
end;
$$;
grant execute on function public.update_profile_azk_stammdaten(uuid, numeric, date, date) to authenticated;

create or replace function public.update_profile_vacation_days(p_profile_id uuid, p_vacation_days numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller_admin boolean;
  v_caller_team_id uuid;
  v_target_team_id uuid;
  v_year int;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert';
  end if;
  v_caller_admin := public.is_admin();
  if v_caller_admin then
    update public.profiles set vacation_days_per_year = p_vacation_days, updated_at = now() where id = p_profile_id;
    -- leave_entitlements für aktuelles und nächstes Jahr aus Stammdaten übernehmen
    v_year := extract(year from current_date)::int;
    insert into public.leave_entitlements (user_id, year, days_total, days_carried_over, updated_at)
    values (p_profile_id, v_year, coalesce(p_vacation_days, 0), 0, now())
    on conflict (user_id, year) do update set days_total = coalesce(p_vacation_days, 0), updated_at = now();
    insert into public.leave_entitlements (user_id, year, days_total, days_carried_over, updated_at)
    values (p_profile_id, v_year + 1, coalesce(p_vacation_days, 0), 0, now())
    on conflict (user_id, year) do update set days_total = coalesce(p_vacation_days, 0), updated_at = now();
    return;
  end if;
  if public.is_teamleiter() then
    select team_id into v_caller_team_id from public.profiles where id = auth.uid() limit 1;
    select team_id into v_target_team_id from public.profiles where id = p_profile_id limit 1;
    if v_caller_team_id is not null and v_caller_team_id = v_target_team_id then
      update public.profiles set vacation_days_per_year = p_vacation_days, updated_at = now() where id = p_profile_id;
      v_year := extract(year from current_date)::int;
      insert into public.leave_entitlements (user_id, year, days_total, days_carried_over, updated_at)
      values (p_profile_id, v_year, coalesce(p_vacation_days, 0), 0, now())
      on conflict (user_id, year) do update set days_total = coalesce(p_vacation_days, 0), updated_at = now();
      insert into public.leave_entitlements (user_id, year, days_total, days_carried_over, updated_at)
      values (p_profile_id, v_year + 1, coalesce(p_vacation_days, 0), 0, now())
      on conflict (user_id, year) do update set days_total = coalesce(p_vacation_days, 0), updated_at = now();
      return;
    end if;
  end if;
  raise exception 'Keine Berechtigung, Urlaubstage zu ändern';
end;
$$;
grant execute on function public.update_profile_vacation_days(uuid, numeric) to authenticated;

-- Einmal-Migration: Bestehende Urlaubstage aus Stammdaten in leave_entitlements übernehmen
insert into public.leave_entitlements (user_id, year, days_total, days_carried_over, updated_at)
select p.id, extract(year from current_date)::int, p.vacation_days_per_year, 0, now()
from public.profiles p
where p.vacation_days_per_year is not null and p.vacation_days_per_year > 0
on conflict (user_id, year) do update set days_total = excluded.days_total, updated_at = now();
insert into public.leave_entitlements (user_id, year, days_total, days_carried_over, updated_at)
select p.id, extract(year from current_date)::int + 1, p.vacation_days_per_year, 0, now()
from public.profiles p
where p.vacation_days_per_year is not null and p.vacation_days_per_year > 0
on conflict (user_id, year) do update set days_total = excluded.days_total, updated_at = now();

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
           greatest(lm.d, o.last_door_maintenance_date) as last_maintenance_date,
           case when o.maintenance_interval_months is not null and o.maintenance_interval_months > 0
             then (coalesce(greatest(lm.d, o.last_door_maintenance_date), current_date) + (o.maintenance_interval_months || ' months')::interval)::date else null end as next_maintenance_date
    from public.objects o left join last_maint lm on lm.object_id = o.id
    where o.archived_at is null
      and o.maintenance_interval_months is not null and o.maintenance_interval_months > 0
  )
  select ob.object_id, c.id as customer_id, c.name as customer_name, b.id as bv_id, b.name as bv_name, ob.internal_id,
         ob.object_name, ob.object_room, ob.object_floor, ob.object_manufacturer,
         ob.maintenance_interval_months, ob.last_maintenance_date, ob.next_maintenance_date,
         case when ob.next_maintenance_date is null then 'ok' when ob.next_maintenance_date < current_date then 'overdue'
              when ob.next_maintenance_date <= current_date + interval '30 days' then 'due_soon' else 'ok' end as status,
         case when ob.next_maintenance_date is not null then (ob.next_maintenance_date - current_date)::int else null end as days_until_due
  from objs ob left join public.bvs b on b.id = ob.bv_id join public.customers c on c.id = coalesce(b.customer_id, ob.customer_id)
  where auth.uid() is not null
    and c.archived_at is null
    and (b.id is null or b.archived_at is null)
    and ((c.demo_user_id is null and not public.is_demo()) or (c.demo_user_id = auth.uid()));
$$;
grant execute on function public.get_maintenance_reminders() to authenticated;

-- Für Edge Function (Service Role): gleiche Sicht wie get_maintenance_reminders, aber für feste User-ID (kein JWT).
drop function if exists public.get_maintenance_reminders_for_user_digest(uuid);
create or replace function public.get_maintenance_reminders_for_user_digest(p_user_id uuid)
returns table (object_id uuid, customer_id uuid, customer_name text, bv_id uuid, bv_name text, internal_id text,
  object_name text, object_room text, object_floor text, object_manufacturer text,
  maintenance_interval_months int, last_maintenance_date date, next_maintenance_date date, status text, days_until_due int)
language sql security definer set search_path = public stable as $$
  with last_maint as (select object_id, max(maintenance_date) as d from public.maintenance_reports group by object_id),
  objs as (
    select o.id as object_id, o.bv_id, o.customer_id, o.internal_id, o.name as object_name, o.room as object_room, o.floor as object_floor, o.manufacturer as object_manufacturer,
           o.maintenance_interval_months,
           greatest(lm.d, o.last_door_maintenance_date) as last_maintenance_date,
           case when o.maintenance_interval_months is not null and o.maintenance_interval_months > 0
             then (coalesce(greatest(lm.d, o.last_door_maintenance_date), current_date) + (o.maintenance_interval_months || ' months')::interval)::date else null end as next_maintenance_date
    from public.objects o left join last_maint lm on lm.object_id = o.id
    where o.archived_at is null
      and o.maintenance_interval_months is not null and o.maintenance_interval_months > 0
  )
  select ob.object_id, c.id as customer_id, c.name as customer_name, b.id as bv_id, b.name as bv_name, ob.internal_id,
         ob.object_name, ob.object_room, ob.object_floor, ob.object_manufacturer,
         ob.maintenance_interval_months, ob.last_maintenance_date, ob.next_maintenance_date,
         case when ob.next_maintenance_date is null then 'ok' when ob.next_maintenance_date < current_date then 'overdue'
              when ob.next_maintenance_date <= current_date + interval '30 days' then 'due_soon' else 'ok' end as status,
         case when ob.next_maintenance_date is not null then (ob.next_maintenance_date - current_date)::int else null end as days_until_due
  from objs ob left join public.bvs b on b.id = ob.bv_id join public.customers c on c.id = coalesce(b.customer_id, ob.customer_id)
  where p_user_id is not null
    and c.archived_at is null
    and (b.id is null or b.archived_at is null)
    and ((c.demo_user_id is null and not exists (select 1 from public.profiles pr where pr.id = p_user_id and pr.role = 'demo'))
      or (c.demo_user_id = p_user_id));
$$;
grant execute on function public.get_maintenance_reminders_for_user_digest(uuid) to service_role;

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
    and c.archived_at is null
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
    and c.archived_at is null
    and b.archived_at is null
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
    and o.archived_at is null
    and c.archived_at is null
    and (b.id is null or b.archived_at is null)
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

-- -----------------------------------------------------------------------------
-- 5b. LIZENZMODELL
-- -----------------------------------------------------------------------------
-- Hinweis zur Konsistenz:
-- Mandantenweites Branding/Portal-URLs (z. B. `tenants.kundenportal_url`) liegen in der
-- Lizenzportal-DB (`supabase-license-portal.sql`), nicht in der Haupt-App-DB.
-- Die Haupt-App erhält diese Werte über die Lizenz-API (`design.kundenportal_url`).

create table if not exists public.license (
  id uuid primary key default gen_random_uuid(),
  tier text not null default 'professional',
  valid_until date,
  max_customers int,
  max_users int,
  features jsonb default '{}'::jsonb,
  license_number text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'license' and column_name = 'license_number') then
    alter table public.license add column license_number text;
  end if;
end $$;
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

-- Lizenznummer in DB: Admin speichert einmalig, alle Nutzer holen sie nach Login
drop function if exists public.get_license_number();
create or replace function public.get_license_number()
returns text language sql security definer set search_path = public stable as $$
  select nullif(trim(license_number), '') from public.license limit 1;
$$;
grant execute on function public.get_license_number() to authenticated;

drop function if exists public.set_license_number(text);
create or replace function public.set_license_number(p_number text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_updated int;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins dürfen die Lizenznummer setzen.';
  end if;
  -- Supabase erzwingt oft „UPDATE mit WHERE“ (safe_update); ohne WHERE schlägt der Aufruf fehl.
  select l.id into v_id from public.license l order by l.created_at asc nulls last limit 1;
  if v_id is not null then
    update public.license
    set license_number = nullif(trim(p_number), ''), updated_at = now()
    where id = v_id;
    get diagnostics v_updated = row_count;
  else
    v_updated := 0;
  end if;
  if v_updated = 0 then
    insert into public.license (tier, license_number) values ('professional', nullif(trim(p_number), ''));
  end if;
end;
$$;
grant execute on function public.set_license_number(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5c. Standortabfrage (Mitarbeiter senden Standort, Admin/Teamleiter können abrufen)
-- -----------------------------------------------------------------------------
-- 5c.1 admin_config + Feature-Flag-RPCs

-- admin_config muss vor employee_current_location-Policies existieren (Policy referenziert get_standortabfrage_teamleiter_allowed)
create table if not exists public.admin_config (
  key text primary key,
  value jsonb not null
);
alter table public.admin_config enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'admin_config' loop
    execute format('drop policy if exists %I on public.admin_config', r.policyname);
  end loop;
end $$;
create policy "Authenticated read" on public.admin_config for select using (auth.uid() is not null);
create policy "Admin manage" on public.admin_config for all using (public.is_admin());
insert into public.admin_config (key, value) values ('standortabfrage_teamleiter_allowed', 'false') on conflict (key) do nothing;
insert into public.admin_config (key, value)
values ('urlaub_vj_deadline_mmdd', '{"month":3,"day":31}'::jsonb)
on conflict (key) do nothing;

-- Migration: standortabfrage_config → admin_config (falls vorhanden)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'standortabfrage_config') then
    insert into public.admin_config (key, value)
      select 'standortabfrage_teamleiter_allowed', value from public.standortabfrage_config where key = 'teamleiter_allowed'
      on conflict (key) do update set value = excluded.value;
    drop table public.standortabfrage_config;
  end if;
end $$;

-- Cleanup: veraltete Keys entfernen (falls aus früherer Migration)
delete from public.admin_config where key = 'teamleiter_visible_only_to_admin';

drop function if exists public.get_standortabfrage_teamleiter_allowed() cascade;
create or replace function public.get_standortabfrage_teamleiter_allowed()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select (value #>> '{}')::boolean from public.admin_config where key = 'standortabfrage_teamleiter_allowed'), false);
$$;
grant execute on function public.get_standortabfrage_teamleiter_allowed() to authenticated;

drop function if exists public.set_standortabfrage_teamleiter_allowed(boolean);
create or replace function public.set_standortabfrage_teamleiter_allowed(p_allowed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Nur Admins dürfen diese Einstellung ändern.';
  end if;
  insert into public.admin_config (key, value) values ('standortabfrage_teamleiter_allowed', to_jsonb(p_allowed))
  on conflict (key) do update set value = to_jsonb(p_allowed);
end;
$$;
grant execute on function public.set_standortabfrage_teamleiter_allowed(boolean) to authenticated;

-- 5c.2 Standorttabellen (Snapshot + Requests)
create table if not exists public.employee_current_location (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  lat double precision not null,
  lon double precision not null,
  accuracy double precision,
  updated_at timestamptz default now()
);
alter table public.employee_current_location enable row level security;

-- Standort-Anfragen: Admin/Teamleiter fordert Standort an, Mitarbeiter sendet beim nächsten App-Öffnen
create table if not exists public.location_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles(id) on delete cascade not null,
  requested_user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  fulfilled_at timestamptz default null
);
create index if not exists idx_location_requests_user on public.location_requests(requested_user_id) where fulfilled_at is null;
alter table public.location_requests enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'location_requests' loop
    execute format('drop policy if exists %I on public.location_requests', r.policyname);
  end loop;
end $$;
create policy "Admin can manage location_requests" on public.location_requests for all using (public.is_admin());
create policy "Teamleiter can manage team location_requests" on public.location_requests for all using (
  public.is_teamleiter() and public.get_standortabfrage_teamleiter_allowed()
  and requested_user_id in (select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null)
);
create policy "User can read own pending requests" on public.location_requests for select using (auth.uid() = requested_user_id and fulfilled_at is null);

-- 5c.3 Web-Push-Abos
-- Web Push: Abonnements für Standortanfrage-Benachrichtigungen
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' loop
    execute format('drop policy if exists %I on public.push_subscriptions', r.policyname);
  end loop;
end $$;
create policy "User can manage own push subscriptions" on public.push_subscriptions for all using (auth.uid() = user_id);

create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (user_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;
grant execute on function public.upsert_push_subscription(text, text, text) to authenticated;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions where user_id = auth.uid() and endpoint = p_endpoint;
end;
$$;
grant execute on function public.delete_push_subscription(text) to authenticated;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'employee_current_location' loop
    execute format('drop policy if exists %I on public.employee_current_location', r.policyname);
  end loop;
end $$;
create policy "User can upsert own location" on public.employee_current_location for all using (auth.uid() = user_id);
create policy "Admin can read all locations" on public.employee_current_location for select using (public.is_admin());
create policy "Teamleiter can read team locations" on public.employee_current_location for select using (
  public.is_teamleiter() and public.get_standortabfrage_teamleiter_allowed() and user_id in (
    select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null
  )
);

drop function if exists public.update_my_current_location(double precision, double precision, double precision);
create or replace function public.update_my_current_location(
  p_lat double precision,
  p_lon double precision,
  p_accuracy double precision default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_consent boolean;
begin
  select p.standortabfrage_consent_at is not null and p.standortabfrage_consent_revoked_at is null
  into v_consent from public.profiles p where p.id = auth.uid();
  if not coalesce(v_consent, false) then
    raise exception 'Standortabfrage erfordert Ihre Einwilligung. Bitte in den Einstellungen erteilen.';
  end if;
  insert into public.employee_current_location (user_id, lat, lon, accuracy, updated_at)
  values (auth.uid(), p_lat, p_lon, p_accuracy, now())
  on conflict (user_id) do update set lat = excluded.lat, lon = excluded.lon, accuracy = excluded.accuracy, updated_at = now();
  update public.location_requests set fulfilled_at = now() where requested_user_id = auth.uid() and fulfilled_at is null;
end;
$$;
grant execute on function public.update_my_current_location(double precision, double precision, double precision) to authenticated;

drop function if exists public.request_employee_location(uuid);
create or replace function public.request_employee_location(p_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_consent boolean;
  v_can_request boolean := false;
begin
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'Ungültige Anfrage.';
  end if;
  select p.standortabfrage_consent_at is not null and p.standortabfrage_consent_revoked_at is null
  into v_consent from public.profiles p where p.id = p_user_id;
  if not coalesce(v_consent, false) then
    raise exception 'Mitarbeiter hat keine Einwilligung für Standortabfrage.';
  end if;
  if public.is_admin() then
    v_can_request := true;
  elsif public.is_teamleiter() and public.get_standortabfrage_teamleiter_allowed() then
    select exists (select 1 from public.profiles where id = p_user_id and team_id = public.get_my_team_id() and team_id is not null) into v_can_request;
  end if;
  if not v_can_request then
    raise exception 'Keine Berechtigung für Standortanfrage.';
  end if;
  insert into public.location_requests (requested_by, requested_user_id)
  values (auth.uid(), p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.request_employee_location(uuid) to authenticated;

drop function if exists public.get_my_pending_location_request();
create or replace function public.get_my_pending_location_request()
returns uuid language sql security definer set search_path = public stable as $$
  select id from public.location_requests where requested_user_id = auth.uid() and fulfilled_at is null order by created_at desc limit 1;
$$;
grant execute on function public.get_my_pending_location_request() to authenticated;

drop function if exists public.get_employee_locations();
create or replace function public.get_employee_locations()
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  lat double precision,
  lon double precision,
  accuracy double precision,
  updated_at timestamptz,
  has_pending_request boolean
) language plpgsql security definer set search_path = public stable as $$
begin
  if public.is_admin() then
    null;
  elsif public.is_teamleiter() and public.get_standortabfrage_teamleiter_allowed() then
    null;
  else
    raise exception 'Keine Berechtigung für Standortabfrage.';
  end if;
  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    ecl.lat,
    ecl.lon,
    ecl.accuracy,
    ecl.updated_at,
    exists (select 1 from public.location_requests lr where lr.requested_user_id = p.id and lr.fulfilled_at is null)
  from public.profiles p
  left join public.employee_current_location ecl on ecl.user_id = p.id
  where p.standortabfrage_consent_at is not null
    and p.standortabfrage_consent_revoked_at is null
    and p.id != auth.uid()
    and (
      public.is_admin()
      or (public.is_teamleiter() and public.get_standortabfrage_teamleiter_allowed() and p.team_id = public.get_my_team_id() and p.team_id is not null)
    )
  order by ecl.updated_at desc nulls last, p.last_name nulls last, p.first_name nulls last;
end;
$$;
grant execute on function public.get_employee_locations() to authenticated;

-- Grenzüberschreitungen: lokale Tabelle + RPC (Prüfung über Datenbank)
-- Für HTTP-POST ans Lizenzportal: pg_net in Supabase Dashboard aktivieren (Database → Extensions)
create table if not exists public.limit_exceeded_log (
  id uuid primary key default gen_random_uuid(),
  limit_type text not null check (limit_type in ('users', 'customers')),
  current_value int not null,
  max_value int not null,
  license_number text,
  reported_from text,
  created_at timestamptz default now()
);
create index if not exists idx_limit_exceeded_log_created on public.limit_exceeded_log(created_at desc);
alter table public.limit_exceeded_log enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'limit_exceeded_log' loop
    execute format('drop policy if exists %I on public.limit_exceeded_log', r.policyname);
  end loop;
end $$;
create policy "Admins can read limit_exceeded_log" on public.limit_exceeded_log for select using (public.is_admin());

create or replace function public.report_limit_exceeded(
  p_license_number text,
  p_limit_type text,
  p_current_value int,
  p_max_value int,
  p_reported_from text default null,
  p_api_url text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.limit_exceeded_log (limit_type, current_value, max_value, license_number, reported_from)
  values (p_limit_type, p_current_value, p_max_value, nullif(trim(p_license_number), ''), nullif(trim(p_reported_from), ''));
  if p_api_url is not null and trim(p_api_url) != '' then
    begin
      perform net.http_post(
        url := trim(p_api_url),
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'licenseNumber', nullif(trim(p_license_number), ''),
          'limit_type', p_limit_type,
          'current_value', p_current_value,
          'max_value', p_max_value,
          'reported_from', nullif(trim(p_reported_from), '')
        )
      );
    exception when others then
      null;
    end;
  end if;
end;
$$;
grant execute on function public.report_limit_exceeded(text, text, int, int, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. KUNDENPORTAL
-- -----------------------------------------------------------------------------
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

-- true, wenn mindestens ein aktiver Portal-User den Kunden nutzt und dieses Objekt (Firma/BV) ihm zugeordnet ist
create or replace function public.monteur_portal_delivery_eligible(p_object_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.objects o
    left join public.bvs b on b.id = o.bv_id
    cross join lateral (select coalesce(b.customer_id, o.customer_id) as cid) x
    join public.customers c on c.id = x.cid
    join public.customer_portal_users cpu
      on cpu.customer_id = x.cid and cpu.user_id is not null
    where o.id = p_object_id
      and o.archived_at is null
      and x.cid is not null
      and public.portal_object_visible_to_user(cpu.user_id, x.cid, o.bv_id)
      and case
        when b.id is not null and coalesce(b.uses_customer_report_delivery, true) = false then
          (coalesce(b.monteur_report_portal, true) = true and coalesce(b.monteur_report_internal_only, false) = false)
        else
          (coalesce(c.monteur_report_portal, true) = true and coalesce(c.monteur_report_internal_only, false) = false)
      end
  );
$$;
grant execute on function public.monteur_portal_delivery_eligible(uuid) to authenticated;

-- Kundenportal: sichtbare Aufträge + Zeitleisten-Schalter (security definer, nur auth.uid() = p_user_id)
drop function if exists public.get_portal_order_timeline(uuid);
create or replace function public.get_portal_order_timeline(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  sp boolean := false;
  st boolean := true;
  sip boolean := true;
  orders_json jsonb := '[]'::jsonb;
begin
  if p_user_id is distinct from auth.uid() then
    return jsonb_build_object(
      'settings',
      jsonb_build_object(
        'portal_timeline_show_planned', false,
        'portal_timeline_show_termin', true,
        'portal_timeline_show_in_progress', true
      ),
      'orders', '[]'::jsonb
    );
  end if;

  select
    coalesce(mrs.portal_timeline_show_planned, false),
    coalesce(mrs.portal_timeline_show_termin, true),
    coalesce(mrs.portal_timeline_show_in_progress, true)
  into sp, st, sip
  from public.monteur_report_settings mrs
  where mrs.id = 1;

  select coalesce(
    jsonb_agg(
      to_jsonb(t) - 'sort_date' - 'sort_time'
      order by t.sort_date desc, t.sort_time desc nulls last
    ),
    '[]'::jsonb
  )
  into orders_json
  from (
    select
      o.id,
      o.status,
      o.order_type,
      o.order_date,
      case when o.order_time is null then null else o.order_time::text end as order_time,
      o.created_at,
      o.updated_at,
      (
        select string_agg(ob.name, ', ' order by ob.name)
        from unnest(
          coalesce(
            o.object_ids,
            case when o.object_id is not null then array[o.object_id] else array[]::uuid[] end
          )
        ) as x(oid)
        join public.objects ob on ob.id = x.oid
        where public.portal_object_visible_to_user(p_user_id, ob.customer_id, ob.bv_id)
          and ob.archived_at is null
      ) as object_names,
      o.order_date as sort_date,
      o.order_time as sort_time
    from public.orders o
    where o.customer_id in (
      select cpu.customer_id from public.customer_portal_users cpu
      where cpu.user_id = p_user_id
    )
    and o.status in ('offen', 'in_bearbeitung', 'erledigt', 'storniert')
    and exists (
      select 1
      from unnest(
        coalesce(
          o.object_ids,
          case when o.object_id is not null then array[o.object_id] else array[]::uuid[] end
        )
      ) as u(oid)
      join public.objects ob2 on ob2.id = u.oid
      where public.portal_object_visible_to_user(p_user_id, ob2.customer_id, ob2.bv_id)
        and ob2.archived_at is null
    )
  ) t;

  return jsonb_build_object(
    'settings',
    jsonb_build_object(
      'portal_timeline_show_planned', sp,
      'portal_timeline_show_termin', st,
      'portal_timeline_show_in_progress', sip
    ),
    'orders', orders_json
  );
end;
$$;
grant execute on function public.get_portal_order_timeline(uuid) to authenticated;

drop function if exists public.get_portal_maintenance_reports(uuid);
create or replace function public.get_portal_maintenance_reports(p_user_id uuid)
returns table (
  report_id uuid, object_id uuid, maintenance_date date, maintenance_time text,
  reason text, reason_other text, manufacturer_maintenance_done boolean,
  hold_open_checked boolean, deficiencies_found boolean, deficiency_description text,
  urgency text, fixed_immediately boolean, pdf_path text, pruefprotokoll_pdf_path text, created_at timestamptz,
  object_name text, object_internal_id text, object_floor text, object_room text,
  bv_name text, customer_name text
)
language sql security definer set search_path = public stable as $$
  select
    mr.id as report_id, mr.object_id, mr.maintenance_date, mr.maintenance_time,
    mr.reason, mr.reason_other, mr.manufacturer_maintenance_done,
    mr.hold_open_checked, mr.deficiencies_found, mr.deficiency_description,
    mr.urgency, mr.fixed_immediately,
    case when coalesce(mrs.portal_share_monteur_report_pdf, true) then mr.pdf_path else null end as pdf_path,
    case when coalesce(mrs.portal_share_pruefprotokoll_pdf, true) then mr.pruefprotokoll_pdf_path else null end as pruefprotokoll_pdf_path,
    mr.created_at,
    o.name as object_name, o.internal_id as object_internal_id, o.floor as object_floor, o.room as object_room,
    b.name as bv_name, c.name as customer_name
  from public.maintenance_reports mr
  join public.objects o on o.id = mr.object_id
  left join public.bvs b on b.id = o.bv_id
  join public.customers c on c.id = coalesce(b.customer_id, o.customer_id)
  cross join public.monteur_report_settings mrs
  where mrs.id = 1
    and c.id in (select customer_id from public.customer_portal_users where user_id = p_user_id)
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
  cross join public.monteur_report_settings mrs
  where mrs.id = 1
    and coalesce(mrs.portal_share_monteur_report_pdf, true) = true
    and mr.id = p_report_id
    and c.id in (select customer_id from public.customer_portal_users where user_id = auth.uid())
    and public.portal_object_visible_to_user(auth.uid(), c.id, o.bv_id);
$$;
grant execute on function public.get_portal_pdf_path(uuid) to authenticated;

create or replace function public.get_portal_pruefprotokoll_pdf_path(p_report_id uuid)
returns text language sql security definer set search_path = public stable as $$
  select mr.pruefprotokoll_pdf_path
  from public.maintenance_reports mr
  join public.objects o on o.id = mr.object_id
  left join public.bvs b on b.id = o.bv_id
  join public.customers c on c.id = coalesce(b.customer_id, o.customer_id)
  cross join public.monteur_report_settings mrs
  where mrs.id = 1
    and coalesce(mrs.portal_share_pruefprotokoll_pdf, true) = true
    and mr.id = p_report_id
    and c.id in (select customer_id from public.customer_portal_users where user_id = auth.uid())
    and public.portal_object_visible_to_user(auth.uid(), c.id, o.bv_id);
$$;
grant execute on function public.get_portal_pruefprotokoll_pdf_path(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. STORAGE BUCKETS
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('object-photos', 'object-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('object-documents', 'object-documents', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('maintenance-photos', 'maintenance-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('briefbogen', 'briefbogen', false) on conflict (id) do nothing;

-- RPC: Speichernutzung in MB (für Speicherkontingent-Warnung)
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
  where bucket_id in ('object-photos', 'object-documents', 'maintenance-photos', 'briefbogen');
$$;
grant execute on function public.get_storage_usage() to authenticated;
grant execute on function public.get_storage_usage() to service_role;

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

drop policy if exists "Authenticated read briefbogen" on storage.objects;
drop policy if exists "Admin upload briefbogen" on storage.objects;
drop policy if exists "Admin update briefbogen" on storage.objects;
drop policy if exists "Admin delete briefbogen" on storage.objects;
create policy "Authenticated read briefbogen" on storage.objects for select using (bucket_id = 'briefbogen' and auth.uid() is not null);
create policy "Admin upload briefbogen" on storage.objects for insert with check (bucket_id = 'briefbogen' and public.is_admin());
create policy "Admin update briefbogen" on storage.objects for update using (bucket_id = 'briefbogen' and public.is_admin());
create policy "Admin delete briefbogen" on storage.objects for delete using (bucket_id = 'briefbogen' and public.is_admin());

-- -----------------------------------------------------------------------------
-- 7b. Urlaub Phase 3: Zusatzurlaub-Posten, VJ-Hinweis (Ack), erweiterte RPCs
--     (Spalten leave_requests / profiles + admin_config-Default bereits in Abschn. 4 bzw. 5c)
-- -----------------------------------------------------------------------------
create table if not exists public.leave_extra_entitlements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  days_remaining numeric(4,2) not null,
  expires_on date not null,
  title text not null default 'Zusatzurlaub',
  same_rules_as_statutory boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint leave_extra_days_remaining_nonneg check (days_remaining >= 0)
);
create index if not exists idx_leave_extra_entitlements_user on public.leave_extra_entitlements(user_id);
create index if not exists idx_leave_extra_entitlements_expires on public.leave_extra_entitlements(expires_on);
alter table public.leave_extra_entitlements enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'leave_extra_entitlements' loop
    execute format('drop policy if exists %I on public.leave_extra_entitlements', r.policyname);
  end loop;
end $$;
create policy "leave_extra_select" on public.leave_extra_entitlements for select using (
  auth.uid() is not null and (
    user_id = auth.uid()
    or public.is_admin()
    or (public.is_teamleiter() and user_id in (select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null))
  )
);
create policy "leave_extra_admin_mutate" on public.leave_extra_entitlements for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.leave_vj_acknowledgments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  calendar_year int not null,
  acknowledged_at timestamptz not null default now(),
  primary key (user_id, calendar_year)
);
alter table public.leave_vj_acknowledgments enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'leave_vj_acknowledgments' loop
    execute format('drop policy if exists %I on public.leave_vj_acknowledgments', r.policyname);
  end loop;
end $$;
create policy "vj_ack_select" on public.leave_vj_acknowledgments for select using (
  user_id = auth.uid()
  or public.is_admin()
  or (public.is_teamleiter() and user_id in (select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null))
);
create policy "vj_ack_insert_own" on public.leave_vj_acknowledgments for insert with check (user_id = auth.uid());

create or replace function public.set_urlaub_vj_deadline_global(p_month int, p_day int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Nur Admin';
  end if;
  if p_month < 1 or p_month > 12 or p_day < 1 or p_day > 31 then
    raise exception 'Ungültiges Datum';
  end if;
  insert into public.admin_config (key, value)
  values ('urlaub_vj_deadline_mmdd', jsonb_build_object('month', p_month, 'day', p_day))
  on conflict (key) do update set value = jsonb_build_object('month', p_month, 'day', p_day);
end;
$$;
grant execute on function public.set_urlaub_vj_deadline_global(int, int) to authenticated;

create or replace function public.update_profile_urlaub_vj_deadline_override(
  p_profile_id uuid,
  p_month int,
  p_day int
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Nur Admin';
  end if;
  if p_month is null or p_day is null then
    update public.profiles
    set urlaub_vj_deadline_month = null, urlaub_vj_deadline_day = null, updated_at = now()
    where id = p_profile_id;
    return;
  end if;
  if p_month < 1 or p_month > 12 or p_day < 1 or p_day > 31 then
    raise exception 'Ungültiges Datum';
  end if;
  update public.profiles
  set urlaub_vj_deadline_month = p_month::smallint, urlaub_vj_deadline_day = p_day::smallint, updated_at = now()
  where id = p_profile_id;
end;
$$;
grant execute on function public.update_profile_urlaub_vj_deadline_override(uuid, int, int) to authenticated;

create or replace function public.get_urlaub_vj_deadline_settings()
returns table (global_month int, global_day int)
language sql security definer set search_path = public stable as $$
  select
    coalesce((cfg.value->>'month')::int, 3),
    coalesce((cfg.value->>'day')::int, 31)
  from (select 1) _ensure_row
  left join lateral (
    select c.value from public.admin_config c where c.key = 'urlaub_vj_deadline_mmdd' limit 1
  ) cfg on true;
$$;
grant execute on function public.get_urlaub_vj_deadline_settings() to authenticated;

create or replace function public.acknowledge_leave_vj_hint(p_year int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert';
  end if;
  insert into public.leave_vj_acknowledgments (user_id, calendar_year, acknowledged_at)
  values (auth.uid(), p_year, now())
  on conflict (user_id, calendar_year) do update set acknowledged_at = now();
end;
$$;
grant execute on function public.acknowledge_leave_vj_hint(int) to authenticated;

create or replace function public.insert_leave_extra_entitlement(
  p_user_id uuid,
  p_days_remaining numeric,
  p_expires_on date,
  p_title text default 'Zusatzurlaub',
  p_same_rules_as_statutory boolean default false
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Nur Admin';
  end if;
  if p_days_remaining is null or p_days_remaining < 0 then
    raise exception 'Ungültige Tage';
  end if;
  insert into public.leave_extra_entitlements (user_id, days_remaining, expires_on, title, same_rules_as_statutory, updated_at)
  values (p_user_id, p_days_remaining, p_expires_on, coalesce(nullif(trim(p_title), ''), 'Zusatzurlaub'), coalesce(p_same_rules_as_statutory, false), now())
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.insert_leave_extra_entitlement(uuid, numeric, date, text, boolean) to authenticated;

create or replace function public.delete_leave_extra_entitlement(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Nur Admin';
  end if;
  delete from public.leave_extra_entitlements where id = p_id;
end;
$$;
grant execute on function public.delete_leave_extra_entitlement(uuid) to authenticated;

create or replace function public.get_leave_extra_entitlements(p_user_id uuid)
returns table (
  id uuid,
  user_id uuid,
  days_remaining numeric,
  expires_on date,
  title text,
  same_rules_as_statutory boolean,
  created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select e.id, e.user_id, e.days_remaining, e.expires_on, e.title, e.same_rules_as_statutory, e.created_at
  from public.leave_extra_entitlements e
  where e.user_id = p_user_id
    and (
      e.user_id = auth.uid()
      or public.is_admin()
      or (public.is_teamleiter() and e.user_id in (select id from public.profiles where team_id = public.get_my_team_id() and team_id is not null))
    )
  order by e.expires_on asc, e.created_at asc;
$$;
grant execute on function public.get_leave_extra_entitlements(uuid) to authenticated;

create or replace function public.get_leave_balance_snapshot(p_user_id uuid, p_year int)
returns table (
  days_total numeric,
  days_carried_over numeric,
  approved_urlaub_in_year numeric,
  pending_urlaub_in_year numeric,
  zusatz_sum numeric,
  vj_deadline date,
  vj_hint_acknowledged boolean,
  available_statutory numeric
)
language plpgsql security definer set search_path = public as $$
declare
  v_prev int := p_year - 1;
  v_vac numeric;
  v_used_prev numeric;
  v_prev_total numeric;
  v_prev_carried numeric;
  v_new_carry numeric;
  v_curr_total numeric;
  v_curr_carried numeric;
  v_appr numeric;
  v_pend numeric;
  v_zusatz numeric;
  v_gm int;
  v_gd int;
  v_pm smallint;
  v_pd smallint;
  v_dm int;
  v_dd int;
  v_deadline date;
  v_ack boolean;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert';
  end if;
  if p_user_id <> auth.uid() and not public.is_admin() and not (
    public.is_teamleiter() and exists (
      select 1 from public.profiles p where p.id = p_user_id and p.team_id = public.get_my_team_id() and p.team_id is not null
    )
  ) then
    raise exception 'Keine Berechtigung';
  end if;

  select vacation_days_per_year into v_vac from public.profiles where id = p_user_id;

  insert into public.leave_entitlements (user_id, year, days_total, days_carried_over, updated_at)
  values (p_user_id, v_prev, coalesce(v_vac, 0), 0, now())
  on conflict (user_id, year) do nothing;
  insert into public.leave_entitlements (user_id, year, days_total, days_carried_over, updated_at)
  values (p_user_id, p_year, coalesce(v_vac, 0), 0, now())
  on conflict (user_id, year) do nothing;

  update public.leave_entitlements
  set days_total = coalesce(v_vac, 0), updated_at = now()
  where user_id = p_user_id and year in (v_prev, p_year);

  select coalesce(sum(public.count_work_days_in_range(
    p_user_id,
    greatest(coalesce(r.approved_from_date, r.from_date), make_date(v_prev, 1, 1)),
    least(coalesce(r.approved_to_date, r.to_date), make_date(v_prev, 12, 31))
  )), 0) into v_used_prev
  from public.leave_requests r
  where r.user_id = p_user_id and r.status = 'approved' and r.leave_type = 'urlaub'
    and r.to_date >= make_date(v_prev, 1, 1) and r.from_date <= make_date(v_prev, 12, 31);

  select le.days_total, le.days_carried_over into v_prev_total, v_prev_carried
  from public.leave_entitlements le where le.user_id = p_user_id and le.year = v_prev;

  v_new_carry := greatest(0, coalesce(v_prev_total, 0) + coalesce(v_prev_carried, 0) - coalesce(v_used_prev, 0));

  update public.leave_entitlements
  set days_carried_over = v_new_carry, updated_at = now()
  where user_id = p_user_id and year = p_year;

  select le.days_total, le.days_carried_over into v_curr_total, v_curr_carried
  from public.leave_entitlements le where le.user_id = p_user_id and le.year = p_year;

  select coalesce(sum(public.count_work_days_in_range(
    p_user_id,
    greatest(coalesce(r.approved_from_date, r.from_date), make_date(p_year, 1, 1)),
    least(coalesce(r.approved_to_date, r.to_date), make_date(p_year, 12, 31))
  )), 0) into v_appr
  from public.leave_requests r
  where r.user_id = p_user_id and r.status = 'approved' and r.leave_type = 'urlaub'
    and r.to_date >= make_date(p_year, 1, 1) and r.from_date <= make_date(p_year, 12, 31);

  select coalesce(sum(public.count_work_days_in_range(
    p_user_id,
    greatest(r.from_date, make_date(p_year, 1, 1)),
    least(r.to_date, make_date(p_year, 12, 31))
  )), 0) into v_pend
  from public.leave_requests r
  where r.user_id = p_user_id and r.status = 'pending' and r.leave_type = 'urlaub'
    and r.to_date >= make_date(p_year, 1, 1) and r.from_date <= make_date(p_year, 12, 31);

  select coalesce(sum(e.days_remaining), 0) into v_zusatz
  from public.leave_extra_entitlements e
  where e.user_id = p_user_id and e.expires_on >= current_date;

  select (c.value->>'month')::int, (c.value->>'day')::int into v_gm, v_gd
  from public.admin_config c where c.key = 'urlaub_vj_deadline_mmdd' limit 1;
  v_gm := coalesce(v_gm, 3);
  v_gd := coalesce(v_gd, 31);

  select p.urlaub_vj_deadline_month, p.urlaub_vj_deadline_day into v_pm, v_pd
  from public.profiles p where p.id = p_user_id;

  v_dm := coalesce(v_pm::int, v_gm);
  v_dd := coalesce(v_pd::int, v_gd);
  begin
    v_deadline := make_date(p_year, v_dm, v_dd);
  exception when others then
    v_deadline := make_date(p_year, 3, 31);
  end;

  select exists (
    select 1 from public.leave_vj_acknowledgments a
    where a.user_id = p_user_id and a.calendar_year = p_year
  ) into v_ack;

  return query select
    coalesce(v_curr_total, 0)::numeric,
    coalesce(v_curr_carried, 0)::numeric,
    coalesce(v_appr, 0)::numeric,
    coalesce(v_pend, 0)::numeric,
    coalesce(v_zusatz, 0)::numeric,
    v_deadline,
    coalesce(v_ack, false),
    (coalesce(v_curr_carried, 0) + coalesce(v_curr_total, 0) - coalesce(v_appr, 0) - coalesce(v_pend, 0))::numeric;
end;
$$;
grant execute on function public.get_leave_balance_snapshot(uuid, int) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. INDIZES & REALTIME
-- -----------------------------------------------------------------------------
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
create index if not exists idx_maintenance_reports_object_date on public.maintenance_reports(object_id, maintenance_date desc);
create index if not exists idx_maintenance_reports_technician_id on public.maintenance_reports(technician_id) where technician_id is not null;
create index if not exists idx_maintenance_report_photos_report_id on public.maintenance_report_photos(report_id);
create index if not exists idx_maintenance_report_smoke_detectors_report_id on public.maintenance_report_smoke_detectors(report_id);

-- Aufträge, Zeit, Audit, Settings
create index if not exists idx_orders_order_date on public.orders(order_date);
create index if not exists idx_orders_assigned_to on public.orders(assigned_to);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_bv_id on public.orders(bv_id);
create index if not exists idx_orders_status on public.orders(status);
-- „Zuletzt bearbeitet“ / Dashboard: dataService + fetchRecentEdits sortieren nach updated_at
create index if not exists idx_orders_updated_at on public.orders(updated_at desc);
create index if not exists idx_time_entries_user_date on public.time_entries(user_id, date desc);
create index if not exists idx_time_entries_order_id on public.time_entries(order_id) where order_id is not null;
create index if not exists idx_time_breaks_time_entry_id on public.time_breaks(time_entry_id);
create index if not exists idx_time_entry_edit_log_time_entry_id on public.time_entry_edit_log(time_entry_id);
create index if not exists idx_time_entry_edit_log_edited_at on public.time_entry_edit_log(edited_at desc);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);
create index if not exists idx_app_errors_created_at on public.app_errors(created_at desc);
create index if not exists idx_app_errors_status on public.app_errors(status);
create index if not exists idx_component_settings_sort_order on public.component_settings(sort_order);

-- Urlaub / leave_requests (Review 2026-03)
-- • get_leave_requests: Filter user_id + optional status + Datums-Overlap (to_date >= from, from_date <= to)
-- • calc_soll_minutes_for_*: EXISTS mit user_id, status = 'approved', Kalendertag in [from_date, to_date]
--   → B-Tree (user_id, status, from_date, to_date) ohne leave_type in der Mitte
-- • idx_leave_requests_user_type_status_dates entfiel: leave_type zwischen user_id und status erschwerte
--   reine (user_id, status)-Zugriffe; leave_type-Filter ist selten genug für seq. Filter / idx_leave_requests_dates
create index if not exists idx_leave_requests_user_status_dates
  on public.leave_requests (user_id, status, from_date, to_date);
drop index if exists public.idx_leave_requests_user_type_status_dates;
drop index if exists public.idx_leave_requests_user_id;
create index if not exists idx_leave_requests_approved_by on public.leave_requests(approved_by) where approved_by is not null;

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