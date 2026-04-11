-- ---------------------------------------------------------------------------
-- Lizenzportal (öffentliche DB): app_releases für Mandanten-Update-Banner
-- ---------------------------------------------------------------------------
-- Repo-Bundle vom 2026-04-10 – Versionen aligned mit package.json:
--   Haupt-App 1.2.1 | Kundenportal 1.1.1 | Arbeitszeit-Portal 1.2.1
--
-- Ausführung: Supabase SQL Editor **Lizenzportal-Projekt** (nicht Mandanten-DB).
-- Hinweis: Dieselben Zeilen sind in `supabase-license-portal.sql` Abschnitt 9 enthalten;
-- dieses Bundle nur nötig, wenn ihr **nur** app_releases nachzieht (ohne komplettes LP-SQL).
-- Idempotent: ON CONFLICT (channel, version_semver) DO NOTHING.
--
-- Danach im **Admin**: tenant_release_assignments / Go-Live pro Mandant setzen,
-- oder Incoming + Pilot-Mandanten (release_incoming_tenants).
--
-- Aufräumen (nur wenn falsch eingespielt):
--   delete from public.app_releases
--   where ci_metadata->>'bundle' = '2026-04-10-wip';
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
    '1.2.1',
    'feature',
    'Haupt-App 1.2.1',
    'Prüfprotokoll-PDF: laufende Nummer (PP-…), Nummer im Titel und in der Fußzeile, QR unten rechts am Blatt (Portal-Link), Prüfobjekt, deutlicher Abschluss, Checklisten-Fortsetzung bei Seitenumbruch, Punktnummerierung wie in der App.' || chr(10) ||
    'Checklisten Tür/Feststell: Hinweis / empfohlene Maßnahme ohne Mangel (parallel zu Mangel möglich); PDF und Speicherung.' || chr(10) ||
    'Lizenz/Design: Kundenportal-URL (design.kundenportal_url), optionales VITE_KUNDENPORTAL_URL; Feature teamfunktion.' || chr(10) ||
    'Aufträge: related_order_id; diverse UI (Auftragsdetail, Kunden, Einstellungen, QR-Auftrag, …).' || chr(10) ||
    'Mandanten-DB separat: u. a. pruefprotokoll_laufnummer (siehe supabase-complete.sql).',
    array['pruefprotokoll', 'checklisten', 'lizenz', 'pdf']::text[],
    false,
    false,
    false,
    '{"bundle": "2026-04-10-wip", "source": "docs/sql/license-portal-app-releases-2026-04-10-bundle.sql"}'::jsonb,
    'published'
  ),
  (
    'kundenportal',
    '1.1.1',
    'feature',
    'Kundenportal 1.1.1',
    'Berichte / Prüfprotokoll: Anzeige und Kompatibilität zum aktuellen Haupt-App-Bundle; gemeinsame Release-Metadaten.',
    array['portal', 'berichte']::text[],
    false,
    false,
    false,
    '{"bundle": "2026-04-10-wip", "source": "docs/sql/license-portal-app-releases-2026-04-10-bundle.sql"}'::jsonb,
    'published'
  ),
  (
    'arbeitszeit_portal',
    '1.2.1',
    'feature',
    'Arbeitszeit-Portal 1.2.1',
    'Zoll-/Compliance-PDF: Briefbogen-Textlayout (Ränder, Folgeseite) wie in der Haupt-App; gemeinsame Layout-Hilfen.',
    array['pdf', 'briefbogen', 'export']::text[],
    false,
    false,
    false,
    '{"bundle": "2026-04-10-wip", "source": "docs/sql/license-portal-app-releases-2026-04-10-bundle.sql"}'::jsonb,
    'published'
  )
on conflict (channel, version_semver) do nothing;
