# Netlify Functions (Legacy)

Die Lizenz-API liegt für Neuprojekte auf **Supabase Edge Functions** (`supabase-license-portal/supabase/functions/`).

Diese Handler bleiben für den **Rollback** (Git-Tag `last-stand-netlify`) und lokales **`npm run dev:netlify`** (`npx netlify dev`) referenzierbar; siehe **`docs/Cloudflare-Umzug-Roadmap.md`**. `netlify-cli` liegt nicht mehr in `admin/package.json` (kleinere CI-/Cloudflare-Builds).
