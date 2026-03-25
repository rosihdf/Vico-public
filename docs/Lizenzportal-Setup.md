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

## 7. Lizenz-API (für Mandanten-App & Portale)

Die Haupt-App und die **Portale** rufen die Lizenz per HTTP ab: `GET …/license?licenseNumber=…` **oder** (Portale) `GET …/license` **ohne** Query – dann **Host-Lookup** per Browser-`Origin` (siehe `docs/Netlify-README.md`). Es gibt zwei übliche Server-Varianten – **wähle eine** und halte `VITE_LICENSE_API_URL` konsistent:

| Variante | `VITE_LICENSE_API_URL` (Beispiel) | Server-Geheimnis |
|----------|-----------------------------------|------------------|
| **A) Netlify Functions** (Admin-Site, Legacy) | `https://<admin-site>/api` | `SUPABASE_LICENSE_PORTAL_*` nur in **Netlify Env der Admin-Site** (Service Role) |
| **B) Supabase Edge Functions** | `https://<ref>.supabase.co/functions/v1` | Von Supabase für die Functions gesetzt |

**Standard im Repo (CF1):** Variante **B** – Mandanten-Frontends nur statisch (Cloudflare Pages); **`docs/Cloudflare-Umzug-Roadmap.md`**. **Env-Skript:** **`docs/Cloudflare-Mandanten-Env-Skript.md`**. Variante **A** bleibt im Tag **`last-stand-netlify`** und unter `admin/netlify.toml` nachvollziehbar.

### Edge Functions deployen (Variante B)

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

### Haupt-App / Portale konfigurieren

**Haupt-App** (`.env` lokal bzw. Netlify Env):

```env
# Variante B (Edge):
# VITE_LICENSE_API_URL=https://ojryoosqwfbzlmdeywzs.supabase.co/functions/v1

# Variante A (Netlify Admin, ohne Slash am Ende):
# VITE_LICENSE_API_URL=https://<admin-site>/api
```

**Kundenportal & Arbeitszeitenportal:** zusätzlich **`VITE_LICENSE_NUMBER`** (exakt wie `licenses.license_number`) – siehe **`docs/Netlify-Vier-Apps.md`** §3–4.

### Mandanten-Branding (App-Name & Logo)

Im **Lizenz-Admin** unter **Mandant bearbeiten** (neben App-Name und Primärfarbe):

- **Logo-URL:** öffentlich erreichbare Bild-URL (HTTPS empfohlen, z. B. Datei im **Supabase Storage** des Mandanten mit öffentlichem Bucket oder CDN). Wird in der **Lizenz-API** als `design.logo_url` ausgeliefert und von **Haupt-App** (`Logo.tsx`), **Kundenportal**, **Arbeitszeitenportal** und (Druck) **QR-Modal** genutzt.  
- Ohne Logo: Standard `public/logo_vico.png` bzw. bisheriges Platzhalter-Icon im Kundenportal.

**CORS:** Wird das Logo von einer anderen Domain geladen als die App, muss der Server ggf. `Access-Control-Allow-Origin` setzen (bei reinem `<img src="…">` meist unkritisch; bei Canvas/Export beachten).

### Haupt-App: Login, neue Geräte, Konten

| Thema | Verhalten |
|-------|-----------|
| **Neues Gerät / leerer Browser** | Nach erfolgreichem Login holt die App die Lizenznummer in dieser Reihenfolge: **`public.license.license_number`** (Mandanten-Supabase, RPC `get_license_number`), optional **`VITE_LICENSE_NUMBER`** (Build-Env), sonst **Lizenz-API-Host-Lookup** (`GET …/license` ohne Query, Browser-`Origin` wie bei den Portalen). Die API-Antwort enthält `license_number`, damit die Nummer lokal gespeichert werden kann. |
| **Mandanten-DB** | Fehlt die Nummer in `public.license`, schreibt ein **Admin** sie nach Host-Lookup beim ersten Login mit (RPC `set_license_number`). |
| **Manuelle Aktivierung** | Nur Fallback: Screen **Lizenz aktivieren** (`/aktivierung`), wenn weder DB, Host-Lookup noch Env greifen (z. B. lokaler Test ohne Domain). |
| **Konten** | **Keine Selbstregistrierung** an der Login-Seite der Haupt-App. Alle Konten legt der **Mandanten-Admin** an (Benutzerverwaltung / Einladung). In **Supabase Auth** des Mandantenprojekts: **Email Signup** deaktivieren, wenn nur noch Admin-angelegte Nutzer erlaubt sein sollen. |

### Lizenzänderung an Mandanten-Apps signalisieren (Push)

Mandanten-Apps nutzen für die Lizenz ein **Intervall** (`check_interval`: täglich/wöchentlich). Wenn du Features, Design oder Limits im Lizenzportal änderst, sollen Nutzer **nicht** auf dieses Intervall warten und **keine** manuelle „Lizenz neu laden“-Aktion in der Haupt-App brauchen:

| Bestandteil | Beschreibung |
|-------------|--------------|
| **DB** | Spalte `licenses.client_config_version` (nicht negativ, Start bei 0). Migration in `supabase-license-portal.sql` – bei bestehenden Projekten den neuen Block im SQL Editor ausführen. |
| **Lizenz-API** | Liefert `license.client_config_version` in der JSON-Antwort (Netlify Function `admin/netlify/functions/license.ts` und/oder Edge `supabase-license-portal/supabase/functions/license/index.ts`). |
| **Admin** | **Mandant bearbeiten** → Bereich **Deployment / Netlify** → **Jetzt signalisieren** erhöht die Version um 1 für die gewählte Lizenz. |
| **Haupt-App** | Vergleicht die API-Version mit dem lokalen Cache: **Poll ca. alle 90 s**, bei **Tab-Fokus**, und **einmal kurz nach App-Start** – bei Abweichung → vollständiger Lizenz-Refresh (`force`). |

**Hinweis:** Es gibt keinen echten Server-Push an alle Geräte; die Apps **holen** die aktuelle Lizenz über die bestehende URL. Typische Verzögerung bis zur Anzeige: **1–2 Minuten**, oft schneller bei **sichtbarem Tab** oder **neuem Laden** der Seite. Nach Schema-Änderung: Lizenzportal-SQL migrieren, Functions/Admin neu deployen, Haupt-App neu bauen.

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

### Variante A: Netlify Functions (Admin-Site)

Die Admin-App bringt Netlify-Functions mit (`license`, `limit-exceeded`, `update-impressum`). **Pflicht** für die Functions (nur Server, nie im Browser):

| Variable (Netlify → Site der **Admin**-App) | Wert |
|----------|------|
| `SUPABASE_LICENSE_PORTAL_URL` | `https://<projekt-ref>.supabase.co` |
| `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` | Service-Role-Key aus dem Lizenzportal-Supabase |

In **Haupt-App** und **Portalen**: `VITE_LICENSE_API_URL=https://<admin-site>/api` (ohne abschließenden Slash).

Ohne die beiden `SUPABASE_LICENSE_PORTAL_*` liefert die Function u. a. **`License portal not configured`** (HTTP 500).

---

## Fehlerbehebung: Grenzüberschreitungen erscheinen nicht im Lizenzportal

| Ursache | Lösung |
|---------|--------|
| **limit-exceeded nicht deployed** | `supabase functions deploy limit-exceeded` ausführen (Supabase Edge Functions) |
| **Netlify: Env-Vars fehlen** | `SUPABASE_LICENSE_PORTAL_URL` und `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` in Netlify setzen |
| **VITE_LICENSE_API_URL nicht gesetzt** | Haupt-App / Portale: in Netlify Env setzen; nach Änderung **neu bauen**. Kundenportal/Arbeitszeit: auch **`VITE_LICENSE_NUMBER`**. |
| **Lizenz nicht gefunden (404)** | `license_number` muss in `licenses` existieren und mit Eingabe/Env übereinstimmen |
| **CORS / Haupt-App „kaputt“, direkter API-Test ok** | Browser sendet `Origin`; Netlify-Function `license` setzt CORS (siehe Repo). **`allowed_domains`** im Mandanten um den Host der App ergänzen (§11 in `Netlify-Vier-Apps.md`). |
| **Edge vs. Netlify gemischt** | `VITE_LICENSE_API_URL` und Deployments nicht zwischen Edge-URL und `/api` ohne Absprache mischen |

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
