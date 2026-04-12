-- Lizenzportal-DB: App-Release 1.2.2 (Wartung Prüfer-Signatur, Monteursbericht-PDF)
-- Im SQL-Editor des **Lizenzportal**-Supabase-Projekts ausführen.
--
-- Danach (wie gewohnt):
--   - Mandanten: tenant_release_assignments / Rollout auf dieses Release setzen, oder
--   - Incoming-Flags am Release nutzen.
-- Cloudflare Pages: Haupt-App mit Tag/Commit bauen, der zu dieser Version passt.
--
-- Optional GitHub-Deploy: ci_metadata.target_commitish auf den Release-Commit setzen.

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
) values (
  'main',
  '1.2.2',
  'feature',
  'Haupt-App 1.2.2 – Wartung & Monteursbericht',
  'Wartungs-Prüfliste: Pflicht-Unterschrift Prüfer pro Tür; Signatur bleibt nur bei gleichem Bearbeiter gültig; bei Fremdbearbeitung erneut unterschreiben.' || chr(10) ||
  'Unterschrift-Block unter der Feststell-Checkliste (wenn aktiv).' || chr(10) ||
  'Monteursbericht-PDF: Kunde und Objekt/BV mit Adressen wie im Prüfprotokoll; Abschnitt Unterschriften (Monteur/Kunde) mit Bild und Zeitstempel; PDF berücksichtigt auch noch nicht gespeicherte Signaturen.' || chr(10) ||
  'Formular Monteursbericht: Layout Materialzeilen und Unterschriftenbereich verbessert.',
  array['wartung', 'checklisten', 'monteurbericht', 'pdf', 'lizenz']::text[],
  false,
  false,
  false,
  jsonb_build_object(
    'source', 'docs/sql/LP-app-release-1.2.2-wartung-monteur.sql',
    'bundle', '2026-04-10'
  ),
  'published'
)
on conflict (channel, version_semver) do update set
  release_type = excluded.release_type,
  title = excluded.title,
  notes = excluded.notes,
  module_tags = excluded.module_tags,
  incoming_enabled = excluded.incoming_enabled,
  incoming_all_mandanten = excluded.incoming_all_mandanten,
  force_hard_reload = excluded.force_hard_reload,
  ci_metadata = excluded.ci_metadata,
  status = excluded.status,
  updated_at = now();

-- Kanonische Default-Version für Lizenz-API (Overlay zu mandanten-spezifisch)
update public.platform_config
set
  value = jsonb_set(
    coalesce(value, '{}'::jsonb),
    '{main}',
    jsonb_build_object(
      'version', '1.2.2',
      'releaseLabel', 'Beta',
      'releaseNotes', jsonb_build_array(
        'Wartung: Pflicht-Unterschrift Prüfer pro Tür; anderer Bearbeiter → Signatur ungültig.',
        'Monteursbericht-PDF: Adressen Kunde/BV wie Prüfprotokoll; Unterschriften mit Bild/Zeit; Vorschau auch ohne Zwischenspeichern.',
        'UI: Unterschrift unter Feststell-Checkliste; Material/Unterschriften-Layout.'
      )
    ),
    true
  )
where key = 'default_app_versions';
