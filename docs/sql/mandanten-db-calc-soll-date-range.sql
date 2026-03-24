-- -----------------------------------------------------------------------------
-- Mandanten-DB: RPC calc_soll_minutes_for_date_range (Jahresstand „bis heute“)
-- -----------------------------------------------------------------------------
-- Mit Eintritt/Austritt (employment_* auf profiles). Bei Bedarf supabase-complete.sql
-- vollständig nachziehen.
-- -----------------------------------------------------------------------------

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
