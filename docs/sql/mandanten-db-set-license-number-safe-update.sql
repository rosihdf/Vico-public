-- Mandanten-Delta: set_license_number mit UPDATE … WHERE (Supabase safe_update)
-- Behebt: „UPDATE requires a WHERE clause“ beim Speichern der Lizenznummer (Aktivierung / Einstellungen).

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
