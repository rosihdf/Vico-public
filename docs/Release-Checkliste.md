# Release-Checkliste Vico

**Strategie & SemVer-Prozess:** siehe **`docs/App-Updates-und-Versionierung.md`** (Version in `package.json`, `release-notes.json`, Auslieferung von `version.json`, Update-Banner).

## Vor dem Release auf Netlify

### Version & Release Notes (pro deployter App)

- [ ] **Haupt-App:** Root-`package.json` `version` + Root-**`release-notes.json`**
- [ ] **Kundenportal:** `portal/package.json` + **`portal/release-notes.json`**
- [ ] **Arbeitszeit-Portal:** `arbeitszeit-portal/package.json` + **`arbeitszeit-portal/release-notes.json`**
- [ ] **Admin:** `admin/package.json` + **`admin/release-notes.json`**
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
