# Lizenzportal – Supabase Edge Functions

Supabase Edge Functions für das Lizenzportal (Projekt ojryoosqwfbzlmdeywzs).

## Nur Mandanten-Update / Lizenz-API (`license`) deployen

**Empfohlen (Repo-Root):** nur diese Function – ohne `limit-exceeded`, `update-impressum`, Rollout-Trigger:

```bash
npm run lp:deploy:mandanten-update
```

Optional mit Ref (ohne vorher `supabase link`):

```bash
npm run lp:deploy:mandanten-update -- --project-ref ojryoosqwfbzlmdeywzs
```

**CI:** Workflow **„LP – Deploy Mandanten-Update (license)“** (`workflow_dispatch`) – Secrets siehe `.github/workflows/supabase-license-portal-deploy-mandanten-update.yml`.

**Nach Schema-Deploy:** Mandanten-Update-Banner / `mandantenReleases` – siehe Repo **`docs/Lizenzportal-Update-Rollout.md`** und optional **`docs/sql/license-portal-app-releases-2026-04-10-bundle.sql`** (veröffentlichte `app_releases`-Zeilen; Zuweisung im Admin).

**Manuell im Ordner:**

```bash
cd supabase-license-portal
supabase link --project-ref ojryoosqwfbzlmdeywzs
supabase functions deploy license
supabase functions deploy admin-send-test-email
```

## Admin: Testmail (Resend / SMTP)

Nach Schema-Deploy (`supabase-license-portal.sql` Abschnitt Mail: `tenant_mail_secrets`, RPCs) die Function **`admin-send-test-email`** deployen (JWT-Pflicht, nur LP-Admin-Session):

```bash
cd supabase-license-portal && supabase functions deploy admin-send-test-email
```

## Mandanten-DB-Sammelupdate (Button in Admin „Einstellungen“)

Function **`trigger-mandanten-db-rollout`** – startet den Workflow **`mandanten-db-apply-complete.yml`** (Inputs inkl. **`run_id`**). Function **`update-mandanten-db-rollout-status`** – nur mit Header **`X-Rollout-Callback-Secret`** (gleicher Wert wie GitHub-Secret **`LP_ROLLOUT_CALLBACK_SECRET`** bzw. **`MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET`**, identisch zu Supabase **`MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET`**).

```bash
supabase functions deploy trigger-mandanten-db-rollout
supabase functions deploy update-mandanten-db-rollout-status
```

**Secrets** (Dashboard → Project Settings → Edge Functions → Secrets, Namen exakt):

| Secret | Bedeutung |
|--------|-----------|
| `GITHUB_DISPATCH_TOKEN` | GitHub PAT mit `actions: write` auf dem Ziel-Repo |
| `GITHUB_REPO_OWNER` | z. B. GitHub-Organisation oder User |
| `GITHUB_REPO_NAME` | Repo-Name ohne `.git` |
| `GITHUB_WORKFLOW_FILE` | optional, Default `mandanten-db-apply-complete.yml` |
| `GITHUB_DEFAULT_BRANCH` | optional, Default `main` |
| `MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET` | Shared Secret für Callback aus GitHub Actions |

Im **GitHub-Repo** zusätzlich: **`MANDANTEN_DB_URLS_STAGING`** und **`MANDANTEN_DB_URLS_PRODUCTION`** sowie **`LP_ROLLOUT_CALLBACK_URL`** (volle URL der Callback-Function) und **`LP_ROLLOUT_CALLBACK_SECRET`** (identisch zu Supabase **`MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET`**). Optional als Fallback: **`MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET`**, falls das neuere Secret noch nicht angelegt wurde. Fallback DB: wenn PRODUCTION fehlt, nutzt der Workflow **`MANDANTEN_DB_URLS`** (Legacy). Siehe `docs/sql/Mandanten-DB-Workflow.md` §3c.

## Hinweise

- Mandanten-Apps (Cloudflare Pages) nutzen **`VITE_LICENSE_API_URL`** → `…/functions/v1`; die Function **`license`** ist der Endpunkt für Releases / `mandantenReleases`.
- **Ladezeiten:** Lizenzportal-Ladezeiten werden beobachtet.
