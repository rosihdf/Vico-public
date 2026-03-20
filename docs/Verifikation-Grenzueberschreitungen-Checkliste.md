# Verifikation: Grenzüberschreitungen → Lizenzportal (Checkliste)

**Zweck (Roadmap Phase 0.2):** Sicherstellen, dass Limit-Überschreitungen von der **Haupt-App** (und ggf. Kundenportal) **im Lizenzportal** ankommen – **einmal** in Produktion oder Staging durchgehen.

**Technische Basis:** `docs/Noch-zu-erledigen.md` §9, `docs/Lizenzportal-Setup.md`, Netlify Function `admin/netlify/functions/limit-exceeded.ts`.

---

## Voraussetzungen (abhacken)

- [ ] **Haupt-App** (Produktion): `VITE_LICENSE_API_URL` zeigt auf die **Netlify-/Function-URL**, die **`limit-exceeded`** ausliefert (nicht direkt auf Supabase, wenn die Function der Einstieg ist).  
- [ ] **Netlify** (oder gleichwertig): Site mit **`limit-exceeded`** deployt; Redirects in `netlify.toml` wie im Repo.  
- [ ] **Lizenzportal-Supabase:** Tabelle **`limit_exceeded_log`** existiert; Edge Function **`limit-exceeded`** **oder** die Netlify-Route schreibt in dieses Projekt (je nach eurer Architektur – mit Entwicklung abgleichen).  
- [ ] **Lizenz** für den Testmandanten in `licenses` mit passender **`license_number`** / Zuordnung, damit Meldungen einem Mandanten zugeordnet werden können.

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
