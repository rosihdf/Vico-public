# Roadmap: Umzug zu Cloudflare Pages (mit Supabase Edge Lizenz-API)

**Übergeordnete Planung & Entscheidungen:** [`Cloudflare-Umzug-und-Supabase-Auslagerung.md`](./Cloudflare-Umzug-und-Supabase-Auslagerung.md)  
**Architektur:** DNS bei **Cloudflare**; **vier Pages-Projekte** mit **Git**; **Variante B** – Lizenz-API nur **Supabase Edge** (`…/functions/v1`); vorerst **`*.pages.dev`**; Env-Automatisierung **wie Netlify-Skript** (neues CF-Skript); Netlify nach Go-Live **zuerst Reserve, dann löschen**.

Diese Datei trennt strikt: **(A) Umprogrammierung & technische Vorbereitung** → **(B) Go-Live & Betrieb**.

---

## Teil A – Umprogrammierung & Vorbereitung (vor Go-Live)

Ziel: Code, Konfiguration und Betriebsartefakte so anpassen, dass **ohne Netlify Functions** alle Apps mit **`VITE_LICENSE_API_URL` → Supabase Edge** laufen und **Cloudflare Pages** die SPAs korrekt ausliefert.

### A1. Lizenz-API (Supabase Edge) – Parität und Deploy

| # | Aufgabe | Details / Hinweise |
|---|---------|-------------------|
| A1.1 | **Edge Functions deployen** | Im Projekt **`supabase-license-portal/`**: `license`, `limit-exceeded`, `update-impressum` mit Supabase CLI auf das **Lizenzportal-Supabase** deployen (`supabase link`, `supabase functions deploy`). Siehe [`Lizenzportal-Setup.md`](./Lizenzportal-Setup.md). |
| A1.2 | **Parität zu Netlify prüfen** | Antwort-Codes, JSON-Shape, **CORS**, **OPTIONS**, Host-Lookup (`Origin`/`Referer`) wie `admin/netlify/functions/*.ts`. Abweichungen beheben **nur in Edge**, nicht doppelt in Netlify pflegen. |
| A1.3 | **`verify_jwt` / API-Key** | Wenn Functions mit JWT geschützt sind: in allen vier Frontends **`VITE_LICENSE_API_KEY`** (Lizenzportal-**anon**) setzen, wo nötig – bereits vorgesehen in [`src/lib/licensePortalApi.ts`](../src/lib/licensePortalApi.ts). |
| A1.4 | **Smoke-Tests gegen Edge** | Manuell oder Skript: `GET …/functions/v1/license?licenseNumber=…`, Host-Lookup ohne Query, `POST/PATCH` impressum, `limit-exceeded` – von einer Test-Origin ähnlich `*.pages.dev`. |

**Client-Pfade:** `licensePortalApi` hängt an die Basis-URL **`/license`**, **`/limit-exceeded`**, **`/update-impressum`** (ohne `/api`). Basis = `https://<ref>.supabase.co/functions/v1` **ohne** trailing Slash.

---

### A2. Frontends (Haupt-App, Admin, Portal, Arbeitszeitenportal)

| # | Aufgabe | Details / Hinweise |
|---|---------|-------------------|
| A2.1 | **`VITE_LICENSE_API_URL` überall auf Edge** | Alle Builds (lokal/CI/CF) müssen die **Supabase-Functions-v1-URL** nutzen, **nicht** mehr `https://<admin>/api`. `.env.example` / interne Checklisten anpassen. |
| A2.2 | **SPA-Fallback für Cloudflare Pages** | Netlify nutzt `netlify.toml` **`/* → /index.html 200`**. Für CF: je App eine **`public/_redirects`** (wird von Vite nach `dist` kopiert) mit gleicher Semantik, **oder** CF-Dashboard **Redirects** / `_routes.json` – für **vier** Apps identisch pflegen. |
| A2.3 | **Admin: Server-Env für Netlify Functions** | Nach Umstellung **optional** aus CF-Build entfernen: `SUPABASE_LICENSE_PORTAL_*` nur noch für **Edge-Secrets** in Supabase, **nicht** für statischen Admin-Build nötig – prüfen, ob der Admin-Build diese Variablen noch referenziert (nur Functions taten das). |
| A2.4 | **PWA / Manifest** | Wenn `start_url` oder `scope` **absolute alte Domains** enthalten: auf neue **`*.pages.dev`** oder spätere Custom URLs vorbereiten (sonst „installierte“ PWA zeigt falsch). |
| A2.5 | **Capacitor / Mobile** | Falls `server.url` oder Lizenz-URLs hardcodiert: auf neue Basis-URL prüfen (meist über `VITE_*` ohne Codeänderung). |

---

### A3. Mandanten-Stammdaten & Supabase Auth

| # | Aufgabe | Details / Hinweise |
|---|---------|-------------------|
| A3.1 | **`allowed_domains` / Host-Lookup** | Pro Mandant die **vier** CF-**`*.pages.dev`**-Hostnamen eintragen (oder später Custom Hosts), damit Browser-**Origin** zur Lizenz passt. Alternativ **`VITE_LICENSE_NUMBER`** in den Builds setzen. |
| A3.2 | **Lizenzportal-DB Felder** | `app_domain`, `portal_domain`, `arbeitszeitenportal_domain` langfristig auf **Ziel-Hosts** (pages.dev oder Custom) – für Host-Lookup und Dokumentation. |
| A3.3 | **Mandanten-Supabase (je Kunde)** | **Authentication → URL Configuration:** Site URL + Redirect URLs um die **neuen** App-/Portal-Hosts ergänzen (jede Mandanten-DB einzeln, sofern genutzt). |
| A3.4 | **Lizenzportal-Supabase Auth** | Nur falls Endnutzer dort einloggen: Redirect-URLs für **Admin-Pages-URL** anpassen. |

**Prüfliste (URLs, Secrets, betroffene Functions):** [`Cloudflare-URL-und-Secrets-Checkliste.md`](./Cloudflare-URL-und-Secrets-Checkliste.md).

---

### A4. Automatisierung (Ersatz Netlify-Env-Skript)

| # | Aufgabe | Details / Hinweise |
|---|---------|-------------------|
| A4.1 | **Cloudflare API / Wrangler** | Neues Skript z. B. `scripts/cloudflare-apply-tenant-env.mjs` (oder Wrangler-basiert), das **pro Pages-Projekt** die gleichen `VITE_*` setzt wie heute `netlify-apply-tenant-env.mjs` für drei Sites. **API-Token** mit Recht **Account → Cloudflare Pages → Edit**. |
| A4.2 | **JSON-Schema** | Analog `docs/examples/vico-netlify-deployment.example.json`: statt `sites.main.siteId` **CF-Projekt-IDs** oder **Projektnamen** + Account-ID. |
| A4.3 | **Admin-UI** | `TenantDeploymentPanel` / „Deployment / Netlify“ → **umbenennen/erweitern** („Deployment / Hosting“): Export-Vorlage für **CF** + Link zur neuen Doku. |
| A4.4 | **Dokumentation** | [`Netlify-Mandanten-Env-Skript.md`](./Netlify-Mandanten-Env-Skript.md) um Schwesterkapitel **CF** ergänzen oder **`docs/Cloudflare-Mandanten-Env-Skript.md`** anlegen. |
| A4.5 | **`package.json`** | Npm-Script z. B. `cf:apply-env` registrieren. |

---

### A5. Doku & Repo-Bereinigung (kann parallel zu A1–A4)

| # | Aufgabe |
|---|---------|
| A5.1 | [`Vico.md`](../Vico.md) §5 Deployment: CF als Ziel beschreiben; Netlify als Legacy/Reserve bis Abbau. |
| A5.2 | [`Netlify-README.md`](./Netlify-README.md), [`Netlify-Vier-Apps.md`](./Netlify-Vier-Apps.md): Hinweis „Produktion = CF“, Netlify nur Rollback-Zeitraum. |
| A5.3 | [`Lizenzportal-Setup.md`](./Lizenzportal-Setup.md): **Variante B** als Standard für Mandanten-Frontends. |
| A5.4 | [`Verifikation-Grenzueberschreitungen-Checkliste.md`](./Verifikation-Grenzueberschreitungen-Checkliste.md): Ziel-URL `…/functions/v1/limit-exceeded`. |
| A5.5 | `admin/netlify.toml` + Functions: als **deprecated** markieren oder nach stabilem CF-Betrieb entfernen (optional Archiv-Branch). |

---

### A6. Reihenfolge-Empfehlung (Umsetzung Teil A)

1. **A1** (Edge live + getestet) – ohne funktionierende Edge kein sinnvoller End-to-End-Test.  
2. **A2.1** + **A2.2** (Env + SPA-Redirects lokal in `dist` prüfen).  
3. **A3** (mindestens ein Testmandant mit `*.pages.dev` in `allowed_domains`).  
4. **A4** (Skript + Panel), sobald CF-Projekt-IDs feststehen.  
5. **A5** fortlaufend.

**Abnahme Teil A:** Vier lokale oder Preview-Builds mit **Edge-URL**; Login, Lizenz, Portale, Grenzüberschreitung-Report, Impressum-Update aus Admin **ohne** Netlify.

### Repo-Umsetzung Teil A (technisch erledigt, ohne euren CF-/Edge-Deploy)

- **A1:** CORS in `supabase-license-portal/supabase/functions/{license,limit-exceeded,update-impressum}/index.ts` an Netlify-Functions angeglichen (`Accept`, `Access-Control-Allow-Methods`). **Deploy** der Functions bleibt manuell (`supabase functions deploy`).
- **A2:** `public/_redirects` (SPA `/*` → `/index.html` **200**) in Root, `admin`, `portal`, `arbeitszeit-portal`; `.env.example` aller Apps auf **Edge-URL** ausgerichtet; `netlify.toml`-Kommentare „Legacy“.
- **A3:** Kurzdoku **`docs/Mandanten-Hostlookup-CF-Pages.md`**.
- **A4:** `scripts/cloudflare-apply-tenant-env.mjs`, `npm run cf:apply-env`, `configs/vico-cloudflare-deployment.example.json`, Admin **`TenantDeploymentPanel`** (JSON Cloudflare + Netlify), **`docs/Cloudflare-Mandanten-Env-Skript.md`**.
- **A5:** `Vico.md` §5, `Lizenzportal-Setup.md`, `Netlify-Vier-Apps.md`, `Netlify-README.md`, `Netlify-Mandanten-Env-Skript.md`, `Verifikation-Grenzueberschreitungen-Checkliste.md`, `admin/netlify/functions/README.md`, `Cloudflare-URL-und-Secrets-Checkliste.md`.

---

## Teil B – Go-Live (Produktion auf Cloudflare)

Voraussetzung: **Teil A** für euren Referenzmandanten erfüllt.

**Arbeitsliste (Checkboxen, CLI-Snippets):** [`Cloudflare-Go-Live-Abarbeitung.md`](./Cloudflare-Go-Live-Abarbeitung.md).

### B1. Cloudflare Account & Zonen

| # | Aufgabe |
|---|---------|
| B1.1 | Domains in **Cloudflare** anlegen (Nameserver wie in Entscheidung **A**). |
| B1.2 | Für **Custom Domains später:** DNS-Einträge zu Pages vorbereiten; **vorerst** reichen die von CF vergebenen **Projekt-URLs**. |

---

### B2. Vier Cloudflare Pages-Projekte anlegen

**Schritt-für-Schritt (Dashboard):** [`Cloudflare-Pages-Vier-Projekte-anlegen.md`](./Cloudflare-Pages-Vier-Projekte-anlegen.md).

| # | Aufgabe | Pro Projekt |
|---|---------|-------------|
| B2.1 | **Neues Pages-Projekt** | GitHub-Repo verbinden, **Production branch** = `main` (o. ä.). |
| B2.2 | **Root / Build** | Siehe Tabelle: |

| App | Root directory | Build command | Build output |
|-----|----------------|---------------|--------------|
| Haupt-App | `/` | `npm ci && npm run build` | `dist` |
| Lizenz-Admin | `admin` | `npm ci && npm run build` | `dist` |
| Kundenportal | `portal` | `npm ci && npm run build` | `dist` |
| Arbeitszeitenportal | `arbeitszeit-portal` | `npm ci && npm run build` | `dist` |

| # | Aufgabe |
|---|---------|
| B2.3 | **Node 20** in CF Build-Umgebung setzen (Variable `NODE_VERSION=20` o. ä., je nach CF-UI). |
| B2.4 | **Umgebungsvariablen** je Projekt eintragen (oder per **A4**-Skript): alle `VITE_*` inkl. **`VITE_LICENSE_API_URL`** = Edge-Basis, ggf. **`VITE_LICENSE_API_KEY`**, Mandanten-`VITE_SUPABASE_*`. |
| B2.5 | **Ersten Produktions-Deploy** pro Projekt auslösen und **Build-Logs** prüfen. |

---

### B3. Funktions-Check auf `*.pages.dev`

| # | Test |
|---|------|
| B3.1 | Haupt-App: Login, Kernflows, Offline kurz. |
| B3.2 | Admin: Mandanten, Lizenzen, Logo, Impressum-Patch → Edge. |
| B3.3 | Kundenportal + Arbeitszeitenportal: Lizenz, Host-Lookup oder `VITE_LICENSE_NUMBER`. |
| B3.4 | Grenzüberschreitung (falls testbar) → `limit-exceeded` Edge. |

---

### B4. DNS & Cutover

| # | Aufgabe |
|---|---------|
| B4.1 | Wenn ihr von **Custom Domains** kommt: **CNAME/A** auf die jeweilige **Pages**-Zuweisung umstellen (TTL vorher senken). |
| B4.2 | **SSL** in CF auf „Full (strict)“ prüfen, sobald Custom Hostnames auf Pages gebunden sind. |
| B4.3 | Nach Cutover: **Supabase Auth**-Redirect-URLs und **`allowed_domains`** auf **neue** Hosts finalisieren (falls nicht schon `pages.dev`). |

---

### B5. Netlify (Reserve → Abbau)

| # | Aufgabe |
|---|---------|
| B5.1 | **Kein** automatischer Traffic mehr auf Netlify; Sites **eingefroren** (Git unlink, keine Hooks) – siehe [`Netlify-README.md`](./Netlify-README.md). |
| B5.2 | **1–4 Wochen** beobachten; bei stabilem Betrieb: Netlify-Sites **löschen** oder archivieren. |
| B5.3 | Git-Referenz **`last-stand-netlify`** bei Bedarf für historischen Re-Deploy behalten. |

---

### B6. Nach Go-Live

| # | Aufgabe |
|---|---------|
| B6.1 | Monitoring: CF Analytics, Supabase Edge Logs, Fehlerreports aus der App. |
| B6.2 | **Build-Kontingent** CF Free (z. B. 500 Builds/Monat) mit vier Projekten im Blick. |
| B6.3 | Mandanten schrittweise auf CF-Env umstellen (**A4**-Skript); Dokumentation für Support pflegen. |

---

## Kurz-Checkliste (Copy-Paste)

**Vor Go-Live**

- [ ] Edge: `license`, `limit-exceeded`, `update-impressum` deployed und getestet  
- [ ] Alle Apps: `VITE_LICENSE_API_URL` = `https://<ref>.supabase.co/functions/v1`  
- [ ] SPA: `_redirects` (oder CF-Äquivalent) in jedem `dist`  
- [ ] Testmandant: `allowed_domains` / Domains für `*.pages.dev`  
- [ ] CF-Env-Skript + Panel-Export (mindestens dokumentiert oder lauffähig)  

**Go-Live**

- [ ] 4× Pages-Projekt, Build grün, Smoke-Tests auf `*.pages.dev`  
- [ ] DNS / Custom Hosts  
- [ ] Netlify nur Reserve, dann Abbau  

---

*Ergänzung zu **CF1** in `Vico.md` §7. Bei Abweichung von den Festlegungen in `Cloudflare-Umzug-und-Supabase-Auslagerung.md` diese Datei anpassen.*
