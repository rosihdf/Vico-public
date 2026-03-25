# Netlify: Mandanten-Env per Skript (Phase C)

**Hinweis:** Ziel-Hosting ist **Cloudflare Pages** – Mandanten-Env für CF: **`docs/Cloudflare-Mandanten-Env-Skript.md`** (`npm run cf:apply-env`). Diese Datei bleibt für **Legacy-Netlify** und Rollback (`last-stand-netlify`).

Ziel: **Weniger Copy-Paste** – dieselben Variablen wie im Admin unter „Deployment / Netlify“, aber als **JSON-Datei** für ein **lokales oder CI-Skript**, das die [Netlify API](https://open-api.netlify.com/) (`createEnvVars` / `PATCH …/env/{key}`) nutzt.

## Voraussetzungen

1. **Netlify Personal Access Token** (User settings → Applications → Personal access tokens).
2. **Account ID** (Team): in der Netlify-URL oder per API; das Skript kann alternativ den **ersten** Account verwenden (dann Warnung bei mehreren Teams).
3. Pro App eine **Site ID**: Netlify → Site → **Site configuration** → **Site details** → **Site ID** (pro Haupt-App, Kundenportal, Arbeitszeitenportal).

## JSON-Format (`version: 1`)

Beispiel: [`examples/vico-netlify-deployment.example.json`](./examples/vico-netlify-deployment.example.json).

| Feld | Bedeutung |
|------|-----------|
| `licenseApiUrl` | Basis-URL der Lizenz-API (ohne Slash am Ende), z. B. `https://admin.example.com/api` |
| `supabase.url` / `supabase.anonKey` | Mandanten-**Supabase** (Dashboard → API) |
| `sites.main` / `portal` / `arbeitszeit` | Je **Netlify Site ID** |
| `portalEnv.includeLicenseNumber` | `false` = kein `VITE_LICENSE_NUMBER` (Host-Lookup Phase B) |
| `portalEnv.licenseNumber` | Nur wenn `includeLicenseNumber` nicht `false` |
| `options.dryRun` | `true` = nur loggen (wie CLI `--dry-run`) |
| `options.markAnonKeyAsSecret` | Standard `true` – Anon-Key als Secret anlegen |

## Skript ausführen

Im **Repo-Root**:

```bash
export NETLIFY_AUTH_TOKEN=...
# optional, empfohlen bei mehreren Teams:
export NETLIFY_ACCOUNT_ID=...

node scripts/netlify-apply-tenant-env.mjs pfad/zur/deployment.json
```

Trockenlauf:

```bash
node scripts/netlify-apply-tenant-env.mjs pfad/zur/deployment.json --dry-run
```

Npm-Alias (Root-`package.json`):

```bash
npm run netlify:apply-env -- configs/mandant-kunde.json
```

**Nach erfolgreichem Lauf:** In Netlify einen **neuen Deploy** auslösen (ggf. „Clear cache and deploy“), damit Vite die `VITE_*` neu einbindet.

## Export aus dem Lizenzportal (Admin)

Im Mandanten-Formular unter **Deployment / Netlify**:

- **JSON für Skript** – lädt eine Vorlage mit `licenseApiUrl`, Supabase-URL (falls in der DB), Lizenznummer optional, **leere** `siteId`-Felder zum Ausfüllen.
- **.env-Paket (Text)** – alle drei Blöcke in einer Datei zum manuellen Einfügen.

## CI (optional)

Secrets im CI: `NETLIFY_AUTH_TOKEN`, `NETLIFY_ACCOUNT_ID`. Die **JSON-Datei** mit echten Keys sollte **nicht** ins öffentliche Repo – z. B. nur in geschützten Branches, verschlüsseltes Secret-Artifact oder manueller Lauf auf einem Rechner mit der Datei.

**Staging:** Ziel-Sites sollten **Staging-Netlify-Sites** sein (siehe `Netlify-README.md` / `Netlify-Vier-Apps.md` §9.5), nicht Produktion – außer bewusst für Release-Produktion.

## Fehlerbehebung

| Symptom | Maßnahme |
|---------|----------|
| `403` / `401` | Token prüfen, Team-Rechte |
| `404` auf PATCH | Skript legt Variable per POST an – bei anhaltendem Fehler Site-ID prüfen |
| Platzhalter abgelehnt | Echte Werte eintragen oder `--force` (nur für Tests) |
| Falsche App nach Deploy | `siteId` vertauscht – jede Netlify-Site hat eigene ID |

---

*Ergänzung zu [`Netlify-README.md`](./Netlify-README.md). Mandanten-Onboarding Phasen A–D: **`Vico.md` §7.6.3**.*
