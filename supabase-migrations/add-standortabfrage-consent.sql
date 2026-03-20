-- Migration: Einwilligung für Standortabfrage (profiles + RPCs)
-- Admin/Teamleiter sehen nur Mitarbeiter, die eingewilligt haben.
-- Ausführen im Supabase SQL Editor des Haupt-Projekts.

alter table public.profiles add column if not exists standortabfrage_consent_at timestamptz default null;
alter table public.profiles add column if not exists standortabfrage_consent_revoked_at timestamptz default null;

-- update_my_current_location: Nur mit Einwilligung
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
end;
$$;
grant execute on function public.update_my_current_location(double precision, double precision, double precision) to authenticated;

-- get_employee_locations: Nur Mitarbeiter mit Einwilligung
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
  updated_at timestamptz
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
    ecl.user_id,
    p.first_name,
    p.last_name,
    p.email,
    ecl.lat,
    ecl.lon,
    ecl.accuracy,
    ecl.updated_at
  from public.employee_current_location ecl
  join public.profiles p on p.id = ecl.user_id
  where p.standortabfrage_consent_at is not null
    and p.standortabfrage_consent_revoked_at is null
    and (
      public.is_admin()
      or (public.is_teamleiter() and public.get_standortabfrage_teamleiter_allowed() and p.team_id = public.get_my_team_id() and p.team_id is not null)
    )
  order by ecl.updated_at desc;
end;
$$;
grant execute on function public.get_employee_locations() to authenticated;
