-- -----------------------------------------------------------------------------
-- Mandanten-DB: Löschen von Benutzern (auth.users) ermöglichen
-- -----------------------------------------------------------------------------
-- Symptom (Supabase Dashboard): „Failed to delete selected users: Database error deleting user“
-- Ursache: Foreign Keys ohne ON DELETE CASCADE / SET NULL verhindern das Entfernen der
--          zugehörigen public.profiles-Zeile bzw. verweisen andere Tabellen noch auf das Profil.
--
-- Im SQL Editor des MANDANTEN-Projekts ausführen (einmal). Idempotent wo möglich.
-- Backup empfohlen.
-- -----------------------------------------------------------------------------

-- 1) Profil folgt dem Auth-User (wichtigster Schritt)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2) Audit: Einträge behalten, User-Referenz entfernen
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3) Optionale Profil-Verweise: bei Löschen des referenzierten Profils NULL setzen
ALTER TABLE public.customer_portal_users DROP CONSTRAINT IF EXISTS customer_portal_users_invited_by_fkey;
ALTER TABLE public.customer_portal_users
  ADD CONSTRAINT customer_portal_users_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_reports DROP CONSTRAINT IF EXISTS maintenance_reports_technician_id_fkey;
ALTER TABLE public.maintenance_reports
  ADD CONSTRAINT maintenance_reports_technician_id_fkey
  FOREIGN KEY (technician_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_assigned_to_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_created_by_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_approved_by_fkey;
ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Hinweis: Weitere FKs auf public.profiles ohne ON DELETE können je nach Schema noch blockieren.
-- Fehlermeldung in Supabase zeigt dann den Constraint-Namen – analog DROP + ADD mit SET NULL/CASCADE.
