# Betatest – Vorbereitung & Checklisten

**Zweck:** Vor einem geschlossenen Betatest Risiken reduzieren: Datenbank, Konfiguration, manuelle Smoke-Tests, klare Erwartungen für Tester.

**Ergänzung zu:** `docs/Release-Checkliste.md` (für produktives Release/Netlify), `docs/Lizenzportal-Setup.md`, `docs/Verifikation-Grenzueberschreitungen-Checkliste.md`.

---

## 1. Mandanten-Datenbank (Supabase Hauptprojekt)

### 1.1 SQL einspielen

- Datei: **`supabase-complete.sql`** (im Repo-Root).
- **Im SQL Editor** des Mandanten-Projekts ausführen (idempotent; bei Fehlern Log prüfen).
- **Reihenfolge:** Die Datei ist so angelegt, dass **DDL vor RPCs** steht (z. B. Urlaub-Spalten vor `approve_leave_request` / `get_profiles_for_zeiterfassung`). Bei **Teil-Kopien** kann es zu Fehlern wie „column … does not exist“ kommen – dann **vollständigen Block** oder die genannten `ALTER TABLE` zuerst ausführen (siehe Kopfkommentar in `supabase-complete.sql`).

### 1.2 Kurz prüfen (optional)

- [ ] Einloggen als Testnutzer möglich  
- [ ] `get_license_status` / Lizenzzeile passt zum Test  
- [ ] Wenn Urlaub im Test: `leave_requests`, ggf. `get_leave_balance_snapshot` testen  

---

## 2. Lizenzportal & API (falls Mandantenfähigkeit aktiv)

- [ ] Lizenzportal-Supabase nicht pausiert; **Edge Functions** deployed (`license`, ggf. `limit-exceeded`, `update-impressum`) – siehe `docs/Lizenzportal-Setup.md`  
- [ ] Im Lizenz-Admin: Mandant mit **App-Name**, optional **Logo-URL** (HTTPS, öffentlich erreichbar), **allowed_domains** für eure Beta-URL(s)  
- [ ] Testlizenznummer in der Haupt-App hinterlegt (Aktivierung) und in den Portalen per Env (s. u.)  

---

## 3. Umgebungsvariablen (Build / Laufzeit)

Lokal prüfen:

```bash
npm run check:beta-env
```

Das Skript liest jeweils **`.env`** (nicht `.env.local` – bei Nutzung von `.env.local` Inhalte manuell abgleichen).

| App | Pfad | Erforderlich für Beta | Empfohlen (White-Label) |
|-----|------|------------------------|-------------------------|
| **Haupt-App** | Repo-Root | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `VITE_LICENSE_API_URL`, ggf. `VITE_LICENSE_API_KEY` |
| **Kundenportal** | `portal/` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `VITE_LICENSE_API_URL`, `VITE_LICENSE_NUMBER`, ggf. Key |
| **Arbeitszeit-Portal** | `arbeitszeit-portal/` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | wie Portal |
| **Lizenz-Admin** | `admin/` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → **Lizenzportal-Projekt** | — |

**Produktions-/Preview-Build:** Gleiche Variablen in **Netlify / Hosting** setzen wie lokal beim erfolgreichen Test.

**Logo:** Wenn `design.logo_url` von **anderer Domain** als die App: auf CORS/`Cross-Origin-Resource-Policy` achten (reines `<img>` ist meist unkritisch).

---

## 4. Manuelle Beta-Checkliste (Happy Path)

*Ein Tester ≈ 30–45 Min, je nach Modulen.*

### Haupt-App (PWA)

- [ ] **Aktivierung** mit Test-Lizenznummer (falls API-Modus)  
- [ ] **Login** (ggf. MFA wie in Prod)  
- [ ] **Startseite:** Dashboard lädt; optional „Zuletzt bearbeitet“, Wartungserinnerungen  
- [ ] **Kunden:** Liste, ein Datensatz öffnen (oder anlegen, wenn erlaubt)  
- [ ] **Wartungsprotokoll** (wenn genutzt): anlegen oder öffnen, PDF-Vorschau kurz prüfen  
- [ ] **Offline:** kurz Flugmodus → App startet / zeigt Offline-Hinweis; wieder online → Sync ohne harten Fehler  
- [ ] **Einstellungen:** App-Name/Logo aus Lizenz sichtbar (wenn API aktiv)  

### Kundenportal

- [ ] Login (Magic Link oder Passwort, wie konfiguriert)  
- [ ] Berichte-Liste, ein PDF öffnen  
- [ ] Header: App-Name / Logo entsprechend Lizenz  

### Arbeitszeit-Portal

- [ ] Login nur **Admin/Teamleiter** (wie konzipiert)  
- [ ] Übersicht oder **Alle Zeiten** laden  
- [ ] Wenn Urlaub im Scope: **Urlaub**-Seite, Saldo sichtbar  
- [ ] Optional: **Standort** nur testen, wenn Feature aktiv und Tester informiert (s. §6)  

### Lizenz-Admin (nur intern)

- [ ] Login, Mandantenliste, ein Mandant öffnen (keine Produktivdaten nötig)  

---

## 5. Hinweise für Betatester (Textvorlage)

*Kann 1:1 in Einladungs-Mail oder kurzem PDF stehen.*

1. **Beta:** Es handelt sich um eine **Vorabversion**. Fehler und Änderungen am Verhalten sind möglich.  
2. **Daten:** Ideal nur **Testdaten** bzw. anonymisierte Mandanten – **keine** sensiblen Echtdaten ohne Freigabe.  
3. **Support:** Fehler bitte mit **Schritt**, **Browser/Gerät**, **Uhrzeit** und **Screenshot** melden.  
4. **Updates:** Nach Deploy ggf. **harter Reload** oder PWA aktualisieren (Cache).  
5. **GPS / Stempel-Ortung:** Feature ist **Beta** – Genauigkeit abhängig von Gerät und Browser; siehe Hinweise in der App.  
6. **Standort senden** (Arbeitszeit-Portal): Nur testen, wenn vom Betreiber gewünscht; **kein** Ersatz für arbeitsrechtliche/DS-rechtliche Klärung.  

---

## 6. Nach dem Betatest

- Feedback bündeln (Showstopper vs. „später“)  
- `Vico.md` §7 (Roadmap) anpassen  
- Bei Schema-Änderungen: Migrationen dokumentieren (`App-Updates-und-Versionierung.md`)  

---

**Pflege:** Bei neuen Pflicht-Env-Vars oder neuen Apps `scripts/check-beta-env.mjs` und diese Datei mitziehen.
