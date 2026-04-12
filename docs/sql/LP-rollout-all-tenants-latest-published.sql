-- Lizenzportal-DB (Supabase SQL Editor): alle Mandanten auf das **jeweils neueste published Release pro Kanal**
--
-- „Neueste“ = höchstes `created_at` unter `app_releases` mit `status = 'published'` je `channel`
-- (main, kundenportal, arbeitszeit_portal). Kein semver-Vergleich in SQL.
--
-- Danach: `client_config_version` bei **allen** Lizenzen +1 → Mandanten-Apps holen die Lizenz-API schneller neu.
--
-- Voraussetzung: Pro Kanal existiert mindestens ein published Release (sonst fehlen Zeilen für diesen Kanal).
-- Kein Deploy: Nur API-Anzeige/Zuweisung; ausgeliefertes Frontend weiterhin per GitHub → Cloudflare Pages.

-- 1) Zuweisungen: aktives Release = letztes published pro Kanal; vorheriges Release für Rollback beibehalten
insert into public.tenant_release_assignments (
  tenant_id,
  channel,
  active_release_id,
  previous_release_id,
  updated_at
)
select
  t.id,
  ch.channel,
  lr.id,
  x.active_release_id,
  now()
from public.tenants t
cross join (
  values
    ('main'),
    ('kundenportal'),
    ('arbeitszeit_portal')
) as ch (channel)
inner join lateral (
  select ar.id
  from public.app_releases ar
  where ar.channel = ch.channel
    and ar.status = 'published'
  order by ar.created_at desc nulls last
  limit 1
) lr on true
left join public.tenant_release_assignments x
  on x.tenant_id = t.id
 and x.channel = ch.channel
on conflict (tenant_id, channel) do update set
  previous_release_id = case
    when tenant_release_assignments.active_release_id is distinct from excluded.active_release_id
    then tenant_release_assignments.active_release_id
    else tenant_release_assignments.previous_release_id
  end,
  active_release_id = excluded.active_release_id,
  updated_at = excluded.updated_at;

-- 2) Alle Mandanten-Apps anstoßen (Polling der Lizenz-API)
update public.licenses
set client_config_version = client_config_version + 1;
