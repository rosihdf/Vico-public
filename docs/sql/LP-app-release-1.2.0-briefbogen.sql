-- Lizenzportal-DB: App-Releases 1.2.0 (Briefbogen PDF + Folgeseite)
-- Ausführen im SQL-Editor des **Lizenzportal**-Projekts.
--
-- **Wichtig für GitHub „Deploy Pages from release“:** Ohne ci_metadata.target_commitish versucht
-- trigger-github-deploy den Ref „main/1.2.0“ – der existiert nur, wenn ihr diesen Git-Tag pusht.
-- Sicherer: SHA des Release-Commits eintragen (nach dem zweiten Statement unten).

insert into public.app_releases (
  channel,
  version_semver,
  release_type,
  title,
  notes,
  status
) values
  (
    'main',
    '1.2.0',
    'feature',
    'Haupt-App 1.2.0 – Briefbogen',
    'Mandanten-Briefbogen: PDF-Vorlage; zweite PDF-Seite optional als Folgeseiten-Hintergrund.',
    'published'
  ),
  (
    'arbeitszeit_portal',
    '1.2.0',
    'feature',
    'Arbeitszeit-Portal 1.2.0 – Briefbogen',
    'Zoll-PDF: Erst- und Folgeseite bei zweiteiliger PDF-Briefbogen-Vorlage.',
    'published'
  )
on conflict (channel, version_semver) do update set
  title = excluded.title,
  notes = excluded.notes,
  release_type = excluded.release_type,
  status = excluded.status,
  updated_at = now();

-- Commit-SHA eintragen (Beispiel: Release-Commit auf main; durch eigenen SHA ersetzen):
-- update public.app_releases
-- set ci_metadata = coalesce(ci_metadata, '{}'::jsonb) || jsonb_build_object('target_commitish', 'dd5da89286a723177ebf3a2dbce682495d78140a'),
--     updated_at = now()
-- where version_semver = '1.2.0' and channel in ('main', 'arbeitszeit_portal');
