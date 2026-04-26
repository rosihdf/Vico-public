-- Mandanten-Delta: Altbericht-Import Paket C2 (optionale Mängelübernahme nach C1)
-- Siehe CHANGELOG-Mandanten-DB.md
--
-- Idempotenz: c2_defects_imported_keys enthält stabile Schlüssel "f:<Index>" (Index in findings_json).
-- Append-only auf objects.defects_structured / objects.defects (nur offene als Legacy-Text).

alter table public.altbericht_import_staging_object
  add column if not exists c2_defects_imported_keys jsonb not null default '[]'::jsonb;

alter table public.altbericht_import_staging_object
  add column if not exists c2_defects_last_import_at timestamptz;

alter table public.altbericht_import_staging_object
  add column if not exists c2_defects_last_error text;

-- Transaktional: alle p_items anhängen oder keine Änderung (bei Konflikt/Fehler).
create or replace function public.altbericht_import_c2_commit_defects(
  p_staging_object_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.altbericht_import_staging_object%rowtype;
  v_struct jsonb;
  v_imported jsonb;
  v_additions jsonb := '[]'::jsonb;
  v_new_keys text[] := array[]::text[];
  v_keys_seen text[] := array[]::text[];
  v_now timestamptz := now();
  v_item jsonb;
  v_key text;
  v_text text;
  v_id uuid;
  v_elem jsonb;
  v_open_lines text[] := array[]::text[];
  v_open_text text;
  v_status text;
  i int;
  p_count int;
  v_obj_archived timestamptz;
begin
  if p_staging_object_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_staging_id');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_items');
  end if;

  select * into v_row
  from public.altbericht_import_staging_object
  where id = p_staging_object_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'staging_not_found');
  end if;

  if v_row.committed_at is null or v_row.committed_object_id is null then
    update public.altbericht_import_staging_object
    set c2_defects_last_error = 'C1 nicht abgeschlossen (committed_at / committed_object_id fehlt).'
    where id = p_staging_object_id;
    return jsonb_build_object('ok', false, 'error', 'c1_not_committed');
  end if;

  if coalesce(v_row.review_status, '') <> 'committed' then
    update public.altbericht_import_staging_object
    set c2_defects_last_error = 'Nur Zeilen mit Review-Status „committed“ dürfen C2 nutzen.'
    where id = p_staging_object_id;
    return jsonb_build_object('ok', false, 'error', 'review_not_committed');
  end if;

  v_imported := coalesce(v_row.c2_defects_imported_keys, '[]'::jsonb);
  if jsonb_typeof(v_imported) <> 'array' then
    v_imported := '[]'::jsonb;
  end if;

  select archived_at, defects_structured
  into v_obj_archived, v_struct
  from public.objects
  where id = v_row.committed_object_id
  for update;

  if not found then
    update public.altbericht_import_staging_object
    set c2_defects_last_error = 'Zielobjekt nicht gefunden.'
    where id = p_staging_object_id;
    return jsonb_build_object('ok', false, 'error', 'object_not_found');
  end if;

  if v_obj_archived is not null then
    update public.altbericht_import_staging_object
    set c2_defects_last_error = 'Zielobjekt ist archiviert.'
    where id = p_staging_object_id;
    return jsonb_build_object('ok', false, 'error', 'object_archived');
  end if;

  v_struct := coalesce(v_struct, '[]'::jsonb);
  if jsonb_typeof(v_struct) <> 'array' then
    v_struct := '[]'::jsonb;
  end if;

  p_count := jsonb_array_length(p_items);

  for i in 0 .. p_count - 1 loop
    v_item := p_items -> i;
    v_key := nullif(trim(coalesce(v_item->>'key', '')), '');
    v_text := trim(coalesce(v_item->>'text', ''));

    if v_key is null or length(v_text) = 0 then
      update public.altbericht_import_staging_object
      set c2_defects_last_error = format('Ungültiger Eintrag (key/text): Position %s.', i + 1)
      where id = p_staging_object_id;
      return jsonb_build_object('ok', false, 'error', 'invalid_item', 'index', i);
    end if;

    if v_key = any (v_keys_seen) then
      update public.altbericht_import_staging_object
      set c2_defects_last_error = format('Doppelter Schlüssel in Anfrage: %s.', v_key)
      where id = p_staging_object_id;
      return jsonb_build_object('ok', false, 'error', 'duplicate_key_in_request', 'key', v_key);
    end if;
    v_keys_seen := array_append(v_keys_seen, v_key);

    if exists (
      select 1
      from jsonb_array_elements(v_imported) e
      where e #>> '{}' = v_key
    ) then
      update public.altbericht_import_staging_object
      set c2_defects_last_error = format('Kandidat wurde bereits produktiv übernommen: %s.', v_key)
      where id = p_staging_object_id;
      return jsonb_build_object('ok', false, 'error', 'already_imported', 'key', v_key);
    end if;

    v_id := gen_random_uuid();
    v_additions := v_additions || jsonb_build_array(
      jsonb_build_object(
        'id', v_id::text,
        'text', v_text,
        'status', 'open',
        'created_at', to_jsonb(v_now),
        'resolved_at', null
      )
    );
    v_new_keys := array_append(v_new_keys, v_key);
  end loop;

  v_struct := v_struct || v_additions;

  for v_elem in select value from jsonb_array_elements(v_struct)
  loop
    v_status := coalesce(v_elem->>'status', 'open');
    v_open_text := trim(coalesce(v_elem->>'text', ''));
    if v_status = 'open' and length(v_open_text) > 0 then
      v_open_lines := array_append(v_open_lines, v_open_text);
    end if;
  end loop;

  update public.objects
  set
    defects_structured = v_struct,
    defects = case
      when cardinality(v_open_lines) > 0 then array_to_string(v_open_lines, E'\n\n')
      else null
    end,
    updated_at = v_now
  where id = v_row.committed_object_id;

  v_imported := v_imported || (
    select coalesce(jsonb_agg(x order by o), '[]'::jsonb)
    from unnest(v_new_keys) with ordinality as t(x, o)
  );

  update public.altbericht_import_staging_object
  set
    c2_defects_imported_keys = v_imported,
    c2_defects_last_import_at = v_now,
    c2_defects_last_error = null
  where id = p_staging_object_id;

  return jsonb_build_object(
    'ok', true,
    'importedKeys', to_jsonb(v_new_keys),
    'objectId', v_row.committed_object_id
  );
exception
  when others then
    begin
      update public.altbericht_import_staging_object
      set c2_defects_last_error = left(sqlerrm, 2000)
      where id = p_staging_object_id;
    exception
      when others then null;
    end;
    return jsonb_build_object('ok', false, 'error', 'exception', 'message', sqlerrm);
end;
$$;

grant execute on function public.altbericht_import_c2_commit_defects(uuid, jsonb) to authenticated;
grant execute on function public.altbericht_import_c2_commit_defects(uuid, jsonb) to service_role;