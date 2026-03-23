# Release-Checkliste Vico

**Strategie & SemVer-Prozess:** siehe **`docs/App-Updates-und-Versionierung.md`** (Version in `package.json`, `release-notes.json`, Auslieferung von `version.json`, Update-Banner).

**Vor einem geschlossenen Betatest:** **`docs/Betatest-Vorbereitung.md`** (SQL, Env-Check `npm run check:beta-env`, manuelle Smoke-Tests, Text für Tester).

**Automatisierte Tests:** Im Repo-Root `npm run test:all` (Haupt-App + Admin + Arbeitszeit-Portal). **Inkl. Kundenportal-Paket (`portal/`):** `npm run test:all:full`. Einzeln: `npm run test:run` in `portal/` o. ä.

## Vor dem Release auf Netlify

**Vier Netlify-Sites (Haupt-App, Admin, Portal, Arbeitszeit-Portal).** Schnell **`docs/Netlify-README.md`**, ausführlich **`docs/Netlify-Vier-Apps.md`** (Base directory, Build, Publish, Env).

### Staging (vor größeren Releases / Mandanten-Änderungen)

**Doku:** `docs/Netlify-README.md` (Abschnitt **Staging**), `docs/Netlify-Vier-Apps.md` **§9.5**.

- [ ] Staging-Sites oder Deploy Previews nutzen; **`VITE_LICENSE_API_URL`** zeigt auf **Staging-Admin**, nicht auf Produktion
- [ ] Mandanten-**Staging-Supabase** (oder klar abgegrenzte Testdaten); keine Produktions-Keys in öffentlichen Branches
- [ ] Lizenzportal: Test-Mandant mit passenden **`allowed_domains`** / Domains für Staging-Hosts (Host-Lookup) oder **`VITE_LICENSE_NUMBER`** in der Staging-Portal-Site
- [ ] Smoke-Test: Login, Lizenz, eine Kernfunktion – erst danach Produktions-Deploy

### Version & Release Notes (pro deployter App)

- [ ] **Haupt-App:** Root-`package.json` `version` + Root-**`release-notes.json`**
- [ ] **Kundenportal:** `portal/package.json` + **`portal/release-notes.json`**
- [ ] **Arbeitszeit-Portal:** `arbeitszeit-portal/package.json` + **`arbeitszeit-portal/release-notes.json`**
- [ ] **Admin:** `admin/package.json` + **`admin/release-notes.json`** (Versionen müssen übereinstimmen)
- [ ] Nur die Apps bauen/deployen, die sich geändert haben (getrennte Sites)

### Lizenz-Architektur

- [ ] **Lizenz-API prüfen:** Aktuell Supabase Edge Function. Alternative: Netlify Function mit Service-Role-Key (siehe `admin/netlify/functions/license.ts`)
- **Entscheidung:** Auf später verschoben – Edge Function bleibt; Netlify-Migration bei Bedarf. Siehe **`Vico.md` §11.1** (Entscheidungen, Punkt 8 – Lizenz-API).

### Lizenzportal

- [ ] GitHub Secrets für Keep-Alive gesetzt (`SUPABASE_LICENSE_PORTAL_URL`, `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY`)
- [ ] Lizenzportal-Supabase nicht pausiert
- [ ] Admin-Login funktioniert

### Haupt-App

- [ ] `VITE_LICENSE_API_URL` in Build-Env korrekt (Produktion)
- [ ] Lizenz-Aktivierung getestet

### Ladezeiten

- [ ] Lizenzportal-Ladezeiten beobachtet – bei Problemen optimieren
