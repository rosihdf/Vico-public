-- =============================================================================
-- Vico – Datenbank-Schema (vollständig)
-- Supabase SQL Editor: Inhalt einfügen und Run ausführen. Idempotent.
-- =============================================================================
--
-- Struktur:
--   1. Profiles + Rollen (admin, mitarbeiter, operator, leser, demo, kunde)
--   2. Stammdaten: Customers → BVs → Objects → Object Photos
--   3. Wartung: Maintenance Reports, Photos, Smoke Detectors
--   4. Aufträge, Component Settings, Audit Log
--   5. RPC Functions (get_my_role, get_all_profiles_for_admin, get_audit_log, get_maintenance_reminders)
--   6. Kundenportal (customer_portal_users, Rolle 'kunde', Helper, RLS)
--   7. Storage Buckets
--   8. Indizes, Realtime

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
alter table public.profiles enable row level security;

do $$
begin
  alter table public.profiles drop constraint if exists profiles_role_check;
exception when others then null;
end $$;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'mitarbeiter', 'operator', 'leser', 'demo', 'kunde'));

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

-- Kundenportal-Tabelle: Vorab erstellen, da Policies und Funktionen sie referenzieren.
-- RLS, Policies und Portal-RPCs folgen in Sektion 6.
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

-- 2.3 Objects
create table if not exists public.objects (
  id uuid default gen_random_uuid() primary key,
  bv_id uuid references public.bvs(id) on delete cascade not null,
  name text, internal_id text unique, door_position text, internal_door_number text, floor text, room text,
  type_tuer boolean default false, type_sektionaltor boolean default false, type_schiebetor boolean default false, type_freitext text,
  wing_count int, manufacturer text, build_year text, lock_manufacturer text, lock_type text,
  has_hold_open boolean default false, hold_open_manufacturer text, hold_open_type text, hold_open_approval_no text, hold_open_approval_date text,
  smoke_detector_count int default 0, smoke_detector_build_years jsonb default '[]'::jsonb,
  panic_function text, accessories text, maintenance_by_manufacturer boolean default false, hold_open_maintenance boolean default false,
  defects text, remarks text, maintenance_interval_months int,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.objects add column if not exists name text;
alter table public.objects add column if not exists smoke_detector_build_years jsonb default '[]'::jsonb;
alter table public.objects add column if not exists maintenance_interval_months int;
alter table public.objects enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'objects' loop
    execute format('drop policy if exists %I on public.objects', r.policyname);
  end loop;
end $$;
create policy "Read objects" on public.objects for select using (auth.uid() is not null and public.bv_customer_visible(bv_id));
create policy "Insert objects" on public.objects for insert with check (auth.uid() is not null and (public.can_write_master_data() or public.bv_customer_visible(bv_id)));
create policy "Update objects" on public.objects for update using (auth.uid() is not null and (public.can_write_master_data() or public.bv_customer_visible(bv_id)));
create policy "Delete objects" on public.objects for delete using (auth.uid() is not null and (public.is_admin() or (public.is_demo() and public.bv_customer_visible(bv_id))));

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

-- Demo-Benutzer dürfen keinen Aufträgen zugewiesen werden
create or replace function public.check_order_assigned_to_not_demo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null and exists (select 1 from public.profiles where id = new.assigned_to and role = 'demo') then
    raise exception 'Demo-Benutzer können keinen Aufträgen zugewiesen werden.';
  end if;
  return new;
end;
$$;
drop trigger if exists check_order_assigned_to_not_demo on public.orders;
create trigger check_order_assigned_to_not_demo
  before insert or update of assigned_to on public.orders
  for each row execute function public.check_order_assigned_to_not_demo();

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
  tbls text[] := array['customers','bvs','objects','object_photos','orders','profiles','maintenance_reports','maintenance_report_photos','maintenance_report_smoke_detectors','customer_portal_users'];
begin
  foreach t in array tbls loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_trigger_fn()', t, t);
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
returns table (id uuid, email text, first_name text, last_name text, role text)
language sql security definer set search_path = public stable as $$
  select p.id, p.email, p.first_name, p.last_name, p.role
  from public.profiles p
  where auth.uid() is not null
  order by p.email nulls last;
$$;
grant execute on function public.get_all_profiles_for_admin() to authenticated;

create or replace function public.get_audit_log(limit_rows int default 200)
returns table (id uuid, user_id uuid, user_email text, action text, table_name text, record_id text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select al.id, al.user_id, p.email as user_email, al.action, al.table_name, al.record_id, al.created_at
  from public.audit_log al left join public.profiles p on p.id = al.user_id
  where public.is_admin() order by al.created_at desc limit nullif(least(limit_rows, 1000), 0);
$$;
grant execute on function public.get_audit_log(int) to authenticated;

drop function if exists public.get_maintenance_reminders();
create or replace function public.get_maintenance_reminders()
returns table (object_id uuid, customer_id uuid, customer_name text, bv_id uuid, bv_name text, internal_id text,
  object_name text, object_room text, object_floor text, object_manufacturer text,
  maintenance_interval_months int, last_maintenance_date date, next_maintenance_date date, status text, days_until_due int)
language sql security definer set search_path = public stable as $$
  with last_maint as (select object_id, max(maintenance_date) as d from public.maintenance_reports group by object_id),
  objs as (
    select o.id as object_id, o.bv_id, o.internal_id, o.name as object_name, o.room as object_room, o.floor as object_floor, o.manufacturer as object_manufacturer,
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
  from objs ob join public.bvs b on b.id = ob.bv_id join public.customers c on c.id = b.customer_id
  where auth.uid() is not null and ((c.demo_user_id is null and not public.is_demo()) or (c.demo_user_id = auth.uid()));
$$;
grant execute on function public.get_maintenance_reminders() to authenticated;

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
-- 6. KUNDENPORTAL
-- =============================================================================

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
  join public.bvs b on b.id = o.bv_id
  join public.customers c on c.id = b.customer_id
  where c.id in (select customer_id from public.customer_portal_users where user_id = p_user_id)
  order by mr.maintenance_date desc;
$$;
grant execute on function public.get_portal_maintenance_reports(uuid) to authenticated;

create or replace function public.get_portal_pdf_path(p_report_id uuid)
returns text language sql security definer set search_path = public stable as $$
  select mr.pdf_path
  from public.maintenance_reports mr
  join public.objects o on o.id = mr.object_id
  join public.bvs b on b.id = o.bv_id
  where mr.id = p_report_id
    and b.customer_id in (select customer_id from public.customer_portal_users where user_id = auth.uid());
$$;
grant execute on function public.get_portal_pdf_path(uuid) to authenticated;

create index if not exists idx_customer_portal_users_user_id on public.customer_portal_users(user_id);
create index if not exists idx_customer_portal_users_email on public.customer_portal_users(email);
create index if not exists idx_customer_portal_users_customer_id on public.customer_portal_users(customer_id);

-- =============================================================================
-- 7. STORAGE BUCKETS
-- =============================================================================

insert into storage.buckets (id, name, public) values ('object-photos', 'object-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('maintenance-photos', 'maintenance-photos', true) on conflict (id) do nothing;

drop policy if exists "Authenticated users can read object-photos" on storage.objects;
drop policy if exists "Authenticated users can upload object-photos" on storage.objects;
drop policy if exists "Authenticated users can delete object-photos" on storage.objects;
create policy "Authenticated users can read object-photos" on storage.objects for select using (bucket_id = 'object-photos' and auth.uid() is not null);
create policy "Authenticated users can upload object-photos" on storage.objects for insert with check (bucket_id = 'object-photos' and auth.uid() is not null);
create policy "Authenticated users can delete object-photos" on storage.objects for delete using (bucket_id = 'object-photos' and auth.uid() is not null);

drop policy if exists "Authenticated users can read maintenance-photos" on storage.objects;
drop policy if exists "Authenticated users can upload maintenance-photos" on storage.objects;
drop policy if exists "Authenticated users can delete maintenance-photos" on storage.objects;
create policy "Authenticated users can read maintenance-photos" on storage.objects for select using (bucket_id = 'maintenance-photos' and auth.uid() is not null);
create policy "Authenticated users can upload maintenance-photos" on storage.objects for insert with check (bucket_id = 'maintenance-photos' and auth.uid() is not null);
create policy "Authenticated users can delete maintenance-photos" on storage.objects for delete using (bucket_id = 'maintenance-photos' and auth.uid() is not null);

-- =============================================================================
-- 8. INDIZES & REALTIME
-- =============================================================================

create index if not exists idx_customers_demo_user_id on public.customers(demo_user_id) where demo_user_id is not null;
create index if not exists idx_bvs_customer_id on public.bvs(customer_id);
create index if not exists idx_objects_bv_id on public.objects(bv_id);
create index if not exists idx_object_photos_object_id on public.object_photos(object_id);
create index if not exists idx_maintenance_reports_object_id on public.maintenance_reports(object_id);
create index if not exists idx_maintenance_reports_object_date on public.maintenance_reports(object_id, maintenance_date desc);
create index if not exists idx_maintenance_report_photos_report_id on public.maintenance_report_photos(report_id);
create index if not exists idx_maintenance_report_smoke_detectors_report_id on public.maintenance_report_smoke_detectors(report_id);
create index if not exists idx_orders_order_date on public.orders(order_date);
create index if not exists idx_orders_assigned_to on public.orders(assigned_to);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_bv_id on public.orders(bv_id);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);
create index if not exists idx_component_settings_sort_order on public.component_settings(sort_order);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
