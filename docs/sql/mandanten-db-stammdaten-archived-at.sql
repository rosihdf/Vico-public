-- Mandanten-Delta: archived_at auf customers, bvs, objects + angepasste RPCs (Stand Repo)
-- Siehe CHANGELOG-Mandanten-DB.md

alter table public.customers add column if not exists archived_at timestamptz;
alter table public.bvs add column if not exists archived_at timestamptz;
alter table public.objects add column if not exists archived_at timestamptz;

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
    join public.customer_portal_users cpu
      on cpu.customer_id = x.cid and cpu.user_id is not null
    where o.id = p_object_id
      and o.archived_at is null
      and x.cid is not null
      and public.portal_object_visible_to_user(cpu.user_id, x.cid, o.bv_id)
  );
$$;
grant execute on function public.monteur_portal_delivery_eligible(uuid) to authenticated;

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
           coalesce(lm.d, null::date) as last_maintenance_date,
           case when o.maintenance_interval_months is not null and o.maintenance_interval_months > 0
             then (coalesce(lm.d, current_date) + (o.maintenance_interval_months || ' months')::interval)::date else null end as next_maintenance_date
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
