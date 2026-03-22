# Hell / Dunkel (Theme)

## Gemeinsame Logik: `shared/ThemeContext.tsx`

- **Lokal:** `localStorage` unter **`vico-theme`** (`light` | `dark` | `system`).
- **Server (Sync):** Spalte **`profiles.theme_preference`** – gleiche Werte; wird beim Login gelesen und in der **Haupt-App unter Profil** beim Umschalten geschrieben. **Kundenportal** speichert zusätzlich beim Icon-Wechsel; **Arbeitszeit-Portal** hat keinen eigenen Schalter (nur Sync).
- **Standard:** **`system`** – folgt `prefers-color-scheme`.
- **DOM:** `html` mit Klasse **`light`** / **`dark`** und **`data-theme`**; Tailwind: Haupt-App/AZ-Portal `darkMode: 'class'`, Kundenportal zusätzlich `[data-theme="dark"]`.
- **Meta:** `theme-color` hell `#5b7895`, dunkel `#0f172a`.

## Hilfsfunktionen

- `shared/themePreferenceDb.ts` – `fetchProfileThemePreference` / `saveProfileThemePreference` (Supabase)
- `src/lib/userService.ts` – `updateThemePreference` (Haupt-App, inkl. Profil-Cache)
- `src/components/ThemePreferenceSync.tsx` – lädt Profil nach Login (Haupt-App)
- `portal/src/components/ThemePreferenceSync.tsx` – lädt nach Login (Kundenportal)
- `arbeitszeit-portal/src/components/ThemePreferenceSync.tsx` – lädt nach Login (nur wenn Zugriff Admin/Teamleiter)

## Migration Kundenportal

Alte Keys **`vico-portal-theme`** werden beim ersten Lesen nach **`vico-theme`** übernommen (`shared/ThemeContext.tsx`).

## Datenbank

Neue Migration: **`supabase-migrations/add-theme-preference.sql`** (auch in **`supabase-complete.sql`**).

**Nach dem Einspielen des SQL auf dem Supabase-Projekt:**

- Es ist **kein „Restart“** des Supabase-Servers nötig – Postgres übernimmt Schemaänderungen sofort.
- **Edge Functions** nur neu deployen, wenn sich dort Code geändert hat (nicht bei `supabase-complete.sql` allein).
- **Frontend** (Haupt-App, Admin, Portale): **neu bauen/deployen**, damit der Code mit `theme_preference` und Sync ausgeliefert wird.

Das **Arbeitszeit-Portal** ist eine **statische Vite-App** – kein eigener Server; sichtbar werden Änderungen nach **Deploy** des Portal-Builds. Ohne Migration bleibt `theme_preference` NULL → es gilt nur `localStorage` + `system`.

## Farben & Lesbarkeit (Portal)

- **Hintergrund Dunkel:** `#0f172a` (Kundenportal und Arbeitszeit-Portal abgestimmt).
- **`vico`** in Tailwind: `primary`, `primary-hover`, `primary-light` (Portale wie Kundenportal).
- **`@layer base`** in `portal/src/index.css` und `arbeitszeit-portal/src/index.css`: Textfarbe/Placeholder/Fokus für `input`/`select`/`textarea` im Dunkelmodus (Primary-Ring beim Fokus).
