-- Vico – Datenbank-Schema
-- Supabase SQL Editor: Inhalt einfügen und Run ausführen. Idempotent.
--
-- Struktur: Profiles → Customers → BVs → Objects → Maintenance Reports
--           → Object Photos → Orders → Component Settings → RPCs → Realtime

-- =============================================================================
-- Profiles (User + Rolle)
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
alter table public.profiles enable row level security;

do $$
begin
  alter table public.profiles drop constraint if exists profiles_role_check;
exception when others then null;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'mitarbeiter', 'leser'));

-- Helper: Admin-Check ohne RLS-Rekursion (SECURITY DEFINER liest profiles ohne Policy)
create or replace function public.is_admin()
returns boolean
language sql security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to anon;

create or replace function public.is_leser()
returns boolean
language sql security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'leser');
$$;
grant execute on function public.is_leser() to authenticated;
grant execute on function public.is_leser() to anon;

drop policy if exists "User can read own profile" on public.profiles;
drop policy if exists "User can update own profile" on public.profiles;
create policy "User can read own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "User can update own profile"
  on public.profiles for update using (auth.uid() = id);

drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can update profile roles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select using (public.is_admin());
create policy "Admins can update profile roles"
  on public.profiles for update using (public.is_admin());

drop policy if exists "Authenticated users can read profiles for assignment" on public.profiles;
create policy "Authenticated users can read profiles for assignment"
  on public.profiles for select using (auth.uid() is not null);

-- Sicherstellen: mindestens 1 Admin vorhanden (kein letzter Admin entziehen)
create or replace function public.ensure_at_least_one_admin()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  admin_count int;
begin
  if old.role = 'admin' and (new.role is null or new.role != 'admin') then
    select count(*) into admin_count from public.profiles where role = 'admin' and id != old.id;
    if admin_count = 0 then
      raise exception 'Es muss mindestens ein Admin vorhanden sein.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists ensure_at_least_one_admin on public.profiles;
create trigger ensure_at_least_one_admin
  before update of role on public.profiles
  for each row execute function public.ensure_at_least_one_admin();

create or replace function public.handle_new_user()
returns trigger as $$
declare
  is_first boolean;
begin
  select (select count(*) from public.profiles) = 0 into is_first;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when is_first then 'admin' else 'mitarbeiter' end);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Customers
-- =============================================================================
create table if not exists public.customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  street text,
  postal_code text,
  city text,
  email text,
  phone text,
  contact_name text,
  contact_email text,
  contact_phone text,
  maintenance_report_email boolean default true,
  maintenance_report_email_address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.customers enable row level security;

drop policy if exists "Authenticated users can read customers" on public.customers;
drop policy if exists "Authenticated users can insert customers" on public.customers;
drop policy if exists "Authenticated users can update customers" on public.customers;
drop policy if exists "Authenticated users can delete customers" on public.customers;
drop policy if exists "Non-leser can insert customers" on public.customers;
drop policy if exists "Non-leser can update customers" on public.customers;
drop policy if exists "Non-leser can delete customers" on public.customers;
create policy "Authenticated users can read customers"
  on public.customers for select using (auth.uid() is not null);
create policy "Non-leser can insert customers"
  on public.customers for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can update customers"
  on public.customers for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can delete customers"
  on public.customers for delete using (auth.uid() is not null and not public.is_leser());

-- =============================================================================
-- BVs (Betreuungsverantwortliche)
-- =============================================================================
create table if not exists public.bvs (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  name text not null,
  street text,
  postal_code text,
  city text,
  email text,
  phone text,
  contact_name text,
  contact_email text,
  contact_phone text,
  maintenance_report_email boolean default true,
  maintenance_report_email_address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bvs enable row level security;

drop policy if exists "Authenticated users can read bvs" on public.bvs;
drop policy if exists "Authenticated users can insert bvs" on public.bvs;
drop policy if exists "Authenticated users can update bvs" on public.bvs;
drop policy if exists "Authenticated users can delete bvs" on public.bvs;
drop policy if exists "Non-leser can insert bvs" on public.bvs;
drop policy if exists "Non-leser can update bvs" on public.bvs;
drop policy if exists "Non-leser can delete bvs" on public.bvs;
create policy "Authenticated users can read bvs"
  on public.bvs for select using (auth.uid() is not null);
create policy "Non-leser can insert bvs"
  on public.bvs for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can update bvs"
  on public.bvs for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can delete bvs"
  on public.bvs for delete using (auth.uid() is not null and not public.is_leser());

-- =============================================================================
-- Objects (pro BV)
-- =============================================================================
create table if not exists public.objects (
  id uuid default gen_random_uuid() primary key,
  bv_id uuid references public.bvs(id) on delete cascade not null,
  internal_id text unique,
  door_position text,
  internal_door_number text,
  floor text,
  room text,
  type_tuer boolean default false,
  type_sektionaltor boolean default false,
  type_schiebetor boolean default false,
  type_freitext text,
  wing_count int,
  manufacturer text,
  build_year text,
  lock_manufacturer text,
  lock_type text,
  has_hold_open boolean default false,
  hold_open_manufacturer text,
  hold_open_type text,
  hold_open_approval_no text,
  hold_open_approval_date text,
  smoke_detector_count int default 0,
  smoke_detector_build_years jsonb default '[]'::jsonb,
  panic_function text,
  accessories text,
  maintenance_by_manufacturer boolean default false,
  hold_open_maintenance boolean default false,
  defects text,
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.objects enable row level security;

drop policy if exists "Authenticated users can read objects" on public.objects;
drop policy if exists "Authenticated users can insert objects" on public.objects;
drop policy if exists "Authenticated users can update objects" on public.objects;
drop policy if exists "Authenticated users can delete objects" on public.objects;
drop policy if exists "Non-leser can insert objects" on public.objects;
drop policy if exists "Non-leser can update objects" on public.objects;
drop policy if exists "Non-leser can delete objects" on public.objects;
create policy "Authenticated users can read objects"
  on public.objects for select using (auth.uid() is not null);
create policy "Non-leser can insert objects"
  on public.objects for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can update objects"
  on public.objects for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can delete objects"
  on public.objects for delete using (auth.uid() is not null and not public.is_leser());

-- Migration: Spalte für ältere Installationen ohne smoke_detector_build_years
alter table public.objects add column if not exists smoke_detector_build_years jsonb default '[]'::jsonb;

-- Erinnerungsfunktion: Wartungsintervall pro Objekt (Monate, null = kein Intervall)
alter table public.objects add column if not exists maintenance_interval_months int;

-- =============================================================================
-- Maintenance Reports (Wartungsprotokolle)
-- =============================================================================
create table if not exists public.maintenance_reports (
  id uuid default gen_random_uuid() primary key,
  object_id uuid references public.objects(id) on delete cascade not null,
  maintenance_date date not null,
  maintenance_time text,
  technician_id uuid references auth.users(id),
  reason text check (reason in ('regelwartung', 'reparatur', 'nachpruefung', 'sonstiges')),
  reason_other text,
  manufacturer_maintenance_done boolean default false,
  hold_open_checked boolean,
  deficiencies_found boolean default false,
  deficiency_description text,
  urgency text check (urgency in ('niedrig', 'mittel', 'hoch')),
  fixed_immediately boolean default false,
  customer_signature_path text,
  technician_signature_path text,
  pdf_path text,
  synced boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.maintenance_reports add column if not exists technician_name_printed text;
alter table public.maintenance_reports add column if not exists customer_name_printed text;
alter table public.maintenance_reports enable row level security;

drop policy if exists "Authenticated users can read maintenance_reports" on public.maintenance_reports;
drop policy if exists "Authenticated users can insert maintenance_reports" on public.maintenance_reports;
drop policy if exists "Authenticated users can update maintenance_reports" on public.maintenance_reports;
drop policy if exists "Authenticated users can delete maintenance_reports" on public.maintenance_reports;
drop policy if exists "Non-leser can insert maintenance_reports" on public.maintenance_reports;
drop policy if exists "Non-leser can update maintenance_reports" on public.maintenance_reports;
drop policy if exists "Non-leser can delete maintenance_reports" on public.maintenance_reports;
create policy "Authenticated users can read maintenance_reports"
  on public.maintenance_reports for select using (auth.uid() is not null);
create policy "Non-leser can insert maintenance_reports"
  on public.maintenance_reports for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can update maintenance_reports"
  on public.maintenance_reports for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can delete maintenance_reports"
  on public.maintenance_reports for delete using (auth.uid() is not null and not public.is_leser());

create table if not exists public.maintenance_report_photos (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.maintenance_reports(id) on delete cascade not null,
  storage_path text,
  caption text,
  created_at timestamptz default now()
);

alter table public.maintenance_report_photos enable row level security;

drop policy if exists "Authenticated users can read maintenance_report_photos" on public.maintenance_report_photos;
drop policy if exists "Authenticated users can insert maintenance_report_photos" on public.maintenance_report_photos;
drop policy if exists "Authenticated users can update maintenance_report_photos" on public.maintenance_report_photos;
drop policy if exists "Authenticated users can delete maintenance_report_photos" on public.maintenance_report_photos;
drop policy if exists "Non-leser can insert maintenance_report_photos" on public.maintenance_report_photos;
drop policy if exists "Non-leser can update maintenance_report_photos" on public.maintenance_report_photos;
drop policy if exists "Non-leser can delete maintenance_report_photos" on public.maintenance_report_photos;
create policy "Authenticated users can read maintenance_report_photos"
  on public.maintenance_report_photos for select using (auth.uid() is not null);
create policy "Non-leser can insert maintenance_report_photos"
  on public.maintenance_report_photos for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can update maintenance_report_photos"
  on public.maintenance_report_photos for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can delete maintenance_report_photos"
  on public.maintenance_report_photos for delete using (auth.uid() is not null and not public.is_leser());

create table if not exists public.maintenance_report_smoke_detectors (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.maintenance_reports(id) on delete cascade not null,
  smoke_detector_label text not null,
  status text check (status in ('ok', 'defekt', 'ersetzt')) not null,
  created_at timestamptz default now()
);

alter table public.maintenance_report_smoke_detectors enable row level security;

drop policy if exists "Authenticated users can read maintenance_report_smoke_detectors" on public.maintenance_report_smoke_detectors;
drop policy if exists "Authenticated users can insert maintenance_report_smoke_detectors" on public.maintenance_report_smoke_detectors;
drop policy if exists "Authenticated users can update maintenance_report_smoke_detectors" on public.maintenance_report_smoke_detectors;
drop policy if exists "Authenticated users can delete maintenance_report_smoke_detectors" on public.maintenance_report_smoke_detectors;
drop policy if exists "Non-leser can insert maintenance_report_smoke_detectors" on public.maintenance_report_smoke_detectors;
drop policy if exists "Non-leser can update maintenance_report_smoke_detectors" on public.maintenance_report_smoke_detectors;
drop policy if exists "Non-leser can delete maintenance_report_smoke_detectors" on public.maintenance_report_smoke_detectors;
create policy "Authenticated users can read maintenance_report_smoke_detectors"
  on public.maintenance_report_smoke_detectors for select using (auth.uid() is not null);
create policy "Non-leser can insert maintenance_report_smoke_detectors"
  on public.maintenance_report_smoke_detectors for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can update maintenance_report_smoke_detectors"
  on public.maintenance_report_smoke_detectors for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can delete maintenance_report_smoke_detectors"
  on public.maintenance_report_smoke_detectors for delete using (auth.uid() is not null and not public.is_leser());

-- Storage Bucket für Wartungsprotokoll-Fotos
insert into storage.buckets (id, name, public) values ('maintenance-photos', 'maintenance-photos', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated can upload maintenance photos" on storage.objects;
drop policy if exists "Authenticated can read maintenance photos" on storage.objects;
drop policy if exists "Authenticated can delete maintenance photos" on storage.objects;
create policy "Authenticated can upload maintenance photos"
  on storage.objects for insert to authenticated with check (bucket_id = 'maintenance-photos');
create policy "Authenticated can read maintenance photos"
  on storage.objects for select to authenticated using (bucket_id = 'maintenance-photos');
create policy "Authenticated can delete maintenance photos"
  on storage.objects for delete to authenticated using (bucket_id = 'maintenance-photos');

-- =============================================================================
-- Object Photos (Fotos direkt am Objekt)
-- =============================================================================
create table if not exists public.object_photos (
  id uuid default gen_random_uuid() primary key,
  object_id uuid references public.objects(id) on delete cascade not null,
  storage_path text not null,
  caption text,
  created_at timestamptz default now()
);

alter table public.object_photos enable row level security;

drop policy if exists "Authenticated users can read object_photos" on public.object_photos;
drop policy if exists "Non-leser can insert object_photos" on public.object_photos;
drop policy if exists "Non-leser can update object_photos" on public.object_photos;
drop policy if exists "Non-leser can delete object_photos" on public.object_photos;
create policy "Authenticated users can read object_photos"
  on public.object_photos for select using (auth.uid() is not null);
create policy "Non-leser can insert object_photos"
  on public.object_photos for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can update object_photos"
  on public.object_photos for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can delete object_photos"
  on public.object_photos for delete using (auth.uid() is not null and not public.is_leser());

-- Storage Bucket für Objekt-Fotos
insert into storage.buckets (id, name, public) values ('object-photos', 'object-photos', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated can upload object photos" on storage.objects;
drop policy if exists "Authenticated can read object photos" on storage.objects;
drop policy if exists "Authenticated can delete object photos" on storage.objects;
create policy "Authenticated can upload object photos"
  on storage.objects for insert to authenticated with check (bucket_id = 'object-photos');
create policy "Authenticated can read object photos"
  on storage.objects for select to authenticated using (bucket_id = 'object-photos');
create policy "Authenticated can delete object photos"
  on storage.objects for delete to authenticated using (bucket_id = 'object-photos');

-- =============================================================================
-- RPC Functions
-- =============================================================================
create or replace function public.get_my_role()
returns text
language sql security definer
set search_path = public
stable
as $$
  select coalesce(role, 'mitarbeiter') from public.profiles where id = auth.uid();
$$;
grant execute on function public.get_my_role() to anon;
grant execute on function public.get_my_role() to authenticated;

drop function if exists public.get_all_profiles_for_admin();
create or replace function public.get_all_profiles_for_admin()
returns table (id uuid, email text, first_name text, last_name text, role text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer
set search_path = public
stable
as $$
begin
  if not exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin') then
    return;
  end if;
  return query
  select p.id, p.email, p.first_name, p.last_name, p.role, p.created_at, p.updated_at
  from public.profiles p
  order by p.last_name nulls last, p.first_name nulls last, p.email nulls last;
end;
$$;
grant execute on function public.get_all_profiles_for_admin() to authenticated;

drop function if exists public.get_maintenance_reminders();
create or replace function public.get_maintenance_reminders()
returns table (
  object_id uuid,
  customer_id uuid,
  customer_name text,
  bv_id uuid,
  bv_name text,
  internal_id text,
  maintenance_interval_months int,
  last_maintenance_date date,
  next_maintenance_date date,
  status text,
  days_until_due int
)
language plpgsql security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  return query
  with last_mr as (
    select mr.object_id, max(mr.maintenance_date) as last_date
    from public.maintenance_reports mr
    group by mr.object_id
  )
  select
    o.id as object_id,
    c.id as customer_id,
    c.name as customer_name,
    b.id as bv_id,
    b.name as bv_name,
    o.internal_id,
    o.maintenance_interval_months,
    lm.last_date as last_maintenance_date,
    (lm.last_date + (o.maintenance_interval_months || ' months')::interval)::date as next_maintenance_date,
    case
      when lm.last_date is null then 'overdue'
      when (lm.last_date + (o.maintenance_interval_months || ' months')::interval)::date < current_date then 'overdue'
      when (lm.last_date + (o.maintenance_interval_months || ' months')::interval)::date <= current_date + 30 then 'due_soon'
      else 'ok'
    end as status,
    (lm.last_date + (o.maintenance_interval_months || ' months')::interval)::date - current_date as days_until_due
  from public.objects o
  join public.bvs b on b.id = o.bv_id
  join public.customers c on c.id = b.customer_id
  left join last_mr lm on lm.object_id = o.id
  where o.maintenance_interval_months is not null and o.maintenance_interval_months > 0
    and (lm.last_date is null or (lm.last_date + (o.maintenance_interval_months || ' months')::interval)::date <= current_date + 30)
  order by
    case when lm.last_date is null then 0 else 1 end,
    (lm.last_date + (o.maintenance_interval_months || ' months')::interval)::date nulls first;
end;
$$;
grant execute on function public.get_maintenance_reminders() to authenticated;

-- =============================================================================
-- Orders (Aufträge)
-- =============================================================================
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  bv_id uuid references public.bvs(id) on delete cascade not null,
  object_id uuid references public.objects(id) on delete set null,
  order_date date not null,
  order_type text check (order_type in ('wartung', 'reparatur', 'montage', 'sonstiges')) default 'wartung',
  status text check (status in ('offen', 'in_bearbeitung', 'erledigt', 'storniert')) default 'offen',
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.orders add column if not exists assigned_to uuid;
alter table public.orders enable row level security;

drop policy if exists "Authenticated users can read orders" on public.orders;
drop policy if exists "Authenticated users can insert orders" on public.orders;
drop policy if exists "Authenticated users can update orders" on public.orders;
drop policy if exists "Authenticated users can delete orders" on public.orders;
drop policy if exists "Non-leser can insert orders" on public.orders;
drop policy if exists "Non-leser can update orders" on public.orders;
drop policy if exists "Non-leser can delete orders" on public.orders;
create policy "Authenticated users can read orders"
  on public.orders for select using (auth.uid() is not null);
create policy "Non-leser can insert orders"
  on public.orders for insert with check (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can update orders"
  on public.orders for update using (auth.uid() is not null and not public.is_leser());
create policy "Non-leser can delete orders"
  on public.orders for delete using (auth.uid() is not null and not public.is_leser());

-- =============================================================================
-- Component Settings (Feature Flags)
-- =============================================================================
create table if not exists public.component_settings (
  id uuid default gen_random_uuid() primary key,
  component_key text not null unique,
  label text not null,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.component_settings enable row level security;

drop policy if exists "Authenticated users can read component_settings" on public.component_settings;
drop policy if exists "Admins can insert component_settings" on public.component_settings;
drop policy if exists "Admins can update component_settings" on public.component_settings;
create policy "Authenticated users can read component_settings"
  on public.component_settings for select using (auth.uid() is not null);
create policy "Admins can insert component_settings"
  on public.component_settings for insert with check (public.is_admin());
create policy "Admins can update component_settings"
  on public.component_settings for update using (public.is_admin());

insert into public.component_settings (component_key, label, enabled, sort_order)
values
  ('dashboard', 'Dashboard', true, 0),
  ('kunden', 'Kunden', true, 1),
  ('suche', 'Suche', true, 2),
  ('auftrag', 'Auftrag', true, 3),
  ('scan', 'Scan', true, 4),
  ('wartungsprotokolle', 'Wartungsprotokolle', true, 5),
  ('benutzerverwaltung', 'Benutzerverwaltung', true, 6),
  ('einstellungen', 'Einstellungen', true, 7),
  ('profil', 'Profil', true, 8)
on conflict (component_key) do nothing;

-- =============================================================================
-- Indizes (Performance für häufige Abfragen)
-- =============================================================================
create index if not exists ix_maintenance_reports_object_id on public.maintenance_reports(object_id);
create index if not exists ix_maintenance_reports_technician_id on public.maintenance_reports(technician_id);
create index if not exists ix_maintenance_reports_created_at on public.maintenance_reports(created_at desc);
create index if not exists ix_maintenance_report_photos_report_id on public.maintenance_report_photos(report_id);
create index if not exists ix_maintenance_report_smoke_detectors_report_id on public.maintenance_report_smoke_detectors(report_id);
create index if not exists ix_object_photos_object_id on public.object_photos(object_id);
create index if not exists ix_orders_object_id on public.orders(object_id);
create index if not exists ix_orders_assigned_to on public.orders(assigned_to);
create index if not exists ix_orders_status on public.orders(status);
create index if not exists ix_orders_order_date on public.orders(order_date desc);
create index if not exists ix_customers_created_at on public.customers(created_at desc);
create index if not exists ix_bvs_customer_id on public.bvs(customer_id);
create index if not exists ix_objects_bv_id on public.objects(bv_id);

-- =============================================================================
-- Realtime (alle Tabellen müssen vor diesem Block existieren)
-- =============================================================================
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.orders'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.profiles'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.component_settings'; exception when others then null; end;
end $$;
