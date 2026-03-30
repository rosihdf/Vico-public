# Lizenzportal – Supabase Edge Functions

Supabase Edge Functions für das Lizenzportal (Projekt ojryoosqwfbzlmdeywzs).

## Lizenz-Funktion deployen

```bash
cd supabase-license-portal
supabase link --project-ref ojryoosqwfbzlmdeywzs
supabase functions deploy license
```

## Mandanten-DB-Sammelupdate (Button in Admin „Einstellungen“)

Function: **`trigger-mandanten-db-rollout`** – startet den GitHub-Workflow **`mandanten-db-apply-complete.yml`** (Anzeige: **Mandanten-DB – Rollout (psql)**) mit **target** (staging/production), **sql_file** und **mode** (dry_run/apply).

```bash
supabase functions deploy trigger-mandanten-db-rollout
```

**Secrets** (Dashboard → Project Settings → Edge Functions → Secrets, Namen exakt):

| Secret | Bedeutung |
|--------|-----------|
| `GITHUB_DISPATCH_TOKEN` | GitHub PAT mit `actions: write` auf dem Ziel-Repo |
| `GITHUB_REPO_OWNER` | z. B. GitHub-Organisation oder User |
| `GITHUB_REPO_NAME` | Repo-Name ohne `.git` |
| `GITHUB_WORKFLOW_FILE` | optional, Default `mandanten-db-apply-complete.yml` |
| `GITHUB_DEFAULT_BRANCH` | optional, Default `main` |

Im **GitHub-Repo** zusätzlich: **`MANDANTEN_DB_URLS_STAGING`** und **`MANDANTEN_DB_URLS_PRODUCTION`** (je eine DB-URI pro Zeile). Fallback: wenn PRODUCTION fehlt, nutzt der Workflow **`MANDANTEN_DB_URLS`** (Legacy). Siehe `docs/sql/Mandanten-DB-Workflow.md` §3c.

## Hinweise

- **Vor Release auf Netlify:** Lizenz-Architektur nochmals überdenken.
- **Ladezeiten:** Lizenzportal-Ladezeiten werden beobachtet.
