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

### Entwurf: API „nach Host“ (nicht implementiert – Spezifikation für später)

**Ziel:** Portale liefern weiter `VITE_LICENSE_API_URL` (ohne `VITE_LICENSE_NUMBER`); die **Lizenz-API** ermittelt die passende Lizenz anhand des **aufrufenden Hosts** (Browser sendet `Origin` / die Function liest `Host` / `X-Forwarded-Host`).

**Mögliche Signatur (Variante A – kompatibel zum Heute-Zustand):**

| Aufruf | Verhalten |
|--------|-----------|
| `GET …/api/license?licenseNumber=VIC-…` | Wie heute: direkter Lookup (Migration, Support, Haupt-App). |
| `GET …/api/license` **ohne** `licenseNumber` | **Neu:** Lookup: Mandant/Lizenz, bei dem `portal_domain` **oder** `arbeitszeitenportal_domain` (je nach App-Kontext) zum Request-Host passt; dann gleiche JSON-Antwort wie bisher. |
| Optional **Hybrid:** `?licenseNumber=` gesetzt | **Vorrang** vor Host-Lookup (Override für Tests). |

**Edge Cases & Regeln (kurz):**

1. **Netlify Deploy Previews** (`--<hash>--<name>.netlify.app`): Entweder **kein** Host-Lookup (nur `licenseNumber`) oder Mandanten-Eintrag mit genau diesem Preview-Host – sonst **404**. Typisch: Previews nur mit Query-Parameter oder separates Staging.
2. **`www` vs. Apex:** `kunde.de` und `www.kunde.de` sind unterschiedliche Hosts – beide in `portal_domain`/`allowed_domains` eintragen oder im Backend normalisieren (einheitliche Regel dokumentieren).
3. **Lokal (`localhost`, LAN-IP):** Passt zu keinem Produktions-Mandanten → Host-Lookup schlägt fehl; **Dev:** weiter `.env` mit `VITE_LICENSE_NUMBER` oder Query `?licenseNumber=`.
4. **Mehrere Lizenzen / Mandanten mit gleicher Domain:** Datenmodell sollte **pro Host höchstens eine** aktive Zuordnung erzwingen; sonst **409** oder definierte Priorität (z. B. neueste Lizenz).
5. **Kohärenz mit `allowed_domains`:** Die **Portal-Origin** muss weiterhin in `allowed_domains` stehen, sonst **403** – Host-Lookup ersetzt diese Sicherheitsprüfung nicht.
6. **Caching:** Öffentliche CDNs dürfen die Lizenz-JSON **nicht** domain-neutral cachen; Server-Response ggf. `Cache-Control: private, no-store` oder `Vary: Origin` je nach Setup.

**Bewertung:** Technisch **sauber**, wenn Lookup und Freigaben **eine** klare Policy haben; Aufwand liegt in **Function + DB-Abfrage + Tests** für die Hosts oben.

---

## Schnellcheck nach Deploy

1. **Admin:** `GET https://<admin-site>/api/license?licenseNumber=VIC-…` → **200** + JSON.
2. **Haupt-App / Portal:** Browser **Network** → Request auf `…/license?licenseNumber=…` → **200**.
3. Bei **403** am Portal: Mandant **`allowed_domains`** im Lizenzportal um den **Host** der Portal-URL ergänzen.

---

*Letzte inhaltliche Ergänzung: siehe Git-Historie zu `docs/Netlify-README.md`.*
