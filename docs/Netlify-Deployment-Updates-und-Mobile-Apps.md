# Netlify: Vier Apps bereitstellen, Updates fahren & Mobile (Android / iOS)

Diese Anleitung bündelt **Ersteinrichtung auf Netlify**, den **Update-Prozess pro App**, den **Alltag im Team (mit oder ohne KI)** und den **geplanten Weg zu Store-Apps** mit **PWABuilder** (Android & iOS).  
Technische Vertiefung: `docs/App-Updates-und-Versionierung.md` · Schnellreferenz Netlify: `docs/Netlify-Vier-Apps.md`

---

## Teil A – Die vier „Seiten“ (Sites) im Überblick

| # | Produkt | Ordner im Repo | Netlify **Base directory** | Publish | Besonderheit |
|---|---------|----------------|----------------------------|---------|----------------|
| 1 | **Haupt-App** | Repo-Root | *(leer)* | `dist` | PWA (`vite-plugin-pwa`), `version.json`; Store-Pakete geplant über **PWABuilder** |
| 2 | **Admin / Lizenzportal** | `admin/` | `admin` | `dist` | **Netlify Functions** (`admin/netlify/functions/`), API-Redirects in `admin/netlify.toml` |
| 3 | **Kundenportal** | `portal/` | `portal` | `dist` | Nur statisches SPA + Env |
| 4 | **Arbeitszeit-Portal** | `arbeitszeit-portal/` | `arbeitszeit-portal` | `dist` | Nur statisches SPA + Env |

Alle vier nutzen dasselbe **Git-Repository**. Netlify checkt beim Build **immer das ganze Repo** aus – gemeinsamer Code unter `shared/` ist dadurch auflösbar (`../shared` aus Unterordnern).

---

## Teil B – Ersteinrichtung auf Netlify (Schritt für Schritt)

### B.1 Voraussetzungen

- Repo liegt bei **GitHub**, **GitLab** oder Bitbucket (Netlify kann dort einhängen).
- Du hast ein **Netlify-Konto** und (empfohlen) ein **Team** für Produktion.
- **Node 20** ist in den `netlify.toml`-Dateien vorgesehen – Netlify liest `[build.environment] NODE_VERSION = "20"`.

### B.2 Vier Sites anlegen (je einmal wiederholen)

Für **jede** der vier Zeilen aus der Tabelle oben:

1. Netlify: **Add new site → Import an existing project** → Repository wählen.
2. **Branch:** z. B. `main` (oder euer Produktions-Branch).
3. **Base directory:**
   - Haupt-App: **leer lassen**
   - Admin: `admin`
   - Kundenportal: `portal`
   - Arbeitszeit-Portal: `arbeitszeit-portal`
4. **Build command** / **Publish directory:**  
   In der Regel **übernimmt Netlify** die Werte aus der jeweiligen `netlify.toml` im gewählten Basisordner (Root bzw. Unterordner). Falls nicht:
   - Build: `npm ci && npm run build`
   - Publish: `dist`
5. Site speichern → ersten Deploy abwarten.

### B.3 Umgebungsvariablen (pro Site einzeln!)

- Alle **`VITE_*`**-Variablen werden **beim Build** in das JavaScript eingebettet – **nicht** zur Laufzeit vom Server gelesen.
- **Jede Site** braucht die **passenden** Werte (andere Mandanten-URLs, ggf. andere Keys).

**Orientierung:**

| Site | Beispiel-Datei |
|------|----------------|
| Haupt-App | `.env.example` im Repo-Root |
| Admin | `admin/.env.example` |
| Portal | `portal/.env.example` |
| Arbeitszeit-Portal | `arbeitszeit-portal/.env.example` |

**Admin zusätzlich:** Secrets für **Netlify Functions** (Lizenz-API etc.) – siehe `docs/Lizenzportal-Setup.md` und die Redirects in `admin/netlify.toml` (`/api/license`, …).

In Netlify: **Site configuration → Environment variables** → für Production (und ggf. Preview) anlegen.

### B.4 Domains zuweisen

Typisch **Subdomains** einer Domain, z. B.:

- `app…` → Haupt-App  
- `admin…` → Admin  
- `portal…` / `kunden…` → Kundenportal  
- `arbeitszeit…` / `zeit…` → Arbeitszeit-Portal  

Je Site: **Domain management** → Custom domain hinzufügen → DNS bei eurem Provider (CNAME/A wie von Netlify vorgegeben).

### B.5 Checks nach dem ersten erfolgreichen Deploy

- [ ] **Deep-Links** (direkte URL zu einer Route) laden ohne 404 – SPA-Fallback `/* → /index.html` ist in allen vier `netlify.toml` gesetzt.
- [ ] **Admin:** Aufrufe unter `/api/…` erreichen die Functions (Redirects in `admin/netlify.toml`).
- [ ] **Haupt-App:** `https://eure-app-url/version.json` ist erreichbar (siehe Update-Konzept).

---

## Teil C – Wie laufen „nur noch Updates“? (Konzept vs. Technik)

### C.1 Was „Update“ im Konzept bedeutet

- **Produkt:** Ihr liefert **neue gebaute Dateien** (`dist/`) für **genau die Site(s)**, die sich geändert haben – nicht zwingend alle vier auf einmal.
- **Versionierung:** Pro App **eigene** SemVer in der jeweiligen `package.json` + Einträge in der jeweiligen `release-notes.json` (Haupt-App: `release-notes.json` im **Root**).
- **Datenbank (Supabase):** Hat **keine** App-Version – Migrationen sind ein **gemeinsamer Vertrag** für alle Clients. Siehe `docs/App-Updates-und-Versionierung.md` §9.5–9.6.

### C.2 Technischer Ablauf eines Updates (immer gleich)

1. Code ändern, committen, pushen.
2. Netlify **baut automatisch**, wenn die Site mit dem Branch verbunden ist.
3. Nach Deploy: Nutzer laden ggf. **neues Bundle** (Browser-Cache / PWA / Update-Banner).

**Wichtig:** Wenn **ein Push** alle vier Netlify-Sites triggert (weil alle `main` nutzen), laufen **vier Builds** – funktional ok, kostet aber **Build-Minuten**. Optionen:

- **Netlify „Ignore build“** / Skript: nur bauen, wenn sich Pfade im betreffenden Ordner geändert haben.
- **GitHub Actions** mit `paths:` (z. B. nur `portal/**` → nur Portal deployen) – siehe `docs/App-Updates-und-Versionierung.md` §11.2.
- **Manueller Deploy** nur für eine Site (Deploy-Hook / „Trigger deploy“) nach bewusstem Release.

Das Repo enthält aktuell eine **CI** (`.github/workflows/ci.yml`), die **testet**, aber **nicht** automatisch nach Netlify deployt – Deploy bleibt typischerweise **Netlify ↔ Git** oder ein von euch ergänzter Workflow.

### C.3 Nur **eine** App aktualisieren (Checkliste)

Siehe auch `docs/Anleitung-App-Updates-fuer-Betrieb.md` und §12 in `App-Updates-und-Versionierung.md`.

- [ ] Änderung wirklich nur in **diesem** Ordner (bzw. `shared/` bewusst mitgedacht – dann ggf. **mehrere** Apps neu bauen).
- [ ] In **diesem** Ordner `package.json` → **`version`** erhöhen (SemVer).
- [ ] **`release-notes.json`** im **passenden** Ordner um die neue Version ergänzen.
- [ ] Bei **DB/RPC/RLS**: Migration **kompatibel** (expand-only bevorzugt) und Reihenfolge klären.
- [ ] Deploy **nur** die betroffene Netlify-Site (oder bewusst alle, wenn ihr das wollt).

---

## Teil D – Alltag: Wie arbeitet ihr im Projekt? (Und was macht die KI?)

### D.1 Normaler Entwicklungszyklus (ohne KI)

1. Lokal: Branch oder direkt `main` (je nach Regel), Feature entwickeln.
2. `npm run lint` / Tests / `npm run build` (siehe `docs/Anleitung-App-Updates-fuer-Betrieb.md` §7).
3. **Merge/Push** nach `main` → Netlify deployt (pro konfigurierter Site).
4. Für **Release-Qualität**: Version + Release Notes **vor** oder **mit** dem Merge anheben.

### D.2 Rolle der KI (z. B. Cursor)

Die KI **ersetzt weder Git noch Netlify**. Sinnvoller Ablauf:

1. Du arbeitest **wie gewohnt** im Repo (oder lässt die KI Code ändern).
2. Du sagst **explizit**, was passieren soll, z. B.:  
   *„Wir releasen nur das **Portal**: Version auf 1.0.2 setzen, `portal/release-notes.json` ergänzen, keine DB-Änderung.“*
3. Die KI kann **Dateien anpassen** (Version, Notes, Code). **Du** committest, **du** pushst – oder eure CI.
4. **Deploy** passiert durch **Push/Netlify** – nicht durch einen „Update-Befehl“ an die KI.

**Merksatz:** *„KI bereitet den Release im Repo vor – Build & Deploy laufen über Git + Netlify (oder euren CI-Workflow).“*

### D.3 Wann **müssen** mehrere Apps mit?

- Änderungen in **`shared/`**, die sich auf mehrere Apps auswirken → **jede betroffene App** neu bauen/deployen, die ihr aktiv pflegt.
- **Breaking** API/DB → koordiniertes Vorgehen (siehe Playbook in `App-Updates-und-Versionierung.md` §9.6).

---

## Teil E – Mobile Apps: Android & iOS (**PWABuilder** – geplanter Weg)

> **Festhalten im Plan:** Store-Pakete sollen mit **[PWABuilder](https://www.pwabuilder.com)** (Microsoft) erzeugt werden – aus der bereits gebauten **PWA** der Haupt-App (HTTPS, Manifest, Service Worker).  
> **Capacitor** bleibt optional im Repo (`capacitor.config.ts`, Scripts in `package.json`), falls ihr später **native Plugins** braucht; für die Stores ist **nicht** zwingend Capacitor nötig.

### E.1 Warum PWABuilder zur Haupt-App passt

- Die **Haupt-App** ist eine **Vite-PWA** (`vite-plugin-pwa` in `vite.config.ts`) – genau die Basis, die PWABuilder analysiert und in **Store-Pakete** wandelt.
- **Eine öffentliche HTTPS-URL** der Haupt-App (z. B. Netlify-Produktion) ist die „Quelle“ für PWABuilder.
- **Kundenportal**, **Arbeitszeit-Portal**, **Admin**: eigene Sites – eigene PWAs ggf. separat bei PWABuilder einspielen, **falls** ihr dafür eigene Store-Einträge wollt (meist reicht **eine** Store-App für die Haupt-App).

### E.2 Ablauf mit PWABuilder (überblick)

1. **PWA-Qualität sichern** (vor dem ersten Packaging):
   - `manifest` (Name, Icons, `start_url`, `display`, Theme) sinnvoll gesetzt.
   - **Service Worker** aktiv (bei euch über VitePWA).
   - Seite unter **HTTPS** live (Netlify).
2. **https://www.pwabuilder.com** öffnen → **URL der Haupt-App** eingeben → Report prüfen (Manifest/SW).
3. **„Package for stores“** (o. ä.):  
   - **Android:** typischerweise **Trusted Web Activity (TWA)** / Paket für **Google Play** (AAB/APK je nach Workflow).  
   - **iOS:** PWABuilder bietet **iOS-Store-Paketierung** an; final braucht ihr weiterhin **Apple Developer**, ggf. **macOS/Xcode** für Signatur oder Upload – konkrete Schritte folgen der jeweils aktuellen PWABuilder-Doku.
4. Erzeugte Archive in **Google Play Console** bzw. **App Store Connect** hochladen (Metadaten, Datenschutz, Screenshots, Review).

### E.3 Updates (Web vs. Store bei PWABuilder-Apps)

| Situation | Was passiert |
|-----------|----------------|
| **Nur Web/PWA** auf Netlify neu | Viele Nutzer laden beim nächsten Besuch **neues** HTML/JS; TWA kann die **gleiche URL** laden → oft **ohne** neues Store-Bundle ausreichend. |
| **Neues Store-Release nötig** | Wenn ihr **native Shell**-Metadaten, **Icons**, **Permissions** oder **Store-Pflicht** ändert – neues Paket über PWABuilder bauen und **neue Version** in Play/App Store einreichen. |
| **Richtlinie** | Wie in `App-Updates-und-Versionierung.md` §6: bei **größeren** Haupt-App-Releases oder wenn ihr **sicher** alle Store-Nutzer aktualisieren wollt → neues Store-Build einplanen. |

### E.4 Google Play (Android) – mit PWABuilder-Paket

1. **Play Console**-Account, App anlegen, **Paketname** einmal festlegen (konsistent zu eurem PWABuilder-/TWA-Setup).
2. **Signing** (Upload-Key / Play App Signing).
3. **AAB** aus PWABuilder-Workflow hochladen (kein zwingender Weg über Android Studio, wenn PWABuilder das Paket liefert).
4. Store-Eintrag, Review.

### E.5 Apple App Store (iOS) – mit PWABuilder-Paket

1. **Apple Developer Program**, App in **App Store Connect**.
2. PWABuilder **iOS**-Ausgabe nutzen; **Signatur** und Upload je nach aktuellem Tool (oft Xcode oder Apple-Transporter).
3. Metadaten, Datenschutz, Review (Web-Apps im Store: transparent zur geladenen URL kommunizieren).

### E.6 Alternative im Repo: Capacitor (optional)

- **Ausführliche Schritt-für-Schritt-Anleitung:** **`docs/Capacitor-Schritt-fuer-Schritt.md`** (Android Studio, Xcode, Keystore, Play/App Store, Versionen).
- Scripts: `npm run build:mobile`, `npm run cap:android`, `npm run cap:ios` – Kurzüberblick **`Vico.md`** Abschnitt „Mobile-Build“.
- Nutzen, wenn ihr **Capacitor-Plugins** (Bluetooth, native APIs) **direkt** braucht; für **reine PWA-in-Store** reicht PWABuilder meist schlanker.

### E.7 PWA ohne Store

Nutzer können die **Haupt-App** weiterhin als **PWA** „zum Home-Bildschirm“ installieren – **ohne** Store; Updates über Netlify-Deploy + Service Worker / Reload.

---

## Teil F – Dokumente im Repo (Querverweise)

| Thema | Datei |
|-------|--------|
| Netlify vier Sites, Pfade | `docs/Netlify-Vier-Apps.md` |
| SemVer, `version.json`, getrennte Updates, DB | `docs/App-Updates-und-Versionierung.md` |
| Kurz-Anleitung Betrieb | `docs/Anleitung-App-Updates-fuer-Betrieb.md` |
| Vor Go-Live | `docs/Release-Checkliste.md` |
| **PWABuilder** (geplanter Store-Weg) | Dieses Dokument **Teil E** · [pwabuilder.com](https://www.pwabuilder.com) |
| **Capacitor** (Schritt-für-Schritt) | **`docs/Capacitor-Schritt-fuer-Schritt.md`** · Kurz: `Vico.md` → „Mobile-Build“ |
| Admin-Lizenz-Setup | `docs/Lizenzportal-Setup.md` |

---

**Stand:** März 2026 – als übergreifende Einstiegs-Anleitung; bei Abweichungen im Projekt gewinnen die genannten Detail-Dokumente.
