# Noch zu erledigen – Übersicht

**Stand:** März 2025  
**Quellen:** Vico.md Roadmap, Zeiterfassung-Offene-Punkte, Arbeitszeit-Umstrukturierung-Portal

---

## 1. Arbeitszeitenportal – Inhalte aufbauen ✅ erledigt (März 2025)

Das Portal läuft unter `arbeitszeit-portal/` (Port 5176). **Umsetzung abgeschlossen:**

| Seite | Status |
|-------|--------|
| **Alle Zeiten** | ✅ Benutzer-Dropdown, Tag/Woche/Monat, Zeiteinträge, Bearbeiten-Modal (Start/Ende, Grund). |
| **Log** | ✅ Filter (Zeitraum, Benutzer), Paginierung, Tabelle. |
| **Stammdaten AZK** | ✅ Liste Mitarbeiter, Soll Min/Monat pro Zeile bearbeiten und speichern. |
| **Übersicht** | ✅ Karten-Links zu den drei Bereichen. |

**Später:** Teamleiter-Rolle im Portal freischalten, sobald Rolle „teamleiter“ im Haupt-Projekt existiert (siehe §2). Optional: Soll Std/Woche oder Std/Tag in Stammdaten ergänzen.

---

## 2. Zeiterfassung – Konzeptionell & optional

| Thema | Offen | Priorität |
|-------|--------|-----------|
| **Rechte** | Rechte-Konzept ggf. überarbeiten (wer sieht/bearbeitet was). | Niedrig |
| **Rolle Teamleiter** | Eigene Rolle „teamleiter“: sieht/bearbeitet nur Zeiten des zugewiesenen Teams. Dafür: Zuordnung User → Teamleiter oder Team → Mitglieder im Schema/UI. | Optional |
| **Abwesenheits-Grund** | Optionaler Grund für Tage ohne Erfassung (Dienstreise, Homeoffice, Schulung). | Optional |
| **Freie Tage – Ereignis-Auswahl** | Bei Freie Tage (Betriebsferien, Brückentage): Auswahl vordefinierter Ereignisse/Typen statt nur Freitext. | Offen |
| **Soll täglich/wöchentlich** | Ort für tägliche/wöchentliche Soll-Arbeitszeit (z. B. „Soll Std/Woche“ in Stammdaten AZK); Monatssoll daraus berechnen oder weiter separat. | Optional |
| **Auftragszuordnung** | Vor Release entscheiden: wieder einblenden (`SHOW_ORDER_ASSIGNMENT = true`) oder Code/UI entfernen (siehe `docs/Zeiterfassung-Offene-Punkte-und-IONOS.md` §5). | Vor Release |

---

## 3. Ortung (GPS) – genaue Prüfung erforderlich

**Problem:** GPS-Einträge werden trotz Nutzer-Einwilligung nicht angezeigt.

**Zu prüfen:**

| Prüfpunkt | Beschreibung |
|-----------|-------------|
| **Browser-Berechtigung** | Standort-Zugriff in den Website-Einstellungen (Adressleiste → Schloss/Symbol) prüfen. |
| **HTTPS** | Geolocation funktioniert über HTTP nur auf localhost. |
| **Datenbank-Spalten** | `time_entries` muss `location_start_lat`, `location_start_lon`, `location_end_lat`, `location_end_lon` haben (supabase-complete.sql Zeilen 566–569). |
| **Profil** | `profiles.gps_consent_at` gesetzt und `gps_consent_revoked_at` null? |
| **Browser-Konsole** | Bei Stempeln: `[Geolocation] Fehler: permission_denied | timeout | …`? |
| **Info-Toast** | Erscheint „Standort konnte nicht ermittelt werden“ → Ortung wird versucht, schlägt aber fehl. |

**Referenz:** `docs/Zeiterfassung-Ortung-GPS-Recht-und-Planung.md`.

---

## 4. Zeiterfassung – Feature-Liste

**Vollständige Liste:** `docs/Arbeitszeit-Feature-Liste.md`

**Priorität Hoch (empfohlene Reihenfolge):**
1. ArbZG-Vorschlag automatisch („Pause jetzt starten?“ bei >6 h)
2. Genehmigungsworkflow
3. Export CSV/Excel
4. „Vergessen auszustempeln“-Erinnerung
5. Pausen-Mindestdauer 15 Min

**Priorität Mittel/Niedrig:** siehe Feature-Liste – spätere Entscheidung über zusätzliche Realisierung.

---

## 5. Haupt-App – Aufräumen ✅ erledigt (März 2025)

In der Haupt-App wurde `Arbeitszeit.tsx` dauerhaft bereinigt (siehe `docs/Arbeitszeit-Umstrukturierung-Portal.md` §6):

- [x] Benutzer-Dropdown, Tabs Woche/Monat/Log, Bearbeiten-Modal entfernt – nur Tag-Ansicht mit Datumsauswahl.
- [x] Komponenten `Wochenansicht`, `Monatsansicht`, `LogAnsicht` gelöscht.
- [x] Imports und Aufrufe von `updateTimeEntryAsAdmin`, `fetchTimeEntryEditLog`, `fetchProfiles`, `fetchOrders`, `fetchOrdersAssignedTo`, `getProfileDisplayName` aus der Zeiterfassungs-Seite entfernt.

**Hinweis:** Auftragszuordnung bleibt per `SHOW_ORDER_ASSIGNMENT = false` ausgeblendet; bei `true` würde nur `startTimeEntry(userId, orderId)` genutzt (Orders-Fetch derzeit nicht eingebaut).

---

## 6. Roadmap Vico (A–J, Lizenzportal) – noch offen

Aus **Vico.md** §7.1 – Punkte **ohne** ✅ (bereits erledigt):

| Phase | Nr. | Offener Punkt | Aufwand |
|-------|-----|----------------|---------|
| **J** | J1 | Wartungsplanung / Erinnerungen (z. B. 30 Tage vorher), optional E-Mail | 3–5 T |
| **J** | J2 | Wartungsstatistik / Auswertung (pro Kunde/BV/Objekt, überfällige Wartungen) | 3–4 T |
| **J** | J3 | Export für Buchhaltung (CSV/Excel) | 2–3 T |
| **J** | J4 | Schnellzugriff / Zuletzt bearbeitet auf Startseite | 1–2 T |
| **J** | J5 | Erweiterte Filter Kundenliste (PLZ, Wartungsstatus, BV-Anzahl) | 2 T |
| **J** | J6 | Umbau Wartung (MVP) – Auftrag → Monteursbericht → Freigabe → Portal | 15–20 T |
| **J** | J7 | Mängel-Follow-up, Kalender-Sync (iCal), Bulk-Operationen, Portal Push-Benachrichtigungen | je 2–3 T |
| **J** | J9 | Ladezeiten-Monitoring / Performance-Dashboard (Admin) | 1–2 T |

**Lizenzportal (operativ):** B3/L1 – separates Supabase-Projekt für Lizenzportal anlegen und Schema einspielen (falls noch nicht geschehen). L2/L3 ggf. bereits erledigt (laut Roadmap ✅).

---

## 7. IONOS Hosting & Projektüberarbeitung

| Aufgabe | Beschreibung |
|---------|---------------|
| **IONOS Deploy** | Frontend (Haupt-App, Admin, Portal, Arbeitszeitenportal) per Deploy Now + GitHub; Env-Variablen setzen. Siehe `docs/Zeiterfassung-Offene-Punkte-und-IONOS.md` §7. |
| **Projektüberarbeitung** | Struktur prüfen, Ungenutztes entfernen, **Performance-Optimierung** (laut ursprünglicher Planung nach Abarbeitung der Zeiterfassung-Punkte). |

---

## 8. Merkliste – Operative Schritte (später ausführen)

| Aufgabe | Befehl / Hinweis |
|---------|------------------|
| **Supabase CLI installieren** | `sudo npm install -g supabase` (im eigenen Terminal ausführen, Passwort eingeben) |
| **Edge Function update-impressum deployen** | `cd supabase-license-portal && supabase functions deploy update-impressum --project-ref <projekt-ref>` (nach CLI-Install) |
| **RPC update_profile_soll_minutes** | In Supabase SQL Editor: Funktion `update_profile_soll_minutes` aus `supabase-complete.sql` ausführen, damit Sollwerte aus dem Arbeitszeitenportal in der Haupt-App ankommen |
| **Genehmigungsworkflow** | Spalten `approval_status`, `approved_by`, `approved_at` in `time_entries` – aus `supabase-complete.sql` (Zeilen ~578–587). Bestehende Einträge gelten als freigegeben (Default `approved`). |

---

## 9. Grenzüberschreitungen, Sollwerte, Saldo/Soll – Prüfung

| Thema | Status | Beschreibung |
|-------|--------|--------------|
| **Grenzüberschreitungen → Lizenzportal** | ✅ behoben | Netlify-Funktion `limit-exceeded` ergänzt (`admin/netlify/functions/limit-exceeded.ts`). Haupt-App und Kunden senden `reportLimitExceeded` an `{VITE_LICENSE_API_URL}/limit-exceeded`. Redirect in `netlify.toml` hinzugefügt. Nach Deploy: Grenzüberschreitungen landen in `limit_exceeded_log`. |
| **Sollwerte Arbeitszeit-Portal → Zeiterfassung** | ✅ behoben | RPC `update_profile_soll_minutes` (SECURITY DEFINER) umgeht RLS; Portal nutzt RPC statt direktem `profiles`-Update. Haupt-App: Profil wird bei Tab-Fokus neu geladen. **Wichtig:** Portal und Haupt-App müssen dieselbe DB nutzen (`VITE_SUPABASE_URL` = Haupt-App-Supabase, nicht Lizenzportal). |
| **Saldo und Soll (AZK-Box)** | ✅ geprüft | Berechnung korrekt: Soll aus Profil, Ist = Summe `calcWorkMinutes` für Monat, Saldo = Ist − Soll. `monthWorkMinutes` filtert nach `selectedDate.slice(0, 7)`, Daten werden für Monat geladen. |

**Referenz:** `src/Arbeitszeit.tsx`, `arbeitszeit-portal/src/lib/userService.ts`, `src/lib/userService.ts`, `src/lib/licensePortalApi.ts`.

**Später prüfen:**
- [ ] **Grenzüberschreitungen im Lizenzportal** – Prüfen, ob Meldungen ankommen: Edge Function `limit-exceeded` deployed? `VITE_LICENSE_API_URL` in Haupt-App gesetzt? Lizenz in `licenses` vorhanden? Siehe `docs/Lizenzportal-Setup.md` § Fehlerbehebung Grenzüberschreitungen.

---

## 10. Soll-Berechnung, Urlaub & Compliance (geplant)

**Vollständige Planung:** `docs/Arbeitszeit-Soll-Urlaub-Planung.md`  
**Rechtliche Prüfung:** `docs/Arbeitszeit-Rechtliche-Compliance.md`

| Phase | Inhalt |
|-------|--------|
| **Phase 1** | ✅ Soll-Berechnung: Feiertage, Bundesland, Arbeitstage, Std/Tag, mandantendefinierte freie Tage |
| **Phase 2** | ✅ Urlaubsverwaltung: Anträge, Genehmigung, Anspruch, Resturlaub, Abwesenheitsarten |
| **Phase 3** | ✅ Compliance: Export für Zollprüfung (CSV/PDF), Aufbewahrung (8 Jahre, UI-Hinweis), Urlaubsbescheinigung bei Austritt, Hinweis Aufzeichnung bis 7. Tag |

**Compliance-Empfehlungen (in Planung):**
- Export CSV/PDF für Zoll-/Mindestlohnprüfung
- Aufbewahrung: Keine automatische Löschung; Hinweis „mind. 8 Jahre“; optional konfigurierbare Retention-Policy
- Urlaubsbescheinigung bei Austritt (§ 6 Abs. 2 BUrlG)
- Hinweis „Aufzeichnung bis 7. Tag“ (MiLoG § 17)

---

## Empfohlene Reihenfolge

1. **Grenzüberschreitungen** (§9): Netlify-Funktion ist implementiert – Admin deployen, damit Meldungen ans Lizenzportal gehen.
2. **Sollwerte & Saldo** (§9): Prüfen, ob Soll aus dem Arbeitszeit-Portal in der Zeiterfassung ankommt; Saldo-Berechnung verifizieren.
3. **Zeiterfassung Top-5** (§4): ArbZG-Vorschlag, Genehmigungsworkflow, Export CSV/Excel, Vergessen-Erinnerung, Pausen 15 Min – siehe Feature-Liste.
4. **Ortung (GPS) prüfen** (§3): Warum werden GPS-Einträge trotz Einwilligung nicht angezeigt? Checkliste durchgehen.
5. **Arbeitszeitenportal befüllen** (§1): Alle Zeiten + Bearbeiten, Log, Stammdaten AZK – damit Admin/Teamleiter das Portal voll nutzen können.
6. **Auftragszuordnung** entscheiden (§2): einblenden oder aus Haupt-App/Portal-Code entfernen.
7. **Optional:** Haupt-App Aufräumen (§5), dann ggf. Teamleiter-Rolle und Soll Woche/Tag (§2).
8. **Roadmap J** und IONOS/Performance (§6, §7) nach Priorität.
