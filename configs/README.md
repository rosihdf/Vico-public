# Konfigurations-Vorlagen (ohne Secrets)

| Datei | Zweck |
|-------|--------|
| `mandanten-registry.example.json` | Metadaten pro Mandant (`supabase_project_ref`, …) – Kopie nach `mandanten-registry.local.json` (gitignored) |
| `mandanten-db-urls.example.txt` | Vorlage für **psql**-URLs – Kopie nach `mandanten-db-urls.local.txt` (gitignored) |
| `vico-cloudflare-deployment.example.json` | Vorlage für **`npm run cf:apply-env`** (Cloudflare Pages Env) – siehe **`docs/Cloudflare-Mandanten-Env-Skript.md`** |
| `mandanten-edge-secrets.example.env` | Vorlage für **Mandanten-Supabase** Edge-Secrets (`PORTAL_URL`, `APP_URL`, …) – siehe **`docs/Cloudflare-Go-Live-Abarbeitung.md`** |

Netlify-Deployment: siehe **`docs/Netlify-Mandanten-Env-Skript.md`** und **`docs/examples/vico-netlify-deployment.example.json`**.

Mandanten-SQL-Rollout: **`docs/sql/Mandanten-DB-Workflow.md`**.
