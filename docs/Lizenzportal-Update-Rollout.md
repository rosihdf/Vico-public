# Lizenzportal-Update (WIP-Bundle) – Rollout

Dieses Paket gehört zur **Lizenzportal-Supabase** (SQL + Edge Function `license`) und zu den **vier deploybaren Apps** (Haupt-App, Kundenportal, Arbeitszeit-Portal, Admin). Die **Mandanten-Haupt-DB** ist separat (`supabase-complete.sql`).

---

## 1. Reihenfolge (empfohlen)

| Schritt | Wo | Aktion |
|--------|-----|--------|
| 1 | **Lizenzportal-DB** | Im SQL Editor: aktuelle `supabase-license-portal.sql` aus dem Repo ausführen (idempotent). Enthält u. a. `tenants.kundenportal_url`, Doku-Header, Beta-Feedback-Schema (falls noch nicht vorhanden). |
| 2 | **Edge Function** | `npm run lp:deploy:mandanten-update` bzw. GitHub Action **„LP – Deploy Mandanten-Update (license)“** – damit `design.kundenportal_url` und Mandanten-Releases in der API ankommen. |
| 3 | **Lizenzportal-DB** | Optional: **`docs/sql/license-portal-app-releases-2026-04-10-bundle.sql`** ausführen – legt **veröffentlichte** `app_releases`-Zeilen für Haupt-App, Kundenportal und Arbeitszeit-Portal an (Versionen passend zu `package.json`). |
| 4 | **Admin** | Pro Mandant **Kundenportal-URL** setzen; unter **Go-Live / Releases** die neuen Versionen den Mandanten zuweisen (`tenant_release_assignments`), sofern ihr mit **Incoming/Pilot** arbeitet – sonst reicht Schritt 3 + Zuweisung. |
| 5 | **Mandanten-DB** | Separater Workflow: `supabase-complete.sql` (u. a. `pruefprotokoll_laufnummer`, `related_order_id`) auf jede Mandanten-DB. |
| 6 | **Hosting** | Cloudflare Pages / Netlify: nur die geänderten Apps neu bauen und ausliefern (Versionen in den jeweiligen `package.json` sind für dieses Bundle angehoben). |

---

## 2. Admin-Version (`admin`)

Die **Lizenz-API** unterstützt `appVersions.admin` über **`platform_config.default_app_versions`** und/oder **`tenants.app_versions`** (JSON). Kanal **`admin`** existiert **nicht** in `app_releases` – dort nur `main`, `kundenportal`, `arbeitszeit_portal`.

Beispiel (nur wenn ihr globale Default-Versionen pflegt):

```sql
-- Vorsicht: bestehendes JSON mergen, nicht blind überschreiben.
-- update public.platform_config set value = value || '{"admin":{"version":"1.0.7"}}'::jsonb
--   where key = 'default_app_versions';
```

Praktisch: Version **1.0.7** im Admin-Build; Anzeige des Update-Banners wie bisher über eure `version.json`/`appVersions`-Logik.

---

## 3. Referenzen

- Ausführliche Änderungsliste (Arbeitsbaum): **`docs/Release-Notes-WIP-Uncommitted.md`**
- Test-Samen für `app_releases`: **`docs/sql/license-portal-test-app-releases.sql`**
- GitHub → LP: **`.github/workflows/sync-release-to-license-portal.yml`** (Tags `main/x.y.z`, …)

---

## 4. Nach dem Rollout

- Stichprobe: Lizenz-API mit gültiger Lizenz + `Origin` → Response enthält `design.kundenportal_url`, `mandantenReleases` / `appVersions` wie erwartet.
- Haupt-App: Prüfprotokoll-PDF, QR nur wenn URL + Report-ID gesetzt.
