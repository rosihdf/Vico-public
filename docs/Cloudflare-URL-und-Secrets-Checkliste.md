# Checkliste: öffentliche URLs & Secrets (vor Cloudflare Go-Live)

**Schritt-für-Schritt mit Checkboxen:** [`Cloudflare-Go-Live-Abarbeitung.md`](./Cloudflare-Go-Live-Abarbeitung.md) · **Vier CF-Projekte anlegen:** [`Cloudflare-Pages-Vier-Projekte-anlegen.md`](./Cloudflare-Pages-Vier-Projekte-anlegen.md)

Ziel: Keine **falschen Links** in E-Mails, keine **blockierten Logins** wegen Auth-Redirects, und **Host-Lookup** der Lizenz-API funktioniert mit den neuen Hosts.

---

## 1. Cloudflare Pages – Build-Env (vier Projekte)

| Variable | Wo gesetzt | Prüfen |
|----------|--------------|--------|
| `VITE_SUPABASE_URL` | Je App | Mandanten-Projekt-URL (Portal/AZ-Portal/Haupt-App) bzw. Lizenzportal (Admin). |
| `VITE_SUPABASE_ANON_KEY` | Je App | Passender Anon-Key. |
| `VITE_LICENSE_API_URL` | Haupt-App, Portal, Arbeitszeitenportal | Basis **`https://<ref>.supabase.co/functions/v1`** ohne Slash am Ende. |
| `VITE_LICENSE_API_KEY` | Falls Edge mit JWT/Key | Lizenzportal-**anon** (siehe `src/lib/licensePortalApi.ts`). |
| `VITE_LICENSE_NUMBER` | Optional | Nur wenn **ohne** vollständigen Host-Lookup gearbeitet wird. |
| `VITE_ARBEITSZEIT_PORTAL_URL` | Nur Haupt-App | Öffentliche URL des Arbeitszeitenportals (Link in der UI), z. B. `https://….pages.dev`. |

Siehe auch: **`docs/Cloudflare-Mandanten-Env-Skript.md`**, `configs/vico-cloudflare-deployment.example.json`.

---

## 2. Lizenzportal (Supabase) – Mandanten-Stammdaten

| Feld / Konzept | Aktion |
|----------------|--------|
| **`allowed_domains`** | Alle produktiven Hosts **ohne** `https://` (z. B. vier `*.pages.dev` + spätere Custom Domains). |
| **`portal_domain`**, **`arbeitszeitenportal_domain`**, **`app_domain`** | Auf **Ziel-Hosts** pflegen (Doku, teils Host-Lookup). |

Details: **`docs/Mandanten-Hostlookup-CF-Pages.md`**.

---

## 3. Mandanten-Supabase – Authentication

| Einstellung | Aktion |
|-------------|--------|
| **Site URL** | Primäre App-URL nach Migration (z. B. Haupt-App `pages.dev` oder Custom). |
| **Redirect URLs** | Alle Login-/Callback-Hosts der **Mandanten-Apps**, die Supabase Auth nutzen (Portale, ggf. Haupt-App). |

---

## 4. Mandanten-Supabase – Edge Functions (Secrets)

Diese Functions laufen im **Mandanten-**Projekt (`supabase/functions/` im Repo-Root). Relevante **Secrets** (Namen wie in Code):

| Function | Secret / Variable | Bedeutung |
|----------|-------------------|-----------|
| `invite-portal-user` | `PORTAL_URL` | Öffentliche Basis-URL des **Kundenportals** für `redirectTo` (`…/auth/callback`). **Leer** → Fallback auf Supabase-Callback (für Portal-Login meist **falsch**). |
| `request-portal-magic-link` | `PORTAL_URL` | Wie oben, inkl. `emailRedirectTo`. |
| `notify-portal-on-report` | `PORTAL_URL` | Link „Zum Kundenportal“ in der E-Mail. **Ohne Secret:** die Function antwortet mit **500** (keine Mail mit falscher URL). |
| `send-maintenance-reminder-digest` | `APP_URL` | Basis-URL der **Haupt-App** für Links in der Digest-Mail. Default im Code: `https://app.example.com` → **in Produktion überschreiben**. |
| (alle mit Resend) | `RESEND_API_KEY`, `RESEND_FROM` | Wie bisher. |

Weitere Functions im Ordner nutzen v. a. `SUPABASE_*` / Cron – siehe jeweilige `index.ts` und `Deno.env.get(...)`.

---

## 5. Lizenzportal-Supabase – Edge (Lizenz-API)

Projekt **`supabase-license-portal/`**: Secrets wie in **`docs/Lizenzportal-Setup.md`** (`SUPABASE_URL`, Service Role, ggf. weitere). Keine **`PORTAL_URL`** hier nötig, sofern nur Lizenz/Limits/Impressum.

---

## 6. Frontends – dynamische URLs (meist unkritisch)

| Stelle | Verhalten |
|--------|-----------|
| `portal/src/pages/Login.tsx` | `redirectTo: window.location.origin + '/auth/callback'` – passt automatisch zum jeweiligen Pages-Host. |
| `src/AuthContext.tsx` | Passwort-Reset: `window.location.origin` – passt. |
| `vite.config.ts` (Haupt-App) | PWA `start_url: '/'` – relativ, **kein** Hardcode alter Domains. |

---

## 7. Optional: Capacitor / Mobile

`capacitor.config.ts`: kein festes Produktions-`server.url`. Wenn ihr Live-Reload nutzt, nur lokale IPs – für Store-Builds irrelevant.

---

## 8. Kurz-Abnahme (manuell)

1. Magic-Link / Invite **Kundenportal**: Mail öffnen → Redirect landet auf **eurem** Portal-Host (Pages oder Custom).  
2. Neuer Wartungsbericht → Benachrichtigungs-Mail → Link zeigt auf **richtiges** Portal.  
3. Wartungs-Digest → Links zeigen auf **richtige** Haupt-App (`APP_URL`).  
4. Portal + Arbeitszeitenportal: Lizenz/Design laden (Host-Lookup oder `VITE_LICENSE_NUMBER`).  

---

## Referenz: betroffene Dateien im Repo

| Datei | Inhalt |
|-------|--------|
| `supabase/functions/invite-portal-user/index.ts` | `PORTAL_URL` |
| `supabase/functions/request-portal-magic-link/index.ts` | `PORTAL_URL` |
| `supabase/functions/notify-portal-on-report/index.ts` | `PORTAL_URL` (Pflicht) |
| `supabase/functions/send-maintenance-reminder-digest/index.ts` | `APP_URL` |
| `src/Arbeitszeit.tsx` | `VITE_ARBEITSZEIT_PORTAL_URL` |
| `shared/licenseHostLookup.ts` / Lizenz-Edge | Host aus `Origin` – Stammdaten siehe oben |

Übergeordnet: **`docs/Cloudflare-Umzug-Roadmap.md`** (Teil A3, Abnahme Teil A).
