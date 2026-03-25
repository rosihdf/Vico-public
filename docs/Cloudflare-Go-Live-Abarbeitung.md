# Cloudflare Go-Live – Schritt für Schritt abarbeiten

Diese Datei ist die **Arbeitsliste** (mit Checkboxen). Technische Details: [`Cloudflare-URL-und-Secrets-Checkliste.md`](./Cloudflare-URL-und-Secrets-Checkliste.md). Überblick Roadmap: [`Cloudflare-Umzug-Roadmap.md`](./Cloudflare-Umzug-Roadmap.md) (Teil B).

**Empfohlene Reihenfolge:** Zuerst **vier Cloudflare-Pages-Projekte** anlegen und URLs notieren ([`Cloudflare-Pages-Vier-Projekte-anlegen.md`](./Cloudflare-Pages-Vier-Projekte-anlegen.md)), danach Lizenz-Edge, Mandanten-Secrets, Stammdaten, Auth, Abnahme.

**Hinweis:** Im Repo liegen die Mandanten-Edge-Functions unter `supabase/functions/`, es gibt **keine** `supabase/config.toml` im Root – Deploy läuft typischerweise mit **Supabase CLI** nach `supabase init`/`link` in eurem Arbeitsklon **oder** über das **Supabase Dashboard** (Secrets dort setzen; Function-Code aus dem Repo übernehmen). Wichtig ist: **`PORTAL_URL` / `APP_URL`** und ein **neuer Deploy** von `notify-portal-on-report`, sobald der Code mit Pflicht-`PORTAL_URL` live soll.

---

## 0. Voraussetzungen & Notizen (einmal ausfüllen)

| Was | Wert (eintragen) |
|-----|------------------|
| Lizenzportal `project-ref` | |
| Cloudflare Pages: Haupt-App-URL (`https://….pages.dev`) | |
| Cloudflare Pages: Admin-URL | |
| Cloudflare Pages: Kundenportal-URL → wird **`PORTAL_URL`** in Mandanten-Supabase | |
| Cloudflare Pages: Arbeitszeitenportal-URL | |
| Mandant(e): `project-ref` (je Zeile) | |

- [ ] **Supabase CLI** installiert und `supabase login` ausgeführt ([Dokumentation](https://supabase.com/docs/guides/cli))
- [ ] **Cloudflare:** API-Token mit **Pages → Bearbeiten** für `npm run cf:apply-env` (siehe [`Cloudflare-Mandanten-Env-Skript.md`](./Cloudflare-Mandanten-Env-Skript.md))

Vorlage Secrets (ohne echte Werte): [`configs/mandanten-edge-secrets.example.env`](../configs/mandanten-edge-secrets.example.env)

---

## 1. Vier Cloudflare-Pages-Projekte (zuerst)

Ausführliche Klick-für-Klick-Anleitung: **[`Cloudflare-Pages-Vier-Projekte-anlegen.md`](./Cloudflare-Pages-Vier-Projekte-anlegen.md)**.

Kurz-Check:

- [ ] **Haupt-App** – Root `/`, `npm ci && npm run build`, Output `dist`, `NODE_VERSION=20`, `VITE_*` gesetzt, Deploy grün, **URL in Tabelle Abschnitt 0**
- [ ] **Admin** – Root `admin`, gleiches Build-Muster, **Lizenzportal-**`VITE_SUPABASE_*`, Deploy grün, URL notiert
- [ ] **Kundenportal** – Root `portal`, Deploy grün, URL notiert
- [ ] **Arbeitszeitenportal** – Root `arbeitszeit-portal`, Deploy grün, URL notiert
- [ ] **Haupt-App:** `VITE_ARBEITSZEIT_PORTAL_URL` = öffentliche URL des Arbeitszeitenportal-Projekts
- [ ] **Haupt-App, Portal, Arbeitszeitenportal:** `VITE_LICENSE_API_URL` = `https://<LIZENZ_REF>.supabase.co/functions/v1` (ohne Slash am Ende)
- [ ] Optional: Env mit **`npm run cf:apply-env`** + JSON ([`Cloudflare-Mandanten-Env-Skript.md`](./Cloudflare-Mandanten-Env-Skript.md)) statt nur UI

---

## 2. Lizenz-API auf dem Lizenzportal-Supabase (Variante B)

- [ ] Projekt verknüpfen: `cd supabase-license-portal && supabase link --project-ref <LIZENZ_REF>`
- [ ] Deploy: `supabase functions deploy license limit-exceeded update-impressum`
- [ ] Secrets laut [`Lizenzportal-Setup.md`](./Lizenzportal-Setup.md) gesetzt (Service Role, ggf. weitere)

**Smoke (Lizenz):** (Anon-Key nur in sicherer Umgebung nutzen)

```bash
curl -sS "https://<LIZENZ_REF>.supabase.co/functions/v1/license?licenseNumber=VIC-…" \
  -H "apikey: <LIZENZ_ANON_KEY>" \
  -H "Authorization: Bearer <LIZENZ_ANON_KEY>"
```

- [ ] Antwort: erwartetes JSON / kein CORS-Problem vom geplanten Portal-Origin (Browser-Test zusätzlich)

---

## 3. Mandanten-Supabase: Secrets `PORTAL_URL` & `APP_URL`

**Pro Mandanten-Projekt** (öffentliche URLs **ohne** trailing slash):

| Secret | Beispiel | Wofür |
|--------|-----------|--------|
| `PORTAL_URL` | `https://<kundenportal>.pages.dev` | E-Mail-Link Wartungsbericht; Magic-Link / Invite Redirect |
| `APP_URL` | `https://<haupt-app>.pages.dev` | Links in `send-maintenance-reminder-digest` |
| `RESEND_API_KEY` / `RESEND_FROM` | | E-Mail-Versand (falls genutzt) |

**CLI** (ohne dauerhaftes `link` im gleichen Ordner; `<MANDANT_REF>` = 20-stelliges Ref):

```bash
supabase secrets set \
  PORTAL_URL="https://<kundenportal>.pages.dev" \
  APP_URL="https://<haupt-app>.pages.dev" \
  --project-ref <MANDANT_REF>
```

Weitere Keys bei Bedarf: `supabase secrets set RESEND_API_KEY="…" RESEND_FROM="…" --project-ref <MANDANT_REF>`

- [ ] Mandant A: `PORTAL_URL` + `APP_URL` gesetzt  
- [ ] Mandant B: … (weitere Zeilen)

**Wichtig:** Nach Setzen der Secrets sind sie für **bereits deployte** Functions verfügbar; für **`notify-portal-on-report`** muss der **aktuelle Code** (Pflicht `PORTAL_URL`) trotzdem **deployt** sein.

---

## 4. Mandanten-Edge-Functions deployen (Code aus Repo)

- [ ] `notify-portal-on-report` mit neuem Verhalten deployt  
- [ ] Übrige genutzte Functions aus `supabase/functions/` wie bisher / nach Bedarf deployt  

Konkreter CLI-Weg hängt von eurem Setup ab (`supabase link` im passenden Verzeichnis, siehe Hinweis oben). Liste der Ordner: `invite-portal-user`, `request-portal-magic-link`, `notify-portal-on-report`, `send-maintenance-reminder-digest`, …

---

## 5. Lizenzportal: Mandanten-Stammdaten (Host-Lookup)

- [ ] `allowed_domains`: alle vier `*.pages.dev`-Hosts (ohne `https://`) eingetragen  
- [ ] Optional: `portal_domain`, `arbeitszeitenportal_domain`, `app_domain` auf Ziel-Hosts  

Siehe [`Mandanten-Hostlookup-CF-Pages.md`](./Mandanten-Hostlookup-CF-Pages.md).

---

## 6. Mandanten-Supabase → Authentication

- [ ] **Site URL** und **Redirect URLs** um Portal- und ggf. Haupt-App-/AZ-Portal-Hosts ergänzt  

---

## 7. Abnahme (kurz)

- [ ] Kundenportal: Login / Magic-Link landet auf **eurem** Portal-Host  
- [ ] Neuer Wartungsbericht → E-Mail → Link **Kundenportal** korrekt  
- [ ] Wartungs-Digest → Links **Haupt-App** korrekt (`APP_URL`)  
- [ ] Portal + Arbeitszeitenportal: Lizenz/Design (Host-Lookup oder `VITE_LICENSE_NUMBER`)  
- [ ] Admin: Impressum-Patch / Grenzüberschreitung gegen Edge (falls im Scope)  

---

## 8. Danach (Teil B Rest)

- [ ] Custom Domains / DNS wie in Roadmap  
- [ ] Netlify als Reserve, später abbauen  
