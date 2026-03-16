# Release-Checkliste Vico

## Vor dem Release auf Netlify

### Lizenz-Architektur

- [ ] **Lizenz-API prüfen:** Aktuell Supabase Edge Function. Alternative: Netlify Function mit Service-Role-Key (siehe `admin/netlify/functions/license.ts`)
- **Entscheidung:** Auf später verschoben – Edge Function bleibt; Netlify-Migration bei Bedarf. Siehe `docs/Entscheidungen-Offene-Punkte.md` §8.

### Lizenzportal

- [ ] GitHub Secrets für Keep-Alive gesetzt (`SUPABASE_LICENSE_PORTAL_URL`, `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY`)
- [ ] Lizenzportal-Supabase nicht pausiert
- [ ] Admin-Login funktioniert

### Haupt-App

- [ ] `VITE_LICENSE_API_URL` in Build-Env korrekt (Produktion)
- [ ] Lizenz-Aktivierung getestet

### Ladezeiten

- [ ] Lizenzportal-Ladezeiten beobachtet – bei Problemen optimieren
