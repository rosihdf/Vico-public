# Verifikation: Grenzüberschreitungen → Lizenzportal (Checkliste)

**Zweck (Roadmap Phase 0.2):** Sicherstellen, dass Limit-Überschreitungen von der **Haupt-App** (und ggf. Kundenportal) **im Lizenzportal** ankommen – **einmal** in Produktion oder Staging durchgehen.

**Technische Basis:** `Vico.md` §9 (Lizenzportal), `docs/Lizenzportal-Setup.md`. **Standard:** Supabase Edge `limit-exceeded`; Legacy: Netlify `admin/netlify/functions/limit-exceeded.ts`.

---

## Wohin muss `VITE_LICENSE_API_URL` zeigen? (aus dem Code)

Die Haupt-App hängt **`/limit-exceeded`** an die Basis-URL an (`src/lib/licensePortalApi.ts` → `reportLimitExceeded`).

| Variante | Typischer `VITE_LICENSE_API_URL` (ohne Slash am Ende) | Vollständige POST-URL für Grenzüberschreitung |
|----------|------------------------------------------------------|-----------------------------------------------|
| **A – Netlify (Admin/Lizenz-Site)** | `https://<deine-lizenz-domain>/api` | `https://<deine-lizenz-domain>/api/limit-exceeded` → Redirect zu **`/.netlify/functions/limit-exceeded`** (`admin/netlify.toml`) |
| **B – Supabase Edge (Lizenzportal)** | `https://<projekt-ref>.supabase.co/functions/v1` | `https://<projekt-ref>.supabase.co/functions/v1/limit-exceeded` → **`supabase-license-portal/supabase/functions/limit-exceeded/`** |

**Beides ist im Repo vorgesehen** – in Produktion typischerweise **Variante B** (Cloudflare Pages + Edge). Die **Build-Env** der Haupt-App entscheidet. `.env.example` nennt Edge zuerst.

Zusätzlich versucht die App immer, **`report_limit_exceeded`** per RPC in der **Mandanten-Haupt-Supabase** aufzurufen; die **Lizenzportal-Log-Tabelle** füllt primär der Aufruf über **`VITE_LICENSE_API_URL`**.

---

## Voraussetzungen (abhacken)

- [ ] **`VITE_LICENSE_API_URL`** in der **Produktions-Build-Config der Haupt-App** notiert (Variante A oder B oben) – Wert mit Hosting-Panel abgleichen.  
- [ ] **Bei Variante A:** Admin-Site auf Netlify mit `admin/netlify.toml` deployt (Redirects `/api/limit-exceeded`).  
- [ ] **Bei Variante B:** Edge Function **`limit-exceeded`** im Lizenzportal-Supabase deployt.  
- [ ] **Lizenzportal-Supabase:** Tabelle **`limit_exceeded_log`** vorhanden.  
- [ ] **Lizenz** für den Testmandanten in `licenses` mit passender **`license_number`**, damit Meldungen zuordenbar sind.

---

## Ablauf (manuell)

1. [ ] In der **Haupt-App** eine Situation auslösen, die **`reportLimitExceeded`** triggert (z. B. Speicher-/Objektgrenze laut Produktlogik – genauen Trigger aus `licensePortalApi` / `licenseService` zum Testzeitpunkt prüfen).  
2. [ ] **Netlify-Function-Logs** prüfen: Aufruf ohne 4xx/5xx?  
3. [ ] Im **Lizenzportal (Admin-App)** unter den vorgesehenen Ansichten prüfen, ob ein Eintrag in **`limit_exceeded_log`** erscheint bzw. die UI „Grenzüberschreitungen“ aktualisiert wird.  
4. [ ] Optional: **Zweiter Mandant** / anderer Grenzwert – wiederholen, um Verwechslungen auszuschließen.

---

## Wenn etwas fehlt

- `docs/Lizenzportal-Setup.md` – Abschnitt Fehlerbehebung / Grenzüberschreitungen.  
- Prüfen: Function-URL, CORS, `service_role` nur serverseitig, keine Secrets im Frontend.

---

## Ergebnis dokumentieren

| Datum | Geprüft von | Ergebnis (OK / Abweichung) | Notiz |
|-------|----------------|----------------------------|--------|
| | | | |

---

**Stand:** März 2026 (Phase 0 – Checkliste; Live-Test vor Ort)
