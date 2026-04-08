-- =============================================================================
-- Lizenzportal-DB: Test-App-Release (manuell, optional)
-- =============================================================================
-- Ausführen im SQL-Editor des Lizenzportal-Projekts (nicht Mandanten-DB).
-- Zweck: Incoming-Banner / Lizenz-API `mandantenReleases` lokal oder auf Staging testen.
--
-- Nach dem Einfügen:
-- - Mandanten-App: ggf. Testmandant oder Incoming-„Alle“ → hier: incoming_all_mandanten = true,
--   daher sehen alle Mandanten dieses Release in der Incoming-Liste (bis deaktiviert/gelöscht).
-- - Oder Release bearbeiten: Incoming aus, nur Pilot-Mandanten unter release_incoming_tenants.
-- - Go-Live: im Admin unter Mandant → Release-Zuweisungen den Kanal auf dieses Release setzen.
--
-- Wiederholtes Ausführen: ändert nichts (ON CONFLICT DO NOTHING).
-- Entfernen: Zeile in app_releases löschen (FKs in release_incoming_tenants / Zuweisungen beachten).
-- =============================================================================

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
  ci_metadata
) values (
  'main',
  '9.9.9-test',
  'feature',
  'Test-Release (Demo)',
  'Nur zu Testzwecken. In Produktion löschen oder „Incoming“ deaktivieren.',
  array['demo']::text[],
  true,
  true,
  false,
  '{"seed":"docs/sql/license-portal-seed-test-app-release.sql"}'::jsonb
)
on conflict (channel, version_semver) do nothing;
