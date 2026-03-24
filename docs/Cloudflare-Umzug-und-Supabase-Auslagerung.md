# Cloudflare-Umzug planen & Supabase-Auslagerung (Lizenz-API)

**Roadmap-ID:** **CF1** (siehe `Vico.md` §7.2, §7.4, §7.6.1).  
**Status:** Planung – kein verbindlicher Technik-Entscheid; dient der Vorbereitung eines Wechsels von **Netlify** zu **Cloudflare Pages** und der Klärung, welche Teile **bei Supabase** (Edge Functions) verbleiben bzw. dorthin **verlagert** werden.

---

## 1. Zielbild

| Ziel | Beschreibung |
|------|----------------|
| **Ein Account** | Vier Frontends (Haupt-App, Admin, Kundenportal, Arbeitszeitenportal) wie bei Netlify als **getrennte Deployments** unter **einem** Cloudflare-Account (**vier Pages-Projekte**). |
| **Parität** | Gleiche Build-Artefakte (`npm run build` → `dist`), gleiche **SPA-Fallbacks**, gleiche **Umgebungsvariablen** (`VITE_*`) soweit möglich. |
| **Lizenz-API** | Entweder **Pages Functions** (Port der bestehenden Netlify Functions) **oder** vollständig **Supabase Edge Functions** im **Lizenzportal-Projekt** – siehe **§3**. |
| **Mandanten** | `VITE_LICENSE_API_URL` und ggf. `VITE_LICENSE_NUMBER` pro Mandant weiterhin konsistent; Deploy-/Env-Automatisierung ersetzt oder ergänzt **`scripts/netlify-apply-tenant-env.mjs`**. |

---

## 2. Ist-Stand (Netlify) im Repo

| App | Root | Publish | Besonderheit |
|-----|------|---------|----------------|
| Haupt-App | Repo-Root | `dist` | `netlify.toml`: SPA `/* → /index.html` |
| Admin | `admin/` | `dist` | **Netlify Functions** `license`, `update-impressum`, `limit-exceeded`; Redirects `/api/*` → `/.netlify/functions/*` |
| Kundenportal | `portal/` | `dist` | SPA-Redirects |
| Arbeitszeitenportal | `arbeitszeit-portal/` | `dist` | SPA-Redirects |

**Secrets (Admin-Build / Functions):** u. a. `SUPABASE_LICENSE_PORTAL_URL`, `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` (Namen laut `admin/netlify/functions` und Doku) – **niemals** in `VITE_*`.

**Referenz:** `docs/Netlify-Vier-Apps.md`, `docs/Netlify-Mandanten-Env-Skript.md`, `docs/Lizenzportal-Setup.md` (Variante A: Netlify `/api`, Variante B: Supabase Edge).

---

## 3. Entscheidung: API auf CF oder bei Supabase?

### Variante **A – Pages Functions (Cloudflare)**

- **Vorteil:** Ein Anbieter für Admin-UI + API; URL-Schema `https://<admin-domain>/api/...` bleibt erhalten; Mandanten-Env-Änderungen minimal (`VITE_LICENSE_API_URL` unverändert, wenn Domain gleich bleibt).
- **Aufwand:** Die drei Handler unter `admin/netlify/functions/*.ts` auf **Workers/Pages Functions** portieren (`Request`/`Response`, `export async function onRequestPost` o. ä., **kein** `@netlify/functions`).
- **Risiko:** **Workers Free:** u. a. **10 ms CPU-Zeit pro Invocation** und **~100 000 Requests/Tag** – für Lizenz-Checks mit überwiegend I/O (`fetch` zu Supabase) meist unkritisch, bei Spitzenlast oder schwerer JSON-Logik **messen**; bei Bedarf **Workers Paid**.

### Variante **B – Supabase Edge Functions (Lizenzportal)**

- **Vorteil:** **Kein** Serverless auf CF nötig; alle vier Sites sind **rein statisch** – einfacheres Hosting, weniger Portierungsrisiko auf dem Edge-Runtime; Doku und Skripte für `supabase functions deploy` existieren bereits (`docs/Lizenzportal-Setup.md`).
- **Aufwand:** Sicherstellen, dass **alle** Endpunkte (`license`, `limit-exceeded`, `update-impressum`) **paritätisch** zu Netlify implementiert sind (CORS, Methoden, Fehlercodes); **CORS-Origins** bei Bedarf pflegen.
- **Konsequenz:** `VITE_LICENSE_API_URL = https://<lizenzportal-ref>.supabase.co/functions/v1` (ohne trailing Slash je nach Client-Code) für **alle** Mandanten-Frontends, die heute die Admin-URL nutzen.

### Empfehlung für die Planung

- **Technisch konservativ:** Zuerst **Variante B** evaluieren (bereits im Projekt angelegt), Last und Kosten im Supabase-Dashboard beobachten; danach entscheiden, ob **Variante A** für „alles unter Admin-Domain“ nötig ist.
- **Produkt/Marketing:** Wenn die öffentliche API-URL bewusst **ohne** `supabase.co` sichtbar sein soll, tendenziell **Variante A** auf CF.

---

## 4. Was sollte (weiterhin) bei Supabase liegen?

Bereits **sinnvoll bei Supabase** (unabhängig von CF/Netlify):

| Bereich | Begründung |
|---------|------------|
| **Lizenzportal-Daten** (`tenants`, `licenses`, …) | Single Source of Truth; RLS/Service-Role nur serverseitig. |
| **Mandanten-App-Daten** (`supabase-complete.sql`) | Pro Mandant eigenes Projekt – unverändert. |
| **Edge Functions im Lizenzportal** | Bereits vorgesehen für Lizenz-Check, Grenzüberschreitungen, Impressum – **Auslagerung der Netlify-Functions** vermeidet doppelte Wartung, wenn Variante B gewählt wird. |
| **Cron / geplante Jobs** (z. B. Wartungs-Digest) | `send-maintenance-reminder-digest` – bleibt Supabase-nah (**§7.2.1** `Vico.md`). |

**Nicht** zwingend nach Supabase verlagern:

| Bereich | Begründung |
|---------|------------|
| **Statische Assets** der vier SPAs | Bleiben auf **Pages** (oder jedem anderen Static Host). |
| **Build-Pipeline** | Kann **GitHub Actions** + CF Pages Upload bleiben (wie IONOS Deploy Now Muster) oder natives CF Git-Integration. |

---

## 5. Phasenplan Umzug zu Cloudflare (detailliert)

### Phase 0 – Inventar & Entscheid

- [ ] Liste aller **Netlify-Sites** (Site-ID, Domain, Branch).
- [ ] Export aller **Env-Variablen** pro Site (ohne Secret-Werte in Tickets; nur Namen + Kontext).
- [ ] Entscheid **Variante A oder B** (**§3**).
- [ ] **Staging-Subdomains** auf CF definieren (z. B. `staging-app.…`).

### Phase 1 – Cloudflare Account & DNS-Strategie

- [ ] CF-Account, ggf. **Zwei-Faktor**.
- [ ] Pro Domain: **CNAME** zu `*.pages.dev` oder CF-nameserver – je nachdem, ob DNS bei CF oder extern bleibt.
- [ ] **SSL:** Full (strict) prüfen, wenn Origin nur statisch ist.

### Phase 2 – Vier Pages-Projekte anlegen

Pro App ein Projekt:

| Projekt | Build root (Monorepo) | Build command | Output |
|---------|------------------------|---------------|--------|
| Main | `/` | `npm ci && npm run build` | `dist` |
| Admin | `admin` | `npm ci && npm run build` | `dist` |
| Portal | `portal` | `npm ci && npm run build` | `dist` |
| Arbeitszeit | `arbeitszeit-portal` | `npm ci && npm run build` | `dist` |

- [ ] **Node-Version** in CF Build-Umgebung auf **20** alignen (wie `netlify.toml`).
- [ ] **Umgebungsvariablen** `VITE_*` je Projekt setzen (analog Netlify).

### Phase 3 – SPA-Routing

- [ ] Entweder **`public/_redirects`** (Cloudflare-kompatibel, siehe CF-Doku) in jedem Package **oder** **`_routes.json`** / **`_headers`** nach Bedarf.
- [ ] Regel **gleich** wie heute: alle Pfade → `index.html` mit **200** (kein 302 auf `/`).

### Phase 4a – (Nur Variante A) Admin Pages Functions

- [ ] Verzeichnisstruktur z. B. `admin/functions/` mit Routen `/api/license`, `/api/limit-exceeded`, `/api/update-impressum`.
- [ ] Gemeinsame Logik aus `shared/licenseHostLookup` und Supabase-Client **im Worker-kompatiblen** Bundle testen.
- [ ] **CORS** und **OPTIONS** wie in `license.ts` nachbilden.
- [ ] Secrets als **CF Pages Environment Variables** (encrypted).

### Phase 4b – (Nur Variante B) Supabase Edge finalisieren

- [ ] Parität der drei Functions mit Netlify-Verhalten (Statuscodes, JSON-Shape).
- [ ] Deploy auf **Lizenzportal-Projekt**; Keys nur in Supabase/CI.
- [ ] Admin-Frontend **ohne** eigene API-Route auskommen lassen (nur statische Assets).

### Phase 5 – Mandanten & Lizenz-URL

- [ ] Für jeden Mandanten: `VITE_LICENSE_API_URL` auf neue Basis-URL (**Admin `/api`** oder **Supabase `…/functions/v1`**).
- [ ] Im Lizenzportal **Host-Lookup** (`allowed_domains`, `app_domain`, …) prüfen – bei Domain-Wechsel **CORS/Origin** und **Lizenz-API-Zugriff** testen.
- [ ] **Neues Automatisierungsskript** (CF API für Env pro Pages-Projekt) spezifizieren oder **Wrangler**/Terraform evaluieren – Ersetzung für `netlify-apply-tenant-env.mjs`.

### Phase 6 – Tests (Staging)

- [ ] Login Haupt-App, Offline-Kurztest.
- [ ] Admin: Mandanten, Lizenzen, Logo-Upload.
- [ ] Portale: Login, Lizenz-Check, Host-Lookup.
- [ ] Lasttest: viele parallele `GET /license` (optional k6/Locust).

### Phase 7 – Cutover Produktion

- [ ] Wartungsfenster oder **blau-grün**: DNS TTL senken, auf CF umstellen.
- [ ] **Netlify** Sites auf „paused“ oder löschen nach Beobachtungszeit.
- [ ] Doku aktualisieren: `Vico.md` §5, `docs/Netlify-*.md` → Hinweis CF **oder** neue `docs/Cloudflare-*.md`.

### Phase 8 – Aufräumen

- [ ] `netlify.toml` optional deprecaten oder als Referenz markieren.
- [ ] CI/CD nur noch ein Pfad (keine doppelten Deploys).

---

## 6. Risiken & Limits (Kurz)

| Thema | Cloudflare | Hinweis |
|--------|------------|---------|
| Builds Free | 500 / Monat | Vier Projekte × häufige Pushes = mitdenken |
| Worker/Pages Functions Free | Requests + **10 ms CPU** | Lizenz-Handler messen |
| Monorepo | Build „Root directory“ | Pro Pages-Projekt korrekt setzen |
| Mandanten-Isolation | Organisatorisch | Vier Sites × N Mandanten = viele Deployments; Skripte anpassen |

---

## 7. Dokumentations- und Code-Artefakte (Checkliste)

- [ ] Neues oder aktualisiertes **`wrangler.toml` / Pages-Konfiguration** (falls genutzt).
- [ ] `docs/Netlify-Vier-Apps.md` – Ergänzung **CF-Äquivalent** oder Schwesterdokument.
- [ ] `docs/Lizenzportal-Setup.md` – gewählte Variante A/B als **Standard** für neue Mandanten markieren.
- [ ] `package.json` – optionales Script `deploy:cf` o. ä. nur bei Bedarf.

---

## 8. Referenzen

- Cloudflare Pages Limits: https://developers.cloudflare.com/pages/platform/limits/
- Workers Pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Intern: `admin/netlify.toml`, `admin/netlify/functions/*.ts`, `docs/Lizenzportal-Setup.md`, `supabase-license-portal/`

---

*Letzte inhaltliche Abstimmung mit Roadmap **CF1** in `Vico.md` §7.*
