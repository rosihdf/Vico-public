-- Migration: Standort-Anfragen (Admin klickt → Mitarbeiter sendet beim App-Öffnen)
-- Ausführen im Supabase SQL Editor des Haupt-Projekts.

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

-- Ersetze update_my_current_location: Markiert Anforderungen als erfüllt
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

-- Neue RPCs
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

-- get_employee_locations erweitern (alle mit Einwilligung, optional Standort)
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
