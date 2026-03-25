# Mandanten: Host-Lookup mit Cloudflare `*.pages.dev`

Wenn die **Lizenz-API** (Supabase Edge) den Mandanten per **Browser-`Origin`** ermittelt, muss der **Host** der aufrufenden App in den **Lizenzportal-Stammdaten** vorkommen.

## Vorgehen

1. Nach Anlage der **vier** Cloudflare-Pages-Projekte die jeweiligen **Projekt-URLs** notieren (z. B. `vico-main-xyz.pages.dev`, …).
2. Im **Lizenzportal** beim Mandanten unter **Domain-Bindung** / **`allowed_domains`** (eine Zeile pro Host, **ohne** `https://`) alle relevanten Hosts eintragen:
   - Haupt-App (`*.pages.dev` oder spätere Custom Domain)
   - Kundenportal
   - Arbeitszeitenportal  
   Optional zusätzlich **Admin**-Host, falls die Admin-UI die Lizenz per `fetch` von anderer Origin abruft.
3. Alternativ (ohne Host-Liste): in den **Build-Env** der Portale **`VITE_LICENSE_NUMBER`** setzen (`portalEnv.includeLicenseNumber` im JSON-Export).

## Mandanten-Supabase Auth

Für jedes **Mandanten-Supabase-Projekt**: **Authentication → URL Configuration** – **Site URL** und **Redirect URLs** um die neuen **Pages**-Hosts ergänzen.

Siehe auch: **`docs/Cloudflare-Umzug-Roadmap.md`** (Teil A3), **`docs/Netlify-README.md`** (Host-Lookup Konzept), **`docs/Cloudflare-URL-und-Secrets-Checkliste.md`** (E-Mails, `PORTAL_URL`, `APP_URL`, Auth).
