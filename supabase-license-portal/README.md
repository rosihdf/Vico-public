# Lizenzportal – Supabase Edge Functions

Supabase Edge Functions für das Lizenzportal (Projekt ojryoosqwfbzlmdeywzs).

## Lizenz-Funktion deployen

```bash
cd supabase-license-portal
supabase link --project-ref ojryoosqwfbzlmdeywzs
supabase functions deploy license
```

## Mandanten-DB-Sammelupdate (Button in Admin „Einstellungen“)

Function: **`trigger-mandanten-db-rollout`** – startet den GitHub-Workflow `mandanten-db-apply-complete.yml` (Trockenlauf oder Echtlauf mit `supabase-complete.sql`).

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

Im **GitHub-Repo** zusätzlich Repository-Secret **`MANDANTEN_DB_URLS`** (mehrzeilig, eine DB-URI pro Zeile). Siehe `docs/sql/Mandanten-DB-Workflow.md` §3c.

## Hinweise

- **Vor Release auf Netlify:** Lizenz-Architektur nochmals überdenken.
- **Ladezeiten:** Lizenzportal-Ladezeiten werden beobachtet.
