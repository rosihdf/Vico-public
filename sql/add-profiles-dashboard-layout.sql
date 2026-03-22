-- ---------------------------------------------------------------------------
-- Migration: Startseiten-Layout pro Nutzer (Multi-Gerät)
-- ---------------------------------------------------------------------------
-- In Supabase: SQL Editor → New query → gesamten Inhalt einfügen → Run.
-- Idempotent: mehrfach ausführbar (IF NOT EXISTS).
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists dashboard_layout jsonb default null;

comment on column public.profiles.dashboard_layout is
  'JSON: Sichtbarkeit der Dashboard-Widgets, Zuletzt-bearbeitet-Zustand (Haupt-App).';
