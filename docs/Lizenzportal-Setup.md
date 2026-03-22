# Lizenzportal – Setup & Admin-Benutzer

## 1. Supabase-Projekt anlegen

1. [Supabase Dashboard](https://supabase.com/dashboard) → New Project
2. Projekt erstellen (Region, Passwort notieren)
3. **SQL Editor** → `supabase-license-portal.sql` einfügen und ausführen

**Modul-Keys & Kontingente:** siehe **`docs/Lizenz-Features.md`**.

## 2. Ersten Admin-Benutzer anlegen

### Variante A: Über Supabase Dashboard (empfohlen)

1. Im Lizenzportal-Supabase: **Authentication** → **Users**
2. **Add user** → **Create new user**
3. E-Mail und Passwort eingeben
4. **Create user** klicken

Der Trigger `on_auth_user_created` legt automatisch ein Profil mit `role = 'admin'` an.

### Variante B: Über Admin-App (Signup)

1. Admin-App öffnen (z.B. `http://localhost:5173` oder deployte URL)
2. Auf **„Konto anlegen“** klicken (falls aktiviert)
3. E-Mail und Passwort eingeben
4. Nach Bestätigung (falls E-Mail bestätigt) einloggen

---

## 3. Admin-App verbinden

`.env` im `admin/`-Verzeichnis:

```
VITE_SUPABASE_URL=https://<projekt-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Keys: Supabase Dashboard → **Settings** → **API**

---

## 4. Supabase Auth konfigurieren

**Authentication** → **URL Configuration**:
- **Site URL:** z.B. `http://localhost:5173` (Dev) oder `https://lizenz.amrtech.de` (Prod)
- **Redirect URLs:** `http://localhost:5173/**`, `https://lizenz.amrtech.de/**` hinzufügen

## 5. E-Mail-Bestätigung (optional)

Standardmäßig verlangt Supabase E-Mail-Bestätigung. Für lokale Entwicklung:

**Authentication** → **Providers** → **Email** → **Confirm email** deaktivieren

Dann wird nach Signup direkt eine Session erstellt, kein E-Mail-Link nötig.

---

## 6. Login testen

1. Admin-App starten: `cd admin && npm run dev`
2. Mit der angelegten E-Mail/Passwort einloggen
3. Mandanten-Liste und Lizenz-Seite sollten sichtbar sein

---

## 7. Lizenz-API (für Mandanten-App)

Damit die Haupt-App (5173) Lizenzen vom Lizenzportal nutzen kann, wird eine **Supabase Edge Function** verwendet (Option D – kein Service-Role-Key in Netlify nötig).

### Edge Functions deployen

**Wichtig:** Alle drei Functions müssen deployed sein (Lizenz-Check, Grenzüberschreitungen, Impressum):

```bash
cd supabase-license-portal
supabase link --project-ref ojryoosqwfbzlmdeywzs
supabase functions deploy license
supabase functions deploy limit-exceeded
supabase functions deploy update-impressum
```

Oder alle auf einmal: `supabase functions deploy`

Die Functions nutzen automatisch `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` des Lizenzportal-Projekts (von Supabase bereitgestellt).

### Haupt-App konfigurieren

In der Haupt-App `.env`:

```
VITE_LICENSE_API_URL=https://ojryoosqwfbzlmdeywzs.supabase.co/functions/v1
```

### Mandanten-Branding (App-Name & Logo)

Im **Lizenz-Admin** unter **Mandant bearbeiten** (neben App-Name und Primärfarbe):

- **Logo-URL:** öffentlich erreichbare Bild-URL (HTTPS empfohlen, z. B. Datei im **Supabase Storage** des Mandanten mit öffentlichem Bucket oder CDN). Wird in der **Lizenz-API** als `design.logo_url` ausgeliefert und von **Haupt-App** (`Logo.tsx`), **Kundenportal**, **Arbeitszeitenportal** und (Druck) **QR-Modal** genutzt.  
- Ohne Logo: Standard `public/logo_vico.png` bzw. bisheriges Platzhalter-Icon im Kundenportal.

**CORS:** Wird das Logo von einer anderen Domain geladen als die App, muss der Server ggf. `Access-Control-Allow-Origin` setzen (bei reinem `<img src="…">` meist unkritisch; bei Canvas/Export beachten).

### Hinweise vor Release

> **Vor dem Release auf Netlify:** Lizenz-Architektur nochmals überdenken. Aktuell: Supabase Edge Function. Alternative: Netlify Function mit Service-Role-Key (siehe `admin/netlify/functions/license.ts`).
>
> **Ladezeiten:** Lizenzportal-Ladezeiten sind zum Teil noch lang – wird beobachtet.

### Ladezeiten

Lizenzportal-Ladezeiten werden beobachtet. Bei langen Ladezeiten: Netzwerk, Supabase-Region, Caching prüfen.

### Supabase Keep-Alive (Pause vermeiden)

Free-Tier-Projekte pausieren nach 7 Tagen Inaktivität. GitHub Action hält das Projekt aktiv:

**Repository Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Wert |
|--------|------|
| `SUPABASE_LICENSE_PORTAL_URL` | `https://ojryoosqwfbzlmdeywzs.supabase.co` |
| `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` | Service-Role-Key aus Supabase |

Workflow: `.github/workflows/supabase-license-portal-keepalive.yml` (Mo + Do 9:00 UTC)

### Fallback: Netlify Functions (optional)

Falls die Edge Functions nicht genutzt werden, deployet die Admin-App auf Netlify mit den Netlify-Functions (`license`, `limit-exceeded`, `update-impressum`). In Netlify die Env-Vars setzen:

| Variable | Wert |
|----------|------|
| `SUPABASE_LICENSE_PORTAL_URL` | `https://<projekt-ref>.supabase.co` |
| `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` | Service-Role-Key aus Supabase |

In der Haupt-App: `VITE_LICENSE_API_URL=https://lizenz.amrtech.de/api` (oder die Admin-URL + `/api`)

---

## Fehlerbehebung: Grenzüberschreitungen erscheinen nicht im Lizenzportal

| Ursache | Lösung |
|---------|--------|
| **limit-exceeded nicht deployed** | `supabase functions deploy limit-exceeded` ausführen (Supabase Edge Functions) |
| **Netlify: Env-Vars fehlen** | `SUPABASE_LICENSE_PORTAL_URL` und `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` in Netlify setzen |
| **VITE_LICENSE_API_URL nicht gesetzt** | In der Haupt-App `.env`: `VITE_LICENSE_API_URL` = Supabase Edge Functions URL oder Netlify + `/api` |
| **Lizenz nicht gefunden (404)** | `license_number` muss in der Lizenzportal-Tabelle `licenses` existieren; Lizenz aktivieren |
| **CORS** | Supabase Edge Functions erlauben CORS; Netlify: `Access-Control-Allow-Origin: *` in der Function |

---

## Fehlerbehebung: „Admin-Konto erstellen hat nicht geklappt“

| Fehler / Verhalten | Lösung |
|--------------------|--------|
| **„Registrierung ist deaktiviert“** | Supabase: **Authentication** → **Providers** → **Email** → **Enable email signup** aktivieren |
| **„Bitte E-Mail bestätigen“** (kein Login) | **Confirm email** deaktivieren (siehe Abschnitt 5) ODER E-Mail-Link klicken (Spam prüfen) |
| **„Diese E-Mail ist bereits registriert“** | Statt Signup: Einfach anmelden. Oder andere E-Mail verwenden. |
| **„Passwort muss mindestens 6 Zeichen haben“** | Mindestens 6 Zeichen eingeben |
| **Keine Fehlermeldung, aber nichts passiert** | Browser-Konsole öffnen (F12) → Fehler prüfen. Prüfen: Verbindet die Admin-App das **Lizenzportal-Supabase**? (`.env` mit `VITE_SUPABASE_URL` des Lizenzportal-Projekts) |
| **„Zugriff verweigert“ nach Login** | Trigger `handle_new_user` prüfen: Wurde `supabase-license-portal.sql` vollständig ausgeführt? Profil mit `role=admin` muss existieren. |

---

## Fehlerbehebung: „column tenants.arbeitszeitenportal_domain does not exist“

| Ursache | Lösung |
|---------|--------|
| **Schema veraltet** | Die Tabelle `tenants` wurde vor der Spalte `arbeitszeitenportal_domain` angelegt. Migration ausführen: |

**Migration im Supabase SQL Editor (Lizenzportal-Projekt) ausführen:**

```sql
alter table public.tenants add column if not exists arbeitszeitenportal_domain text;
```

Oder die Datei `supabase-license-portal-migrations/add-arbeitszeitenportal-domain.sql` im SQL Editor einfügen und ausführen.
