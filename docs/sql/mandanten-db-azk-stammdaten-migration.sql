-- -----------------------------------------------------------------------------
-- Mandanten-DB: AZK-Stammdaten (Eintritt/Austritt, kein manuelles Soll Min/Monat)
-- -----------------------------------------------------------------------------
-- Nachziehen für bestehende Projekte: Spalten + anschließend die Funktionen aus
-- **`supabase-complete.sql`** neu ausführen (ab „calc_soll_minutes_for_month“ bis
-- „update_profile_azk_stammdaten“, inkl. DROP get_* und get_profiles_for_zeiterfassung).
--
-- Oder: gesamtes `supabase-complete.sql` idempotent im SQL Editor laufen lassen.
-- -----------------------------------------------------------------------------

alter table public.profiles add column if not exists employment_start_date date default null;
alter table public.profiles add column if not exists employment_end_date date default null;

-- Legacy: frühere manuelle Sollfelder werden beim nächsten Speichern im Portal geleert
-- (über RPC update_profile_azk_stammdaten aus supabase-complete.sql).
