-- =============================================================================
-- Vico – Datenbank-Schema
-- Supabase SQL Editor: Inhalt einfügen und Run ausführen. Idempotent.
-- =============================================================================
--
-- Abhängigkeiten: Profiles → Customers → BVs → Objects → Maintenance Reports
--                 → Object Photos → Orders → Component Settings → Audit Log
--                 → RPC Functions → Indizes → Realtime

-- =============================================================================
-- 1. Profiles (User + Rolle)
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

-- Helper: Admin-Check ohne RLS-Rekursion (SECURITY DEFINER)
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
-- 2. Customers
-- =============================================================================
create table if not exists public.customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  street text,
  house_number text,
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

alter table public.customers add column if not exists house_number text;
alter table public.customers enable row level security;

drop policy if exists "Authenticated users can read customers" on public.customers;
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
-- 3. BVs (Betreuungsverantwortliche)
-- =============================================================================
create table if not exists public.bvs (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  name text not null,
  street text,
  house_number text,
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

alter table public.bvs add column if not exists house_number text;
alter table public.bvs enable row level security;

drop policy if exists "Authenticated users can read bvs" on public.bvs;
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
-- 4. Objects (pro BV)
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
  maintenance_interval_months int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.objects add column if not exists smoke_detector_build_years jsonb default '[]'::jsonb;
alter table public.objects add column if not exists maintenance_interval_months int;
alter table public.objects enable row level security;

drop policy if exists "Authenticated users can read objects" on public.objects;
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

-- =============================================================================
-- 5. Object Photos
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

-- =============================================================================
-- 6. Maintenance Reports (Wartungsprotokolle)
-- =============================================================================
create table if not exists public.maintenance_reports (
  id uuid default gen_random_uuid() primary key,
  object_id uuid references public.objects(id) on delete cascade not null,
  maintenance_date date not null,
  maintenance_time text,
  technician_id uuid references public.profiles(id),
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
  technician_name_printed text,
  customer_name_printed text,
  pdf_path text,
  synced boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.maintenance_reports enable row level security;

drop policy if exists "Authenticated users can read maintenance_reports" on public.maintenance_reports;
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

-- =============================================================================
-- 7. Maintenance Report Photos
-- =============================================================================
create table if not exists public.maintenance_report_photos (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.maintenance_reports(id) on delete cascade not null,
  storage_path text,
  caption text,
  created_at timestamptz default now()
);

alter table public.maintenance_report_photos enable row level security;

drop policy if exists "Authenticated users can read maintenance_report_photos" on public.maintenance_report_photos;
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

-- =============================================================================
-- 8. Maintenance Report Smoke Detectors
-- =============================================================================
create table if not exists public.maintenance_report_smoke_detectors (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.maintenance_reports(id) on delete cascade not null,
  smoke_detector_label text not null,
  status text not null check (status in ('ok', 'defekt', 'ersetzt')),
  created_at timestamptz default now()
);

alter table public.maintenance_report_smoke_detectors enable row level security;

drop policy if exists "Authenticated users can read maintenance_report_smoke_detectors" on public.maintenance_report_smoke_detectors;
drop policy if exists "Non-leser can insert maintenance_report_smoke_detectors" on public.maintenance_report_smoke_detectors;
create policy "Authenticated users can read maintenance_report_smoke_detectors"
  on public.maintenance_report_smoke_detectors for select using (auth.uid() is not null);
create policy "Non-leser can insert maintenance_report_smoke_detectors"
  on public.maintenance_report_smoke_detectors for insert with check (auth.uid() is not null and not public.is_leser());

-- =============================================================================
-- 9. Orders (Aufträge)
-- =============================================================================
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  bv_id uuid references public.bvs(id) on delete cascade not null,
  object_id uuid references public.objects(id) on delete set null,
  order_date date not null,
  order_type text not null check (order_type in ('wartung', 'reparatur', 'montage', 'sonstiges')),
  status text not null default 'offen' check (status in ('offen', 'in_bearbeitung', 'erledigt', 'storniert')),
  description text,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.orders enable row level security;

drop policy if exists "Authenticated users can read orders" on public.orders;
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
-- 10. Component Settings (Menü-Sichtbarkeit)
-- =============================================================================
create table if not exists public.component_settings (
  id uuid default gen_random_uuid() primary key,
  component_key text unique not null,
  label text not null,
  enabled boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.component_settings enable row level security;

drop policy if exists "Authenticated users can read component_settings" on public.component_settings;
drop policy if exists "Authenticated users can manage component_settings" on public.component_settings;
create policy "Authenticated users can read component_settings"
  on public.component_settings for select using (auth.uid() is not null);
create policy "Authenticated users can manage component_settings"
  on public.component_settings for all using (auth.uid() is not null);

-- =============================================================================
-- 11. Audit Log (Historie)
-- =============================================================================
create table if not exists public.audit_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  action text not null,
  table_name text not null,
  record_id text,
  created_at timestamptz default now()
);

-- record_id als text für UUIDs und andere IDs (Migration falls uuid)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_log' and column_name = 'record_id'
  ) then
    alter table public.audit_log alter column record_id type text using record_id::text;
  end if;
exception when others then null;
end $$;

alter table public.audit_log enable row level security;

drop policy if exists "Admins can read audit_log" on public.audit_log;
create policy "Admins can read audit_log"
  on public.audit_log for select using (public.is_admin());

-- Audit-Trigger-Funktion
create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  act text;
  rid text;
begin
  if tg_op = 'INSERT' then act := 'insert'; rid := coalesce(new.id::text, '');
  elsif tg_op = 'UPDATE' then act := 'update'; rid := coalesce(new.id::text, '');
  elsif tg_op = 'DELETE' then act := 'delete'; rid := coalesce(old.id::text, '');
  else return coalesce(new, old);
  end if;
  insert into public.audit_log (user_id, action, table_name, record_id)
  values (auth.uid(), act, tg_table_name, rid);
  return coalesce(new, old);
end;
$$;

-- Audit-Trigger pro Tabelle
do $$
declare
  t text;
  tbls text[] := array['customers','bvs','objects','object_photos','orders','profiles','maintenance_reports'];
begin
  foreach t in array tbls loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_trigger_fn()', t, t);
  end loop;
end $$;

-- =============================================================================
-- 12. RPC Functions
-- =============================================================================
create or replace function public.get_audit_log(limit_rows int default 200)
returns table (
  id uuid,
  user_id uuid,
  user_email text,
  action text,
  table_name text,
  record_id text,
  created_at timestamptz
)
language sql security definer
set search_path = public
stable
as $$
  select al.id, al.user_id, p.email as user_email, al.action, al.table_name, al.record_id, al.created_at
  from public.audit_log al
  left join public.profiles p on p.id = al.user_id
  where public.is_admin()
  order by al.created_at desc
  limit nullif(least(limit_rows, 1000), 0);
$$;
grant execute on function public.get_audit_log(int) to authenticated;

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
language sql security definer
set search_path = public
stable
as $$
  with last_maint as (
    select object_id, max(maintenance_date) as d
    from public.maintenance_reports
    group by object_id
  ),
  objs as (
    select o.id as object_id, o.bv_id, o.internal_id, o.maintenance_interval_months,
           coalesce(lm.d, null::date) as last_maintenance_date,
           case when o.maintenance_interval_months is not null and o.maintenance_interval_months > 0
             then (coalesce(lm.d, current_date) + (o.maintenance_interval_months || ' months')::interval)::date
             else null
           end as next_maintenance_date
    from public.objects o
    left join last_maint lm on lm.object_id = o.id
    where o.maintenance_interval_months is not null and o.maintenance_interval_months > 0
  )
  select ob.object_id,
         c.id as customer_id,
         c.name as customer_name,
         b.id as bv_id,
         b.name as bv_name,
         ob.internal_id,
         ob.maintenance_interval_months,
         ob.last_maintenance_date,
         ob.next_maintenance_date,
         case
           when ob.next_maintenance_date is null then 'ok'
           when ob.next_maintenance_date < current_date then 'overdue'
           when ob.next_maintenance_date <= current_date + interval '30 days' then 'due_soon'
           else 'ok'
         end as status,
         case when ob.next_maintenance_date is not null
           then (ob.next_maintenance_date - current_date)::int
           else null
         end as days_until_due
  from objs ob
  join public.bvs b on b.id = ob.bv_id
  join public.customers c on c.id = b.customer_id
  where auth.uid() is not null;
$$;
grant execute on function public.get_maintenance_reminders() to authenticated;

-- =============================================================================
-- 13. Storage Buckets
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('object-photos', 'object-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('maintenance-photos', 'maintenance-photos', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can read object-photos" on storage.objects;
drop policy if exists "Authenticated users can upload object-photos" on storage.objects;
drop policy if exists "Authenticated users can delete object-photos" on storage.objects;
create policy "Authenticated users can read object-photos"
  on storage.objects for select using (bucket_id = 'object-photos' and auth.uid() is not null);
create policy "Authenticated users can upload object-photos"
  on storage.objects for insert with check (bucket_id = 'object-photos' and auth.uid() is not null);
create policy "Authenticated users can delete object-photos"
  on storage.objects for delete using (bucket_id = 'object-photos' and auth.uid() is not null);

drop policy if exists "Authenticated users can read maintenance-photos" on storage.objects;
drop policy if exists "Authenticated users can upload maintenance-photos" on storage.objects;
drop policy if exists "Authenticated users can delete maintenance-photos" on storage.objects;
create policy "Authenticated users can read maintenance-photos"
  on storage.objects for select using (bucket_id = 'maintenance-photos' and auth.uid() is not null);
create policy "Authenticated users can upload maintenance-photos"
  on storage.objects for insert with check (bucket_id = 'maintenance-photos' and auth.uid() is not null);
create policy "Authenticated users can delete maintenance-photos"
  on storage.objects for delete using (bucket_id = 'maintenance-photos' and auth.uid() is not null);

-- =============================================================================
-- 14. Indizes (Performance)
-- =============================================================================
create index if not exists idx_bvs_customer_id on public.bvs(customer_id);
create index if not exists idx_objects_bv_id on public.objects(bv_id);
create index if not exists idx_object_photos_object_id on public.object_photos(object_id);
create index if not exists idx_maintenance_reports_object_id on public.maintenance_reports(object_id);
create index if not exists idx_maintenance_report_photos_report_id on public.maintenance_report_photos(report_id);
create index if not exists idx_maintenance_report_smoke_detectors_report_id on public.maintenance_report_smoke_detectors(report_id);
create index if not exists idx_orders_order_date on public.orders(order_date);
create index if not exists idx_orders_assigned_to on public.orders(assigned_to);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);

-- =============================================================================
-- 15. Realtime (optional)
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
