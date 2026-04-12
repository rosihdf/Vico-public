# Diagnose: Version bleibt nach Lizenzportal-Rollout bei 1.2.1

Zwei getrennte Grössen: **Build-Version** (was Cloudflare ausliefert) und **Lizenz-API-Anzeige** (was das Lizenzportal der App mitteilt).

---

## 1) Build-Version: `version.json` (Wahrheit für den ausgelieferten Code)

**Pro App-Typ** die öffentliche Basis-URL verwenden (ohne Pfad zur SPA), z. B.:

- Haupt-App: `https://<DEINE-HAUPTAPP-HOST>/version.json`
- Kundenportal: `https://<DEIN-KP-HOST>/version.json`
- Arbeitszeitenportal: `https://<DEIN-AZ-HOST>/version.json`

Im Browser öffnen oder:

```bash
curl -sS 'https://<HOST>/version.json' | jq .
```

**Erwartung für „wirklich 1.2.2 ausgeliefert“:** Feld `"version": "1.2.2"`.

- Steht hier **1.2.1** (oder älter) → es lief noch **kein** erfolgreicher **GitHub Actions**-Deploy „Deploy Pages from release“ für diesen App-Typ mit einem Ref, in dem die jeweilige **`package.json`** bereits **1.2.2** ist. **Lizenzportal-Rollout allein baut Pages nicht neu.**

---

## 2) Lizenz-API: Was die App über „Anzeigeversion“ bekommt

### Variante A – direkt in der App (einfachste)

1. Haupt-App (oder Portal) öffnen, **eingeloggt** wie die Nutzer.
2. **Entwicklertools** → **Netzwerk** (Network).
3. Seite neu laden; Filter z. B. `license` oder eure `VITE_LICENSE_API_URL`-Domain.
4. Die **GET**-Antwort auf `…/license?licenseNumber=…` **oder** `…/license` (nur Host-Lookup) auswählen → Tab **Antwort** / **Response**.

**Relevante Felder (JSON):**

| Pfad | Bedeutung |
|------|-----------|
| `license.client_config_version` | Zähler; bei Änderung im LP sollte er hochgehen (Apps laden Konfiguration nach). |
| `appVersions.main` (Haupt-App am `app_domain`) | `version`, `releaseLabel`, `releaseNotes` – **Anzeige** für Kanal Haupt-App. |
| `appVersions.kundenportal` | analog, wenn Aufruf vom Kundenportal-Host kommt. |
| `appVersions.arbeitszeit_portal` | analog für AZ-Portal-Host. |
| `mandantenReleases.active.version` | Aktives zugewiesenes Release für den **erkannten** Kanal. |

**Interpretation:**

- **`appVersions.main.version` ist `1.2.2`**, aber in **Info** steht unter „Version“ noch **1.2.1** → das ist **normal**: unten ist die **Build-Version** (`__APP_VERSION__`). Oben „Lizenzportal (Anzeige)“ sollte **1.2.2** zeigen, wenn `hasAppVersionEntryContent` erfüllt ist.
- **`appVersions.main.version` ist weiter `1.2.1`** → Mandanten-seitig blockiert oder keine Zuweisung:
  - Im Lizenzportal: Mandant **bearbeiten** → JSON **App-Versionen (optional)** – wenn dort `main.version` auf **1.2.1** steht, **überschreibt** das die globale Default-Version, **solange** keine **aktive Release-Zuweisung** diesen Kanal aus `tenant_release_assignments` setzt (die überschreibt in der Edge-Function den Kanal wieder).
  - **App-Releases** / **Zuweisungen**: für den Mandanten Kanal **main** aktives Release wirklich auf **1.2.2** (Status **published**)?
  - **`platform_config.default_app_versions`**: nach eurem SQL sollte `main.version` **1.2.2** sein – prüfen im Supabase SQL Editor, falls kein Mandanten-Override und keine Zuweisung greift.

### Variante B – `curl` (nur sinnvoll mit passendem `Origin`)

Die Lizenz-API prüft den **Browser-`Origin`** (bzw. Referer) gegen den Mandanten. Ohne passenden Host bekommt ihr 403/404.

```bash
curl -sS -H 'Origin: https://<EXAKTER-HOST-DER-HAUPTAPP>' \
  'https://<LIZENZPORTAL-SUPABASE>/functions/v1/license?licenseNumber=<LIZENZNUMMER>' | jq '.appVersions, .mandantenReleases'
```

`<LIZENZPORTAL-SUPABASE>/functions/v1` = eure **`VITE_LICENSE_API_URL`** ohne trailing slash (oder wie in der Doku beschrieben).

---

## 3) Kurz entscheiden: was fehlt?

| Symptom | Massnahme |
|---------|-----------|
| `version.json` ≠ 1.2.2 | **Deploy** auslösen (GitHub), Ref mit **1.2.2** in der **jeweiligen** `package.json` (Root / `portal/` / `arbeitszeit-portal/`). |
| `version.json` = 1.2.2, Build-Zeile in App noch alt | **Harter Reload** / Cache / PWA; ggf. **Service Worker** bzw. „Website-Daten löschen“ für die Origin. |
| API `appVersions.*.version` ≠ 1.2.2 | LP: **Zuweisung**, **Mandanten-app_versions**, **`default_app_versions`** prüfen; **client_config_version**-Bump (passiert u. a. bei Zuweisung). |
| Portal/AZ sollen auch „1.2.2“ heissen | Eigene **`package.json`-Version** in `portal` / `arbeitszeit-portal` anheben **und** ggf. **eigenes** `app_releases`-Row für Kanal **kundenportal** / **arbeitszeit_portal** + Deploy dieser Apps. |

---

## 4) Verweis

- Workflow: `.github/workflows/deploy-pages-from-release.yml` (ein Projekt pro App-Typ, nicht pro Mandant).
- SQL-Beispiel Release: `docs/sql/LP-app-release-1.2.2-wartung-monteur.sql` (Kanal **main**; Zeile „Cloudflare … bauen“ beachten).

Bei Bedarf die **rohe JSON-Antwort** der Lizenz (ohne Secrets) und die **URL** von `version.json` mit jemandem durchgehen – dann lässt sich in einer Minute sagen, ob Deploy oder LP-Daten der Engpass ist.
