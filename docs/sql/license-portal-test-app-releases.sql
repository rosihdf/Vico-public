-- ---------------------------------------------------------------------------
-- Optionale Test-Daten: app_releases (Lizenzportal-DB)
-- ---------------------------------------------------------------------------
-- Nur für Staging / lokale LP-DB zum Ausprobieren der Admin-UI (Filter Entwurf,
-- Freigeben, Go-Live-Dropdown). Keine produktive Bedeutung.
--
-- Ausführung: gezielt per psql/Supabase SQL Editor auf der Lizenzportal-Datenbank.
-- Erneutes Ausführen: überspringt vorhandene Zeilen (gleicher Kanal + version_semver).
--
-- Aufräumen:
--   delete from public.app_releases
--   where ci_metadata->>'test_only' = 'true';
-- ---------------------------------------------------------------------------

insert into public.app_releases (
  channel,
  version_semver,
  release_type,
  title,
  notes,
  module_tags,
  incoming_enabled,
  incoming_all_mandanten,
  force_hard_reload,
  ci_metadata,
  status
) values
  (
    'main',
    '99.99.1-test-main-draft',
    'feature',
    '[TEST] Haupt-App Entwurf',
    'Nur Testdaten – dient zum Prüfen von Entwurf/Freigabe und Filtern in der Admin-Liste.',
    array['test']::text[],
    false,
    false,
    false,
    '{"test_only": true, "source": "seed-sql", "note": "Entwurf"}'::jsonb,
    'draft'
  ),
  (
    'main',
    '99.99.2-test-main-published',
    'bugfix',
    '[TEST] Haupt-App freigegeben',
    'Nur Testdaten – erscheint in Lizenz-API (published) und im Go-Live-Dropdown.',
    array['test']::text[],
    false,
    false,
    false,
    '{"test_only": true, "source": "seed-sql", "html_url": "https://example.invalid/test-release-main"}'::jsonb,
    'published'
  ),
  (
    'kundenportal',
    '99.99.1-test-kp-draft',
    'feature',
    '[TEST] Kundenportal Entwurf',
    'Nur Testdaten.',
    array['test']::text[],
    true,
    false,
    false,
    '{"test_only": true, "source": "seed-sql", "tag": "kundenportal/99.99.1-test"}'::jsonb,
    'draft'
  ),
  (
    'kundenportal',
    '99.99.2-test-kp-published',
    'major',
    '[TEST] Kundenportal freigegeben',
    'Nur Testdaten – Incoming in UI sichtbar (Pilot).',
    array['test', 'portal']::text[],
    true,
    false,
    false,
    '{"test_only": true, "source": "seed-sql"}'::jsonb,
    'published'
  ),
  (
    'arbeitszeit_portal',
    '99.99.1-test-az-draft',
    'bugfix',
    '[TEST] Arbeitszeitenportal Entwurf',
    'Nur Testdaten.',
    array['test']::text[],
    false,
    false,
    false,
    '{"test_only": true, "source": "seed-sql"}'::jsonb,
    'draft'
  ),
  (
    'arbeitszeit_portal',
    '99.99.2-test-az-published',
    'feature',
    '[TEST] Arbeitszeitenportal freigegeben',
    'Nur Testdaten.',
    array['test']::text[],
    false,
    false,
    true,
    '{"test_only": true, "source": "seed-sql", "workflow_run_url": "https://example.invalid/actions/runs/0"}'::jsonb,
    'published'
  )
on conflict (channel, version_semver) do nothing;
