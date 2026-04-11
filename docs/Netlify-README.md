# Netlify – Kurzüberblick (Vico)

**Hinweis:** Produktionsziel ist **Cloudflare Pages** – **`docs/Cloudflare-Umzug-Roadmap.md`**. Die folgenden Abschnitte gelten für **Legacy-Netlify** (Rollback / Übergang).

Einmalige Orientierung: **vier getrennte Netlify-Sites** aus einem Repo, jeweils mit **Base directory** und eigenen **Environment variables**.

| App | Base directory | Publish | Wichtigste `VITE_*` |
|-----|----------------|---------|---------------------|
| **Haupt-App** | *(leer = Repo-Root)* | `dist` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LICENSE_API_URL` |
| **Lizenz-Admin** | `admin` | `admin/dist` | `VITE_SUPABASE_*` (Lizenzportal-DB), **plus Server:** `SUPABASE_LICENSE_PORTAL_URL`, `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` |
| **Kundenportal** | `portal` | `portal/dist` | Mandanten-`VITE_SUPABASE_*`, `VITE_LICENSE_API_URL`; `VITE_LICENSE_NUMBER` optional (Host-Lookup) |
| **Arbeitszeitenportal** | `arbeitszeit-portal` | `arbeitszeit-portal/dist` | wie Kundenportal |

**Node:** In den jeweiligen `netlify.toml`-Dateien ist `NODE_VERSION = 20` gesetzt.

**Ausführliche Anleitung:** [`Netlify-Vier-Apps.md`](./Netlify-Vier-Apps.md) (inkl. DNS, Fehlerbehebung §11, TS-Monorepo §12). **Strategie / Mandanten-Phasen A–D:** **`Vico.md` §7.6.3**. **Env per Skript (Phase C):** [`Netlify-Mandanten-Env-Skript.md`](./Netlify-Mandanten-Env-Skript.md).

**Lizenzportal-Setup / API:** [`Lizenzportal-Setup.md`](./Lizenzportal-Setup.md).

### Netlify: nichts mehr aktualisieren (eingefroren)

**Im Repo:** In allen vier `netlify.toml` steht **`[build] ignore = "exit 0"`** – damit starten **keine** Builds mehr durch **Git-Push** oder **Deploy Previews** (PRs), solange die Site die Datei aus dem Repo nutzt ([Ignore builds](https://docs.netlify.com/configure-builds/ignore-builds/)).

**Das allein reicht nicht**, wenn ihr wirklich **gar keine** neuen Deploys wollt: **Build Hooks**, **manueller „Trigger deploy“** und **Netlify CLI** können weiterhin Deploys auslösen. **Pflicht in Netlify (je Site wiederholen):**

1. **Git-Verbindung trennen:** **Project configuration** → **Build & deploy** → **Continuous deployment** → **Manage repository** / **Unlink** (Repository vom Projekt abhängen). Dann löst **kein** GitHub-Event mehr einen Build aus.
2. **Build Hooks löschen:** **Project configuration** → **Build & deploy** → **Build hooks** → alle Hooks **entfernen** (sonst kann z. B. CI oder ein externes Tool weiter triggern).
3. **GitHub:** Unter **Repository → Settings → Integrations / GitHub Apps** prüfen, ob die **Netlify**-App noch auf dieses Repo zugreift – bei Bedarf **Zugriff entziehen** oder nur für andere Repos behalten.
4. **CI:** Kein Workflow mit `netlify deploy` / Deploy-Hooks auf diese Sites (keine Netlify-GitHub-Workflows im Repo; Mandanten-Env ggf. lokal per `scripts/netlify-apply-tenant-env.mjs`, siehe [`Netlify-Mandanten-Env-Skript.md`](./Netlify-Mandanten-Env-Skript.md)).

**Später wieder deployen:** Repo erneut verknüpfen, Hooks anlegen, `ignore`-Zeilen in den `netlify.toml` entfernen (falls gewünscht).

---

## Staging / Test-Umgebung

**Ziel:** Features und Releases **ohne Produktionsdaten** und **ohne Kunden-Impact** testen. Details und Varianten: [`Netlify-Vier-Apps.md`](./Netlify-Vier-Apps.md) **§9.5**.

| Thema | Kurzempfehlung |
|--------|----------------|
| **Netlify** | **Branch Deploys** / Deploy Previews aktivieren **oder** eigene Sites `staging-*` mit separaten Env-Variablen |
| **Mandanten-Supabase** | Eigenes **Staging-Projekt** (empfohlen) – `VITE_SUPABASE_*` in den Staging-Sites auf diese URLs/Keys |
| **Lizenzportal (Admin)** | Entweder **zweites** Lizenzportal-Supabase (nur Test-Mandanten) **oder** dasselbe Projekt mit klar getrennten Test-Mandanten (Vorsicht vor Verwechslung) |
| **`VITE_LICENSE_API_URL`** | In Staging immer die **Staging-Admin-URL** (`https://<staging-admin>/api`), nicht die Produktions-Lizenz-API |
| **Host-Lookup (Phase B)** | Deploy-Preview-Hosts (`…--….netlify.app`) nur wenn im Mandanten unter `allowed_domains` / Domains eingetragen – sonst **`VITE_LICENSE_NUMBER`** in der Preview-Site setzen oder mit `?licenseNumber=` testen |

**Release:** Vor Production-Deploy Staging durchspielen; siehe [`Release-Checkliste.md`](./Release-Checkliste.md) (Abschnitt Staging).

---

## Lizenz-API-URL (alle Apps mit Mandanten-Lizenz)

Empfohlen:

```text
VITE_LICENSE_API_URL=https://<deine-admin-netlify-site>/api
```

**Ohne** Slash am Ende. Die Admin-Site leitet `/api/license` auf die Netlify Function weiter.

**Neu (Standard):** `VITE_LICENSE_API_URL=https://<lizenzportal-ref>.supabase.co/functions/v1` – siehe **`docs/Lizenzportal-Setup.md`** (Variante B) und **`docs/Cloudflare-Mandanten-Env-Skript.md`**.

---

## Lizenznummer in Kundenportal & Arbeitszeitenportal

### Stand heute (implementiert)

**Variante A – mit `VITE_LICENSE_NUMBER`:** Beim Build eintragen (Netlify → Environment variables). Muss zu **`licenses.license_number`** passen – **pro Kunde/Deployment eine eigene Site** oder angepasste Env + **Redeploy**.

**Variante B – ohne `VITE_LICENSE_NUMBER` (Phase B):** Es reicht `VITE_LICENSE_API_URL`. Die Lizenz-API ermittelt den Mandanten anhand des **Browser-Origins** (`Origin`/`Referer`): Abgleich mit `tenants.portal_domain`, `arbeitszeitenportal_domain`, `app_domain` und Einträgen in `allowed_domains`. Anschließend gilt dieselbe **Domain-Freigabe** wie bei Variante A (wenn `allowed_domains` nicht leer ist).

Vorteil Branding/Features: in beiden Fällen **vor dem Login** ladbar (sofern API erreichbar).

### Andere Lösungen (teilweise / ergänzend)

| Ansatz | Kurz | Aufwand |
|--------|------|--------|
| **Nur `VITE_LICENSE_NUMBER`** | Eine Netlify-Site pro Mandant oder Env pro Branch/Context | Gering, bewährt |
| **API „nach Host“** (ohne Nummer) | **Implementiert:** `GET …/license` ohne Query; Mandant per `portal_domain` / `arbeitszeitenportal_domain` / `app_domain` / `allowed_domains` | Erledigt |
| **Nach Login: RPC** | In der **Mandanten-DB** existiert u. a. `get_license_number()` (siehe `supabase-complete.sql`) – **nach** Supabase-Auth könnte das Portal die Nummer laden statt Env. **Design vor Login** fällt dann auf Defaults zurück oder braucht andere Quelle | Mittel |
| **`public/portal-config.json`** | Pro Site eine kleine JSON-Datei (z. B. nur `licenseNumber`) – getrennt vom App-Build aktualisierbar; Deploy der Datei statt Neu-Build | Gering bis mittel (Prozess) |
| **Deep-Link** | Erster Aufruf mit `?license=…`, Wert in `sessionStorage` – **ein** Build für viele Mandanten möglich | Mittel (UX, Sicherheit beachten) |

**Haupt-App:** Nutzt **Aktivierung** / **Info** und Speicherung in DB (`set_license_number` / `get_license_number`) – anderes Konzept als die Portale.

### API „nach Host“ (implementiert)

**Ziel:** Portale können nur `VITE_LICENSE_API_URL` setzen (ohne `VITE_LICENSE_NUMBER`). Die **Lizenz-API** ermittelt die passende Lizenz anhand des **aufrufenden Hosts** aus dem **Browser** (`Origin` bzw. `Referer` – nicht aus vertrauenswürdigem `?host=`, um Missbrauch zu vermeiden).

| Aufruf | Verhalten |
|--------|-----------|
| `GET …/api/license?licenseNumber=VIC-…` | Direkter Lookup (Migration, Support, Haupt-App). |
| `GET …/api/license` **ohne** `licenseNumber` | **Host-Lookup:** Mandant, dessen `portal_domain` / `arbeitszeitenportal_domain` / `app_domain` / `allowed_domains` zum Host aus `Origin`/`Referer` passt; dann neueste Lizenz des Mandanten (`created_at desc`). |
| `?licenseNumber=` gesetzt | **Vorrang** vor Host-Lookup. |

**Edge Cases & Regeln:**

1. **Netlify Deploy Previews:** Host-Lookup nur wenn Preview-Host im Mandanten eingetragen; sonst **404** – oder `?licenseNumber=` nutzen.
2. **`www` vs. Apex:** beide Hosts explizit pflegen (`portal_domain` / `allowed_domains`).
3. **Lokal (`localhost`):** Host-Lookup schlägt fehl; **Dev:** `VITE_LICENSE_NUMBER` oder `?licenseNumber=` in Tests.
4. **Mehrere Mandanten gleicher Host:** **409** (Konflikt).
5. **`allowed_domains`:** Wenn gesetzt, muss die **Origin** weiterhin passen (wie bei Lookup per Nummer) → sonst **403**.
6. **Caching:** Antworten mit `Cache-Control: private, no-store`.

---

## Schnellcheck nach Deploy

1. **Admin:** `GET https://<admin-site>/api/license?licenseNumber=VIC-…` → **200** + JSON.
2. **Portal (mit Host-Lookup):** vom Portal aus im Browser `GET …/license` **ohne** Query (Network-Tab) → **200**, wenn `portal_domain`/`allowed_domains` passen.
3. Bei **403** am Portal: Mandant **`allowed_domains`** im Lizenzportal um den **Host** der Portal-URL ergänzen.

---

*Letzte inhaltliche Ergänzung: siehe Git-Historie zu `docs/Netlify-README.md`.*
