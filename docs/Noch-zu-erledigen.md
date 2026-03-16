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
| **Soll täglich/wöchentlich** | Ort für tägliche/wöchentliche Soll-Arbeitszeit (z. B. „Soll Std/Woche“ in Stammdaten AZK); Monatssoll daraus berechnen oder weiter separat. | Optional |
| **Auftragszuordnung** | Vor Release entscheiden: wieder einblenden (`SHOW_ORDER_ASSIGNMENT = true`) oder Code/UI entfernen (siehe `docs/Zeiterfassung-Offene-Punkte-und-IONOS.md` §5). | Vor Release |

---

## 3. Optionale Komponenten Zeiterfassung (später)

| Komponente | Beschreibung |
|------------|--------------|
| §4 ArbZG >9 h | Hinweis: 45 Min Pause bei >9 h Arbeitszeit |
| Überlappende Einträge | Prüfung: kein zweiter aktiver Eintrag; bei neuem Start Hinweis oder automatisch beenden |
| Pausen-Mindestdauer 15 Min | Pausenblock mind. 15 Min (Frontend-Validierung) |
| Schnellzugriff PWA | Start/Ende vom Home-Screen |
| Export CSV/Excel | Zeiterfassung exportieren (Buchhaltung) |
| ArbZG-Vorschlag automatisch | „Pause jetzt starten?“ bei >6 h ohne Pause |
| Genehmigungsworkflow | Teamleiter/Admin genehmigt Zeiten vor Abrechnung |
| Admin-Export „Zeiterfassung sichern“ | Manueller Download aller Zeiten als CSV/JSON |

---

## 4. Haupt-App – Aufräumen ✅ erledigt (März 2025)

In der Haupt-App wurde `Arbeitszeit.tsx` dauerhaft bereinigt (siehe `docs/Arbeitszeit-Umstrukturierung-Portal.md` §6):

- [x] Benutzer-Dropdown, Tabs Woche/Monat/Log, Bearbeiten-Modal entfernt – nur Tag-Ansicht mit Datumsauswahl.
- [x] Komponenten `Wochenansicht`, `Monatsansicht`, `LogAnsicht` gelöscht.
- [x] Imports und Aufrufe von `updateTimeEntryAsAdmin`, `fetchTimeEntryEditLog`, `fetchProfiles`, `fetchOrders`, `fetchOrdersAssignedTo`, `getProfileDisplayName` aus der Zeiterfassungs-Seite entfernt.

**Hinweis:** Auftragszuordnung bleibt per `SHOW_ORDER_ASSIGNMENT = false` ausgeblendet; bei `true` würde nur `startTimeEntry(userId, orderId)` genutzt (Orders-Fetch derzeit nicht eingebaut).

---

## 5. Roadmap Vico (A–J, Lizenzportal) – noch offen

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

## 6. IONOS Hosting & Projektüberarbeitung

| Aufgabe | Beschreibung |
|---------|---------------|
| **IONOS Deploy** | Frontend (Haupt-App, Admin, Portal, Arbeitszeitenportal) per Deploy Now + GitHub; Env-Variablen setzen. Siehe `docs/Zeiterfassung-Offene-Punkte-und-IONOS.md` §7. |
| **Projektüberarbeitung** | Struktur prüfen, Ungenutztes entfernen, **Performance-Optimierung** (laut ursprünglicher Planung nach Abarbeitung der Zeiterfassung-Punkte). |

---

## Empfohlene Reihenfolge

1. **Arbeitszeitenportal befüllen** (§1): Alle Zeiten + Bearbeiten, Log, Stammdaten AZK – damit Admin/Teamleiter das Portal voll nutzen können.
2. **Auftragszuordnung** entscheiden (§2): einblenden oder aus Haupt-App/Portal-Code entfernen.
3. **Optional:** Haupt-App Aufräumen (§4), dann ggf. Teamleiter-Rolle und Soll Woche/Tag (§2).
4. **Roadmap J** und IONOS/Performance** (§5, §6) nach Priorität.
