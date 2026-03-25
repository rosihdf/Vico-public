# Cloudflare Pages: Mandanten-Env per Skript (CF1)

**Vorausgehend:** Die vier Pages-Projekte müssen existieren (gleiche Projektnamen wie im JSON). Anleitung: [`Cloudflare-Pages-Vier-Projekte-anlegen.md`](./Cloudflare-Pages-Vier-Projekte-anlegen.md).

Ziel: dieselbe Idee wie **`docs/Netlify-Mandanten-Env-Skript.md`** – Build-Variablen (`VITE_*`) für **Haupt-App**, **Kundenportal** und **Arbeitszeitenportal** per JSON + Skript setzen, hier über die **Cloudflare API** (Pages-Projekt **`deployment_configs.production.env_vars`**).

**Voraussetzungen**

1. **API-Token** mit mindestens **Account → Cloudflare Pages → Edit** ([API-Token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)).
2. **Account-ID**: Dashboard-URL `.../accounts/<ACCOUNT_ID>/...` oder Workers & Pages → rechts.
3. Pro App ein **Pages-Projekt** mit **exaktem Projektnamen** (nicht die `*.pages.dev`-Subdomain).

## JSON-Format (`version: 2`)

Vorlage: [`configs/vico-cloudflare-deployment.example.json`](../configs/vico-cloudflare-deployment.example.json).

| Feld | Bedeutung |
|------|-----------|
| `licenseApiUrl` | `https://<lizenzportal-ref>.supabase.co/functions/v1` **ohne** Slash am Ende |
| `licenseApiKey` | Optional: Lizenzportal-**anon**, nur wenn Edge `verify_jwt` nutzt |
| `supabase.url` / `anonKey` | **Mandanten-Supabase** (nicht Lizenzportal) |
| `projects.main` / `portal` / `arbeitszeit` | Je **`projectName`** = Name des CF-Pages-Projekts |
| `portalEnv.includeLicenseNumber` | `false` = kein `VITE_LICENSE_NUMBER` (Host-Lookup) |
| `options.markAnonKeyAsSecret` | `secret_text` in CF (Standard `true`) |

## Skript ausführen

Im **Repo-Root**:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...

npm run cf:apply-env -- pfad/zur/mandant.cf.json
npm run cf:apply-env -- pfad/zur/mandant.cf.json --dry-run
```

Quelle: `scripts/cloudflare-apply-tenant-env.mjs`.

**Nach erfolgreichem Lauf:** In Cloudflare Pages einen **neuen Production-Deploy** auslösen (oder auf den nächsten Git-Push warten), damit Vite die `VITE_*` neu einbindet.

## Export aus dem Lizenzportal (Admin)

**Mandant bearbeiten** → Abschnitt **Deployment / Hosting** → **JSON (Cloudflare)** herunterladen, `projectName`-Felder ausfüllen, Platzhalter ersetzen.

## Hinweise / Fehlerbilder

| Symptom | Maßnahme |
|---------|----------|
| `kein deployment_configs.production` | Projekt mindestens **einmal** erfolgreich gebaut haben (Dashboard oder Git). |
| `HTTP 403` | Token-Berechtigung **Pages Edit** prüfen. |
| `success: false` | Projektname exakt wie in der UI; Account-ID zum richtigen Account. |
| Secrets überschreiben | Skript **merged** bestehende `env_vars`; nur genannte Keys werden gesetzt/aktualisiert. |

## Verknüpfung

- Architektur: **`docs/Cloudflare-Umzug-und-Supabase-Auslagerung.md`**
- Schritte: **`docs/Cloudflare-Umzug-Roadmap.md`** (Teil A / A4)
