# Arbeitszeit-Umstrukturierung: Arbeitszeitenportal (separates Frontend)

**Stand:** Februar 2025  
**Ziel:** Auswertung, Bearbeitung und Stammdaten (Mitarbeiter, Sollstunden) in ein **separates Frontend** (Arbeitszeitenportal) auslagern – analog Lizenzportal und Kundenportal. Berechtigte (Admin, ggf. Teamleiter) erhalten nur einen sichtbaren Button „Arbeitszeitenportal“. Die **Arbeitszeiterfassung für den Mitarbeiter** bleibt in der Haupt-App und wird **minimal** gehalten: Start, Pause, Ende, Arbeitszeitkonto, Übersicht der erfassten Zeiten.

---

## 1. Was bleibt in der Haupt-App (Mitarbeiter-Erfassung)

| Funktion | Beschreibung |
|----------|--------------|
| **Start** | Arbeitsbeginn buchen |
| **Pause** | Pause starten / Pause beenden (Weiter) |
| **Ende** | Feierabend buchen |
| **Arbeitszeitkonto** | Soll/Ist/Saldo (Monat) anzeigen |
| **Übersicht** | Anzeige der bis jetzt erfassten Zeiten (einfache Liste, z. B. Tagesansicht oder kompakte Übersicht) |
| **ArbZG-Hinweise** | „Vergessen auszustempeln“, Pausen-Hinweis, Ruhezeit (§5) – unverändert |

Keine Wochenansicht, keine Monatsansicht, kein Benutzer-Dropdown, keine Bearbeitung, kein Log in der Haupt-App.

---

## 2. Was ins Arbeitszeitenportal (neues Frontend) ausgelagert wird

| Funktion | Beschreibung | Status im Portal |
|----------|--------------|------------------|
| **Benutzer-Auswahl** | Dropdown „Benutzer“ (eigene Zeiten / andere Mitarbeiter) | Geplant: Seite „Alle Zeiten“ mit User-Filter |
| **Tabs Tag / Woche / Monat / Log** | Ansichtsumschaltung | Geplant: Bereiche im Portal (Tages-, Wochen-, Monatsansicht, Bearbeitungslog) |
| **Wochenansicht** | Mo–So, Vorherige/Nächste Woche, Bearbeiten-Button pro Eintrag | Aus Haupt-App entfernt, im Portal neu aufgebaut |
| **Monatsansicht** | Kalender-Grid mit Stundensummen, AZK-Box Soll/Ist/Saldo | Aus Haupt-App entfernt, im Portal neu aufgebaut |
| **Bearbeitungslog (Log)** | Tab „Log“ mit Filter Zeitraum/Benutzer, Paginierung | Aus Haupt-App entfernt, im Portal neu aufgebaut |
| **Bearbeiten-Modal** | Zeiteintrag bearbeiten (Start/Ende, Grund, optional Auftrag) | Aus Haupt-App entfernt, im Portal neu aufgebaut |
| **Stammdaten AZK** | Sollstunden pro Mitarbeiter hinterlegen | Bisher in Benutzerverwaltung; künftig optional zusätzlich oder ausschließlich im Portal unter „Stammdaten“ |

Zugang: Nur für Berechtigte (Admin, ggf. Teamleiter). URL z. B. eigene Subdomain oder Pfad (konfigurierbar über `VITE_ARBEITSZEIT_PORTAL_URL` in der Haupt-App).

---

## 3. In der Haupt-App ausgeblendete Funktionen (nicht gelöscht)

Diese Teile werden in der Haupt-App **nicht mehr angezeigt** (per Feature-Flag oder bedingter Darstellung). Später entscheiden: entweder **vollständig aus dem Code entfernen** oder **dauerhaft ausblenden**. Sie existieren nur noch im Arbeitszeitenportal oder entfallen.

| Nr. | Funktion / Code-Bereich | Wo | Mögliche spätere Entscheidung |
|-----|--------------------------|-----|--------------------------------|
| 1 | **Benutzer-Dropdown** | `Arbeitszeit.tsx`: `selectedUserId`, `profilesWithZeiterfassung`, Select „Benutzer“ | Entfernen: State und UI komplett löschen (nur in Haupt-App; Portal hat eigene User-Auswahl). |
| 2 | **Tabs Tag / Woche / Monat / Log** | `Arbeitszeit.tsx`: `viewMode`, `setViewMode`, Button-Gruppe „Tag“, „Woche“, „Monat“, „Log“ | Entfernen: Nur „Tag“-Ansicht in Haupt-App behalten; Tab-State und -UI für Woche/Monat/Log löschen. |
| 3 | **Datumsauswahl** (Monat/Woche/Datum) | `Arbeitszeit.tsx`: Input mit `viewMode === 'month' ? 'month' : 'date'` | Anpassen: Nur Datum (Tag) oder fest „heute“; Woche/Monat-Input entfernen. |
| 4 | **Wochenansicht** | `Arbeitszeit.tsx`: Komponente `Wochenansicht`, Aufruf `viewMode === 'week'` | Entfernen: Komponente und Aufruf löschen (im Portal neu implementiert). |
| 5 | **Monatsansicht** | `Arbeitszeit.tsx`: Komponente `Monatsansicht`, Aufruf `viewMode === 'month'` | Entfernen: Komponente und Aufruf löschen (im Portal neu implementiert). |
| 6 | **Bearbeitungslog** | `Arbeitszeit.tsx`: Komponente `LogAnsicht`, Aufruf `viewMode === 'log'` | Entfernen: Komponente und Aufruf löschen (im Portal neu implementiert). |
| 7 | **Bearbeiten-Modal** | `Arbeitszeit.tsx`: `editEntry`, `handleOpenEdit`, `handleSaveEdit`, `handleCloseEdit`, Modal inkl. Felder Start/Ende/Grund/Auftrag | Entfernen: gesamtes Modal und zugehörigen State löschen (nur im Portal). |
| 8 | **„Leseansicht für ausgewählten Benutzer“** | `Arbeitszeit.tsx`: Text bei `!viewingSelf` | Entfernen: kommt nur bei User-Dropdown vor. |
| 9 | **fetchProfiles (für Zeiterfassung)** | `Arbeitszeit.tsx`: useEffect mit `fetchProfiles()` für Admin-User-Dropdown | Entfernen oder nur für Portal: in Haupt-App nicht mehr nötig, wenn kein User-Dropdown. |
| 10 | **Soll/Ist/Saldo in Monatsansicht** | `Arbeitszeit.tsx`: AZK-Box in `viewMode === 'month'` mit `weekWorkMinutes` (Monatswert sollte korrigiert werden) | Verschieben: AZK-Anzeige für Mitarbeiter in Haupt-App in reduzierter Form (z. B. eine feste AZK-Box auf der Tagesseite). |

---

## 4. Bereits zuvor ausgeblendet (unverändert)

| Funktion | Status |
|----------|--------|
| **Auftragszuordnung** | **Entscheidung: Entfernen.** Code/UI in Haupt-App und Portal entfernen; `order_id` ggf. bleiben. Siehe `docs/Entscheidungen-Offene-Punkte.md` §7. |

---

## 5. Technische Umsetzung (Kurz)

- **Neues Frontend:** `arbeitszeit-portal/` (Vite, React, Supabase **Haupt-App** – gleiches Projekt wie Haupt-App, nicht Lizenzportal). Port z. B. 5176.
- **Auth:** Gleiche Supabase-Auth wie Haupt-App (gleiche User). Rolle aus `profiles.role` (admin bzw. teamleiter) für Zugang zum Portal.
- **Haupt-App:** Route `/arbeitszeit` zeigt nur noch die reduzierte Mitarbeiter-Ansicht (Start/Pause/Ende, AZK, Übersicht). Button **„Arbeitszeitenportal“** nur sichtbar, wenn `userRole === 'admin'` (oder später `teamleiter`); Link auf konfigurierbare Portal-URL.
- **Ausblenden:** In der Haupt-App werden die unter §3 genannten Bereiche zunächst **nur ausgeblendet** (z. B. `SHOW_ARBEITSZEIT_ADMIN_UI = false` oder Anzeige nur wenn `userRole !== 'admin'` und `userRole !== 'teamleiter'`). So kann bei Bedarf wieder eingeblendet oder schrittweise aus dem Code entfernt werden.

---

## 6. Checkliste später: Entfernen oder Wiedereinbauen

- [ ] Benutzer-Dropdown in Haupt-App endgültig entfernen (State, Select, fetchProfiles für Dropdown).
- [ ] Tabs Woche/Monat/Log in Haupt-App entfernen; nur Tag-Ansicht behalten.
- [ ] Komponenten `Wochenansicht`, `Monatsansicht`, `LogAnsicht` aus Haupt-App löschen (im Portal vorhanden).
- [ ] Bearbeiten-Modal und zugehörigen State aus Haupt-App löschen.
- [ ] Prüfen: Alle Aufrufe von `updateTimeEntryAsAdmin`, `fetchTimeEntryEditLog`, `fetchProfiles` (für Zeiterfassung) in Haupt-App entfernen oder nur im Portal nutzen.
- [ ] Auftragszuordnung: Entscheidung einblenden oder entfernen (siehe Abschnitt 4).
