# Vier Apps auf Netlify – Schrittfolge

Diese Anleitung bezieht sich auf das Monorepo **Vico** mit vier deploybaren Frontends:

| App | Verzeichnis | Typische Netlify-Site |
|-----|-------------|------------------------|
| **Haupt-App** | `/` (Repo-Root) | z. B. `app.deinedomain.de` |
| **Lizenzportal (Admin)** | `admin/` | z. B. `admin.deinedomain.de` |
| **Kundenportal** | `portal/` | z. B. `portal.deinedomain.de` |
| **Arbeitszeitenportal** | `arbeitszeit-portal/` | z. B. `zeit.deinedomain.de` |

> **Platzhalter:** In dieser Doku `deinedomain.de` / `app.…` – echte Werte trägst du in **Netlify (Env + Custom Domain)** und im **Lizenzportal** bei jedem Mandanten ein.

### Domain-Felder in der Lizenzsteuerung (`tenants`)

Die Mandanten-Tabelle enthält (u. a.) **`app_domain`**, **`portal_domain`**, **`arbeitszeitenportal_domain`** – das ist die **fachliche Zuordnung**, welche URL zu welcher App gehört (Doku, Support, `allowed_domains`-Prüfung in der Lizenz-API).

| Feld | Typische Bedeutung |
|------|-------------------|
| `app_domain` | Hostname der **Haupt-App** (z. B. `app.kunde.de`) |
| `portal_domain` | **Kundenportal** |
| `arbeitszeitenportal_domain` | **Arbeitszeitenportal** |

**Hinweis:** Eine **eigene Spalte „Admin/Lizenz-Subdomain“** gibt es nicht – die URL des **Lizenzportals** (Admin-App + optional `/api`) legst du in **Netlify** und in interner Doku fest; `allowed_domains` kannst du im Mandanten ergänzen, damit die Lizenz-API nur von diesen Hosts aus erreichbar ist.

**Wichtig:** `VITE_LICENSE_API_URL` wird beim **Build** der jeweiligen App gesetzt (Netlify Env). Die Mandanten-Felder **ersetzen** das nicht automatisch – sie sollten aber **dieselben Hosts** beschreiben, die du bei IONOS → Netlify verbindest.

### DNS bei IONOS → Netlify

- **Hosting** der statischen Apps und Functions: **Netlify**.
- **IONOS:** nur **DNS** (A/CNAME auf die von Netlify angegebenen Ziele). SSL: **Netlify** (Let's Encrypt).

---

## 0. Voraussetzungen

1. **Git-Repo** bei GitHub/GitLab/Bitbucket (Netlify verbindet sich damit).
2. **Supabase-Projekte** angelegt:
   - **Mandanten-DB** (Haupt-App + ggf. Portale pro Mandant – je nach Architektur).
   - **Lizenzportal-DB** (nur für `admin/` und Lizenz-API).
3. **Lizenzportal-SQL** (`supabase-license-portal.sql`) im Lizenzportal-Projekt ausgeführt, inkl. `platform_config` / `default_app_versions`.

---

## 1. Haupt-App (Root)

**Build settings (Netlify UI oder `netlify.toml`):**

- **Base directory:** leer (Repository-Root)
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Node:** 20.x – im Repo bereits gesetzt: **`[build.environment]` → `NODE_VERSION = "20"`** in der jeweiligen `netlify.toml` (Root, `admin/`, `portal/`, `arbeitszeit-portal/`). **Du musst dafür nichts in der Netlify-Oberfläche eintragen**, solange die Site aus dem Repo baut und die `netlify.toml` aus dem richtigen Ordner gilt (bei Base directory `admin` → `admin/netlify.toml`).

**Umgebungsvariablen (Beispiele – Namen aus `import.meta.env` / Code prüfen):**

| Variable | Beispiel / Beschreibung |
|----------|-------------------------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` (Mandanten-Projekt) |
| `VITE_SUPABASE_ANON_KEY` | Anon Key aus Supabase Dashboard |
| `VITE_LICENSE_API_URL` | Basis-URL der Lizenz-API, z. B. `https://<projekt>.supabase.co/functions/v1` **oder** `https://admin.deinedomain.de/api` wenn Netlify-Redirect zur Function |
| `VITE_LICENSE_API_KEY` | Optional: Supabase **anon** Key, wenn Edge `verify_jwt=true` |

**Nach Deploy:** PWA/HTTPS prüfen, `version.json` unter `/version.json` erreichbar.

**Optional:** `npm run build:checklist` lokal ausführen, wenn die PDF-Checkliste neu erzeugt werden soll (liegt unter `public/`; Standard-Build erzeugt sie **nicht** mehr bei jedem Lauf).

---

## 2. Lizenzportal (Admin) – `admin/`

**Build:**

- **Base directory:** `admin`
- **Build command:** `npm run build` (kopiert Doku, `tsc`, Vite)
- **Publish directory:** `admin/dist`

**Umgebungsvariablen:**

| Variable | Beschreibung |
|----------|--------------|
| `VITE_SUPABASE_URL` | **Lizenzportal**-Supabase URL (nicht Mandanten-DB) |
| `VITE_SUPABASE_ANON_KEY` | Anon Key Lizenzportal |

**Netlify Functions** (Lizenz-API-Fallback, siehe `admin/netlify.toml`):

| Variable (Netlify) | Beschreibung |
|---------------------|--------------|
| `SUPABASE_LICENSE_PORTAL_URL` | URL = gleiche Lizenzportal-DB |
| `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` | **Service Role** (nur Server-seitig, nie im Browser) |

Damit kann die Haupt-App die Lizenz-API z. B. unter `https://<admin-site>/api/license` aufrufen (Redirect gemäß `admin/netlify.toml`).

---

## 3. Kundenportal – `portal/`

**Build:**

- **Base directory:** `portal`
- **Build command:** `npm run build`
- **Publish directory:** `portal/dist`

**Umgebungsvariablen (typisch):**

| Variable | Beschreibung |
|----------|--------------|
| `VITE_SUPABASE_URL` | Supabase des **Kunden** (Mandanten-Projekt) |
| `VITE_SUPABASE_ANON_KEY` | Anon Key |
| `VITE_LICENSE_API_URL` | Wie Haupt-App |
| `VITE_LICENSE_NUMBER` | Lizenznummer dieses Deployments (pro Site/Mandant) |
| `VITE_LICENSE_API_KEY` | Optional, wie oben |

---

## 4. Arbeitszeitenportal – `arbeitszeit-portal/`

**Build:**

- **Base directory:** `arbeitszeit-portal`
- **Build command:** `npm run build`
- **Publish directory:** `arbeitszeit-portal/dist`

**Umgebungsvariablen:** analog Kundenportal (`VITE_LICENSE_*`, Supabase des Mandanten).

---

## 5. DNS & mehrere Sites

- Jede der vier Apps = **eigene Netlify-Site** (oder Monorepo mit unterschiedlichem Base directory).
- **Custom Domain:** Netlify → Domain settings → Add domain; beim Hoster **CNAME** oder A-Records auf Netlify setzen (Anleitung in Netlify).
- **Lizenz-API CORS:** Lizenz-Edge Function erlaubt `*`; für Produktion ggf. `allowed_domains` in `tenants` im Lizenzportal pflegen.

---

## 6. Datenbank – Kurz-Optimierung (bereits im Schema)

- **Lizenzportal:** `licenses.license_number` ist **unique** (Index durch Constraint). Weitere Indizes: `licenses_tenant_created_idx`, `limit_exceeded_log_tenant_created_idx` (siehe `supabase-license-portal.sql`).
- **Haupt-App (`supabase-complete.sql`):** bei langsamen Abfragen: `EXPLAIN ANALYZE` in Supabase SQL Editor; fehlende Indizes nur nach konkreten Queries ergänzen (nicht blind „Index-Spaß“).

---

## 7. Prüfen: Ist das Lizenzportal „angebunden“?

**A) Lizenzportal-Supabase**

- [ ] Projekt existiert, `supabase-license-portal.sql` ausgeführt (Tabellen `tenants`, `licenses`, `platform_config`, …).
- [ ] **Admin-App** lokal oder deployt: Login mit Admin-User → Mandantenliste lädt ohne Fehler.

**B) Lizenz-API (eine der beiden Varianten – nicht zwingend beide)**

| Variante | Prüfung |
|----------|---------|
| **Supabase Edge** | Dashboard → Edge Functions → `license` deployed. Test: Browser `GET https://<ref>.supabase.co/functions/v1/license?licenseNumber=VIC-…` (echte Lizenznummer) → JSON mit `license`, `design`. |
| **Netlify `/api`** (Admin-Site) | Netlify → Site `admin` → Env: `SUPABASE_LICENSE_PORTAL_URL`, `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` gesetzt. Deploy ok. Test: `GET https://<admin-subdomain>/api/license?licenseNumber=…` → gleiches JSON. |

**C) Haupt-App / Portale**

- [ ] In **Netlify** → Site der App → **Environment variables**: `VITE_LICENSE_API_URL` gesetzt (siehe unten).
- [ ] **Neuer Build** nach Env-Änderung (Vite bakes Env zur Build-Zeit ein).

---

## 8. Schritt für Schritt: `VITE_LICENSE_API_URL` in der Produktion prüfen

1. **Netlify** → deine **Haupt-App-Site** → **Site configuration** → **Environment variables**.
2. Prüfen, ob **`VITE_LICENSE_API_URL`** existiert und **ohne** abschließenden Slash ist, z. B.  
   - `https://<ref>.supabase.co/functions/v1` **oder**  
   - `https://admin.deinedomain.de/api`
3. **Wichtig:** Nach Änderung **Deploy** neu triggern (**Clear cache and deploy site** empfohlen).
4. **Im Browser** (öffentliche Haupt-App öffnen) → DevTools → **Network** → Filter `license` oder Seite **Info** / Lizenz aktivieren → es muss ein Request auf  
   `{VITE_LICENSE_API_URL}/license?licenseNumber=…`  
   gehen (Status **200**, JSON mit `license`).
5. **Alternativ:** In der gebauten App **kein** direkter Zugriff auf die Variable – aber in **Page Source** nach `supabase.co/functions` oder deiner Admin-Domain suchen ist unzuverlässig (minified). Aussagekräftig sind **Network-Tab** oder **Netlify Build-Log** (zeigt Env-Namen, nicht Secret-Werte).

Wenn **kein** Request auf die Lizenz-API: Variable fehlt, falscher Build, oder App nutzt noch **Legacy** ohne API (dann `isLicenseApiConfigured()` false).

---

## 9. Edge (`…/functions/v1`) vs. Admin-Netlify (`…/api`) – Empfehlung

| Kriterium | Supabase **Edge** | **Netlify** Admin `/api` |
|-----------|-------------------|----------------------------|
| **Wo läuft die Logik?** | Supabase-Infrastruktur | Netlify Functions (Server nah an Netlify-CDN) |
| **Client sieht** | Supabase-URL im Request (wenn so konfiguriert) | Deine **Admin-Subdomain** (`admin.…/api`) |
| **Geheimnis** | Anon-Key ggf. im Frontend (optional) | Service Role **nur** in Netlify-Env |
| **Wenn du Netlify irgendwann weglässt** | Lizenz-API bleibt über Supabase erreichbar | `/api` entfällt → Umstellung auf Edge oder anderen Server nötig |
| **Latenz** | Typisch: Client → Edge → DB (ein klarer Pfad) | Client → Netlify Function → DB (ein zusätzlicher Hop; meist wenige ms) |
| **Stabilität** | Beide produktionsreif; Cold Starts bei seltenem Traffic möglich |

**Festlegung (Projekt):** **`VITE_LICENSE_API_URL = https://<admin-subdomain>/api`** (Netlify Admin-Site + Redirect zu `license` Function). Service Role nur in Netlify Env der Admin-Site.

**Alternative** (nur wenn bewusst gewünscht): **Supabase Edge** `…/functions/v1` – siehe Tabelle oben.

**Performance:** Unterschiede sind meist **klein**. Nicht Edge und Netlify `/api` in derselben Umgebung mischen.

---

## 10. Checkliste nach Go-Live

- [ ] Alle vier Sites: HTTPS, keine Konsolen-Fehler beim Login
- [ ] Lizenz aktivieren / Lizenz-API liefert `appVersions` (inkl. globale Defaults + Mandant)
- [ ] `version.json` in jeder App erreichbar
- [ ] Service Role **nur** in Netlify/Edge, nie im Client
- [ ] Mandanten-Felder `app_domain` / `portal_domain` / `arbeitszeitenportal_domain` passen zu den echten IONOS/Netlify-Hostnamen

Bei Fragen zu **einer** konkreten Domain oder API-URL: Werte mit interner Doku / Mandanten-Stammdaten abgleichen.
