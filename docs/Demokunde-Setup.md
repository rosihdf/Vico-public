# Demokunde als Mandant (Phase 6)

## Übersicht

Der Demokunde ist ein echter Mandant im Lizenzportal mit eigener Supabase + Hosting-Site (z.B. `demo.app.example.de`).

## Schritte

### 1. Mandant im Lizenzportal anlegen

1. Lizenzportal öffnen (http://localhost:5175 oder https://portal.example.de)
2. **Neuer Mandant** → Name z.B. „Demo“ oder „Demo Mandant“
3. Stammdaten: App-Domain `demo.app.example.de`, Portal-Domain `portal.demo.app.example.de` (oder ähnlich)
4. Corporate Design: Logo, Farben nach Wunsch

### 2. Lizenz anlegen

1. Mandant bearbeiten → **Lizenz anlegen**
2. Tier: z.B. Enterprise (alle Features)
3. Gültig bis: leer oder weit in der Zukunft
4. Max. Benutzer/Kunden: nach Bedarf (z.B. 5/10 für Demo)
5. Features: alle aktivieren (kundenportal, historie, arbeitszeiterfassung)
6. Prüfintervall: täglich

### 3. Supabase-Projekt für Demo

1. Neues Supabase-Projekt anlegen (oder bestehendes Demo-Projekt nutzen)
2. `supabase-complete.sql` ausführen (ohne Lizenz-Tabelle bei API-Modus)
3. Auth: Site URL = `https://demo.app.example.de`, Redirect URLs hinzufügen

### 4. Netlify-Site

1. Neue Netlify-Site aus Haupt-App-Build
2. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Demo-Supabase)
3. Env: `VITE_LICENSE_API_URL` = `https://<lizenzportal-ref>.supabase.co/functions/v1`
4. Custom Domain: `demo.app.example.de`

### 5. Demo-Benutzer

1. Im Demo-Supabase: Auth → Users → Create user
2. z.B. demo@demo.de / Testpasswort
3. Profil mit Rolle „demo“ oder „mitarbeiter“

### 6. 24h-Löschung (optional)

Für Demo-Daten: Cronjob oder Supabase Edge Function löscht Daten älter als 24h. Siehe `supabase-complete.sql` – `cleanup_demo_data`.
