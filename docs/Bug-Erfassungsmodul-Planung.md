# Bug-Erfassungsmodul – Automatische Erfassung und Speicherung von Fehlern

**Stand:** Februar 2025  
**Ziel:** Modul, das mögliche Bugs/Fehler in der App automatisch erfasst und in der Datenbank speichert, damit Admins sie zentral einsehen und bearbeiten können.

---

## 1. Überblick

| Aspekt | Inhalt |
|--------|--------|
| **Erfassung** | Unbehandelte JavaScript-Fehler, abgelehnte Promises, React-Error-Boundary-Fehler, ggf. initialer App-Start-Fehler |
| **Speicherung** | Neue Tabelle `app_errors` in Supabase; RLS: nur eingeloggte User dürfen eintragen (insert), nur Admins lesen |
| **Kontext** | Fehlermeldung, Stack (optional), Quelle (Haupt-App/Portal/Admin), Pfad/URL, User-Agent, User-ID, Zeitstempel |
| **Auswertung** | Admin-Ansicht (z. B. unter Historie oder eigener Menüpunkt „Fehlerberichte“): Liste, Filter, Status, ggf. Gruppierung/Deduplizierung |

---

## 2. Datenmodell

### 2.1 Tabelle `app_errors`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid | PK, default gen_random_uuid() |
| `user_id` | uuid | FK → profiles(id) ON DELETE SET NULL, nullable (Fehler vor Login oder ohne User) |
| `source` | text | Herkunft: `main_app` \| `portal` \| `admin` |
| `message` | text | Fehlermeldung (z. B. error.message), max. Länge z. B. 2000 Zeichen |
| `stack` | text | optionale Stack-Trace (error.stack), max. z. B. 8000 Zeichen |
| `path` | text | aktueller Pfad/URL (z. B. window.location.pathname + search) |
| `user_agent` | text | Browser/App (navigator.userAgent), gekürzt möglich |
| `created_at` | timestamptz | default now() |
| `status` | text | optional: `new` \| `acknowledged` \| `resolved`, default `new` |
| `fingerprint` | text | optional: Hash/Zeichenkette zur Gruppierung gleicher Fehler (z. B. message + erste Zeile Stack) |

**Constraints:**

- `source` CHECK IN ('main_app','portal','admin')
- `status` CHECK IN ('new','acknowledged','resolved')
- `message` NOT NULL

**RLS:**

- **INSERT:** Jeder authentifizierte User darf einen Eintrag für sich erstellen (with check: user_id = auth.uid() or user_id is null). Alternativ: Jeder authentifizierte User darf inserten, user_id wird serverseitig aus auth.uid() gesetzt (z. B. per RPC).
- **SELECT:** Nur Admins (is_admin()).
- **UPDATE:** Nur Admins (z. B. Status ändern).
- **DELETE:** Optional nur Admins (z. B. zum Aufräumen alter Einträge).

Fehler **vor** dem Login (z. B. beim App-Start oder in Login-Komponente): Entweder nur erfassen, wenn bereits ein User eingeloggt ist, oder eine RPC-Funktion anbieten, die ohne Auth aufgerufen werden kann und nur bestimmte Felder schreibt (dann ohne user_id). Empfehlung: Nur bei eingeloggten Usern automatisch senden; bei nicht eingeloggtem User nur in der Konsole loggen oder lokale Queue, die nach Login nachgesendet wird.

---

## 3. Erfassungsquellen (Client)

### 3.1 Globale Handler

- **window.onerror:** Unbehandelte Synchron-Fehler. Parameter: message, source (url), lineno, colno, error (Error-Objekt). Payload: message, stack aus error, path = source oder location.pathname.
- **window.onunhandledrejection:** Abgelehnte Promises (event.reason). Payload: message und ggf. stack aus reason (falls Error).

Beide Handler so früh wie möglich registrieren (z. B. in main.tsx nach initTheme, vor React-Render). Im Handler: Payload bauen, **nicht blockierend** an Backend senden (fetch oder Supabase insert), bei Fehler nur console.error (keine Rekursion).

### 3.2 React Error Boundary

- Bestehende **ErrorBoundary**-Komponente erweitern: In `componentDidCatch(error, errorInfo)` die Fehlerdetails (error.message, error.stack, errorInfo.componentStack) an denselben Report-Service senden.
- Danach weiterhin Fallback-UI anzeigen (wie bisher).

### 3.3 Initialer App-Start-Fehler

- In **main.tsx** im catch-Block von init(): Vor dem Anzeigen der Fehlerseite (handleError) einmalig den Fehler an den Report-Service senden. Zu diesem Zeitpunkt ist ggf. noch kein User eingeloggt → entweder mit user_id = null speichern (wenn RLS/RPC das erlaubt) oder weglassen und nur lokal anzeigen.

### 3.4 Keine doppelte Flut

- **Debounce/Deduplizierung:** Gleicher Fehler (z. B. gleiche message + gleicher Stack-Anfang) innerhalb von X Sekunden nur einmal senden (in-memory Set + TTL).
- Optional: **fingerprint** aus message + normalisierter erster Stack-Zeile hashen und in DB speichern; Admin-UI kann dann nach Fingerprint gruppieren („N Fehler mit gleichem Muster“).

---

## 4. Client-Implementierung (Struktur)

### 4.1 Fehler-Report-Service (`src/lib/errorReportService.ts`)

- **reportError(payload):** Payload = { message, stack?, path?, source, userAgent? }. Wenn online und eingeloggt (supabase.auth.getUser()): Supabase insert in `app_errors` oder RPC `report_app_error(...)`. Bei nicht eingeloggt: optional in localStorage als Queue, nach nächstem Login nachsenden.
- **Deduplizierung:** Gleicher Schlüssel (z. B. message + erste Zeile stack) innerhalb von z. B. 30 s nur einmal senden.
- **Quelle:** Beim Aufruf aus Haupt-App `source = 'main_app'`, aus Portal `'portal'`, aus Admin `'admin'` (z. B. über Build-Ziel oder Konfiguration).

### 4.2 Registrierung in main.tsx (Haupt-App)

- Nach Theme-Init: window.onerror und window.onunhandledrejection setzen; beide rufen reportError mit source = 'main_app' auf.
- In init() catch: reportError aufrufen, danach handleError wie bisher.

### 4.3 ErrorBoundary anbinden

- ErrorBoundary bekommt optional eine report-Funktion als Prop oder importiert den errorReportService direkt. In componentDidCatch: reportError({ message, stack, path: window.location.pathname + window.location.search, source: 'main_app', userAgent }).

### 4.4 Portal und Admin

- Gleiche Logik: In portal/main.tsx und admin/main.tsx jeweils globale Handler + ErrorBoundary mit source = 'portal' bzw. 'admin'. Dafür muss das gleiche Supabase-Projekt (Haupt-App) verwendet werden bzw. die gleiche Tabelle; Portal/Admin nutzen dieselbe Supabase-URL/Key wie die Haupt-App, dann landen alle Fehler in derselben Tabelle.

---

## 5. Backend (Supabase)

### 5.1 Schema (supabase-complete.sql)

- Tabelle `app_errors` wie in Abschnitt 2.1.
- RLS-Policies: Insert für authenticated (nur eigene user_id oder user_id null), Select/Update/Delete nur für is_admin().
- Optional: RPC `report_app_error(p_message text, p_stack text, p_path text, p_source text)` die user_id aus auth.uid() setzt und insert ausführt (dann kann man user_id nicht manipulieren).
- Indizes: created_at desc, status, source, optional fingerprint.

### 5.2 Audit

- Optional: Kein audit_trigger für app_errors (um keine Schleife zu erzeugen); oder nur INSERT nicht loggen.

---

## 6. Admin-UI

### 6.1 Ort

- **Variante A:** Neuer Menüpunkt „Fehlerberichte“ (nur Admin), Route z. B. `/fehlerberichte` oder `/fehler`.
- **Variante B:** Unter „Historie“ einen Tab „Fehlerberichte“ oder Unterbereich.

### 6.2 Inhalt

- Tabelle/Liste: Datum, Quelle (main_app/portal/admin), Meldung (gekürzt), Pfad, User (Anzeigename oder „–“), Status.
- Filter: Zeitraum, Quelle, Status (neu/angesehen/behoben).
- Detail: Klick auf Zeile → Modal oder Seite mit voller Meldung, Stack, User-Agent, Datum; Buttons „Als angesehen“ / „Als behoben“ (Status-Update).
- Optional: Gruppierung nach fingerprint mit Zähler „N× gleicher Fehler“.

### 6.3 Berechtigung

- Nur Rolle Admin; Route und Menüpunkt nur anzeigen, wenn userRole === 'admin'.

---

## 7. Datenschutz und Sicherheit

- **Inhalt:** Keine sensiblen Daten in message/stack abspeichern (z. B. keine Passwörter). Stack kann Dateinamen/Quellcode-Pfade enthalten – in vielen Fällen unkritisch; optional Stack kürzen oder nur in geschütztem Bereich anzeigen.
- **Zugriff:** Nur Admins sehen Fehlerberichte; RLS erzwingt das.
- **Speicherdauer:** Optional automatische Löschung nach X Monaten (Cron oder Supabase Edge Function), um DSGVO-Konformität zu vereinfachen.

---

## 8. Zusammenfassung der Umsetzungsschritte

| Nr. | Schritt | Beschreibung |
|-----|---------|--------------|
| 1 | Schema | Tabelle `app_errors` in supabase-complete.sql anlegen, RLS, optional RPC report_app_error |
| 2 | Service | errorReportService.ts: reportError(), Deduplizierung, Supabase-Insert (oder RPC) |
| 3 | Haupt-App | main.tsx: window.onerror, onunhandledrejection, init-catch an reportError anbinden |
| 4 | ErrorBoundary | componentDidCatch → reportError aufrufen |
| 5 | Portal/Admin | Gleiche Handler + ErrorBoundary mit source portal/admin (wenn gleiche DB) |
| 6 | Admin-UI | Route /fehlerberichte (oder unter Historie), Liste + Filter + Detail + Status-Update |

---

## 9. Verweise

- **ErrorBoundary:** `src/ErrorBoundary.tsx`
- **main.tsx:** `src/main.tsx` (init, handleError)
- **Historie:** `src/Historie.tsx` (Analogie für Admin-Only-Listen)
- **Supabase/RLS:** `supabase-complete.sql`, audit_log, is_admin()

---

*Nach Freigabe kann mit Schritt 1 (Schema) und 2 (Service) begonnen werden; danach schrittweise Client und Admin-UI.*
