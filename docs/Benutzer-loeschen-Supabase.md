# Benutzer löschen (Supabase / Vico)

## Symptom

Im **Supabase Dashboard** → **Authentication** → **Users** beim Löschen:

`Failed to delete selected users: Database error deleting user`

## Ursache

In der **Mandanten-Datenbank** verweisen Tabellen auf `auth.users` bzw. auf `public.profiles` **ohne** passendes `ON DELETE`. Beim Löschen eines Auth-Users soll die Zeile in **`profiles`** mit entfernt werden (CASCADE) – dafür dürfen **keine** anderen Zeilen mehr „fest“ auf dieses Profil zeigen, oder die betreffenden Spalten müssen per **`ON DELETE SET NULL`** gelöst werden.

Typische Blockaden (im Repo adressiert):

- `public.profiles.id` → `auth.users` ohne **CASCADE**
- `public.audit_log.user_id` → `auth.users` ohne **SET NULL**
- optionale Verweise auf `profiles` (z. B. `invited_by`, `technician_id`, `assigned_to`, `approved_by`) ohne **SET NULL**

## Lösung (einmalig)

1. **SQL ausführen** im Mandanten-Projekt:  
   [`docs/sql/mandanten-db-fix-auth-user-delete-fks.sql`](./sql/mandanten-db-fix-auth-user-delete-fks.sql)

2. Danach im Dashboard den User erneut löschen.

3. Wenn es **weiter** fehlschlägt: In der Fehlermeldung oder per Abfrage den **Constraint-Namen** finden und dieselbe Logik (DROP + FOREIGN KEY mit `ON DELETE SET NULL` oder `CASCADE`) anwenden.

## In der Vico-App

Die **Haupt-App** (`Benutzerverwaltung`) bietet **kein** direktes Löschen des Supabase-Auth-Kontos – aus Sicherheitsgründen gehört dazu die **Service Role**, die **nicht** im Browser liegen darf.

**Möglichkeiten:**

| Vorgehen | Aufwand |
|----------|---------|
| **Supabase Dashboard** (nach SQL-Fix oben) | Gering |
| **Supabase CLI** / SQL `delete from auth.users where id = '…'` (nur mit Verständnis für Abhängigkeiten) | Mittel |
| **Edge Function** mit Service Role, die `auth.admin.deleteUser` aufruft – nur für Admins, mit Audit-Log | Höher |

**Kundenportal-Zuweisungen:** In der App kann ein Portal-Eintrag (`customer_portal_users`) entfernt werden – das ist **nicht** dasselbe wie den Auth-User zu löschen.

## Neue Installationen

Langfristig können die gleichen `ON DELETE`-Regeln in **`supabase-complete.sql`** verankert werden (Greenfield). Bestehende Projekte: Migration oben.
