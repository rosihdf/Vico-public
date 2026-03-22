# Netlify – Kurzüberblick (Vico)

Einmalige Orientierung: **vier getrennte Netlify-Sites** aus einem Repo, jeweils mit **Base directory** und eigenen **Environment variables**.

| App | Base directory | Publish | Wichtigste `VITE_*` |
|-----|----------------|---------|---------------------|
| **Haupt-App** | *(leer = Repo-Root)* | `dist` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LICENSE_API_URL` |
| **Lizenz-Admin** | `admin` | `admin/dist` | `VITE_SUPABASE_*` (Lizenzportal-DB), **plus Server:** `SUPABASE_LICENSE_PORTAL_URL`, `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` |
| **Kundenportal** | `portal` | `portal/dist` | Mandanten-`VITE_SUPABASE_*`, `VITE_LICENSE_API_URL`, siehe unten zu **Lizenznummer** |
| **Arbeitszeitenportal** | `arbeitszeit-portal` | `arbeitszeit-portal/dist` | wie Kundenportal |

**Node:** In den jeweiligen `netlify.toml`-Dateien ist `NODE_VERSION = 20` gesetzt.

**Ausführliche Anleitung:** [`Netlify-Vier-Apps.md`](./Netlify-Vier-Apps.md) (inkl. DNS, Fehlerbehebung §11, TS-Monorepo §12).

**Lizenzportal-Setup / API:** [`Lizenzportal-Setup.md`](./Lizenzportal-Setup.md).

---

## Lizenz-API-URL (alle Apps mit Mandanten-Lizenz)

Empfohlen:

```text
VITE_LICENSE_API_URL=https://<deine-admin-netlify-site>/api
```

**Ohne** Slash am Ende. Die Admin-Site leitet `/api/license` auf die Netlify Function weiter.

---

## Lizenznummer in Kundenportal & Arbeitszeitenportal

### Stand heute (implementiert)

`VITE_LICENSE_NUMBER` wird **beim Build** eingetragen (Netlify → Environment variables). Sie muss zur Zeile **`licenses.license_number`** im Lizenzportal passen – **pro Kunde/Deployment eine eigene Site** oder angepasste Env + **Redeploy**.

Vorteil: **Branding** (Name, Farben, Logo) und **Features** sind **vor dem Login** bekannt.

### Andere Lösungen (nicht alle im Code umgesetzt)

| Ansatz | Kurz | Aufwand |
|--------|------|--------|
| **So lassen** (`VITE_LICENSE_NUMBER`) | Eine Netlify-Site pro Mandant oder Env pro Branch/Context | Gering, bewährt |
| **API „nach Host“** | Neue Endpoint-Logik: Lizenzportal ermittelt Mandant anhand `Host` / `portal_domain` / `arbeitszeitenportal_domain` – Client ruft **ohne** Nummer nur die Basis-URL auf | Mittel (Backend + CORS/`allowed_domains`) |
| **Nach Login: RPC** | In der **Mandanten-DB** existiert u. a. `get_license_number()` (siehe `supabase-complete.sql`) – **nach** Supabase-Auth könnte das Portal die Nummer laden statt Env. **Design vor Login** fällt dann auf Defaults zurück oder braucht andere Quelle | Mittel |
| **`public/portal-config.json`** | Pro Site eine kleine JSON-Datei (z. B. nur `licenseNumber`) – getrennt vom App-Build aktualisierbar; Deploy der Datei statt Neu-Build | Gering bis mittel (Prozess) |
| **Deep-Link** | Erster Aufruf mit `?license=…`, Wert in `sessionStorage` – **ein** Build für viele Mandanten möglich | Mittel (UX, Sicherheit beachten) |

**Haupt-App:** Nutzt **Aktivierung** / **Info** und Speicherung in DB (`set_license_number` / `get_license_number`) – anderes Konzept als die Portale.

---

## Schnellcheck nach Deploy

1. **Admin:** `GET https://<admin-site>/api/license?licenseNumber=VIC-…` → **200** + JSON.
2. **Haupt-App / Portal:** Browser **Network** → Request auf `…/license?licenseNumber=…` → **200**.
3. Bei **403** am Portal: Mandant **`allowed_domains`** im Lizenzportal um den **Host** der Portal-URL ergänzen.

---

*Letzte inhaltliche Ergänzung: siehe Git-Historie zu `docs/Netlify-README.md`.*
