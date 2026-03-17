# Getroffene Entscheidungen (offene Punkte)

**Stand:** Februar 2025  
**Zweck:** Alle zuvor offenen Entscheidungspunkte sind hier verbindlich festgehalten. Referenzen verweisen auf die jeweiligen Abschnitte in Vico.md bzw. den Fachdokumenten.

---

## 1. App-Name (Projektname)

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Welcher Projektname? (WartungsLog, TürWart, Objektio, Portaio, Baseio, …) |
| **Entscheidung** | **Auf später verschoben.** Der kundenseitige App-Name kommt aus der Lizenz-API (Stammdaten Mandant). Technisch reicht bei späterer Festlegung Anpassung in Lizenzportal, `package.json` und PWA-Manifest. |

**Referenz:** Vico.md §9.2 (Frage 1).

---

## 2. Verhalten bei abgelaufener Lizenz

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Hinweis/Banner, Sperre, Schonfrist Nur-Lesen, Redirect, …? |
| **Entscheidung** | **Schonfrist Nur-Lesen:** Nach Ablauf der Lizenz für eine konfigurierbare Anzahl Tage nur Lesen, danach Redirect zum Aktivierungs-Screen (bzw. Sperre). **Steuerung:** Die Schonfrist (Anzahl Tage) wird **im Lizenzportal** pro Mandant/Lizenz konfiguriert (z. B. 0 = sofort Redirect, 7 = 7 Tage Nur-Lesen). |

**Referenz:** Vico.md §9.10, §9.17 (Roadmap B2).

---

## 3. Lizenz-Trial (14 Tage)

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Optional 14 Tage Trial mit allen Modulen? |
| **Entscheidung** | **Ja – Trial anbieten.** Erstmal: 14 Tage, alle Module (wie vorgeschlagen). **Noch genau definieren:** Was genau im Trial angeboten wird (welche Module, ggf. Limits) – folgt bei Umsetzung. Im Lizenzportal z. B. „Trial starten“ pro Mandant. |

**Referenz:** Vico.md §9.10 (Vorschlag 2), §9.13.

---

## 4. Mandanten-Self-Service

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Sollen Mandanten selbst Lizenz verlängern oder Stammdaten ändern? |
| **Entscheidung** | **Erstmal nur über Lizenzportal durch den Betreiber (Option B).** Self-Service (Option A) folgt später. **Ort für Stammdaten-Self-Service (wenn umgesetzt):** Bereich **„Stammdaten / Impressum“ in den Einstellungen** der Haupt-App (nur für Admin sichtbar), später mit Bearbeiten-Button und Speicherung zurück ans Lizenzportal/Mandanten-API. |

**Referenz:** Vico.md §9.10 (Vorschlag 3), §9.13.

---

## 5. Rechte Zeiterfassung / Teamleiter

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Nur Admin sieht/bearbeitet alle Zeiten, oder zusätzlich Rolle „Teamleiter“? |
| **Entscheidung** | **Teamleiter-Rolle einführen.** Neue Rolle (z. B. `teamleiter`), sieht/bearbeitet nur Zeiten von Benutzern eines zugewiesenen Teams. Team-Zuordnung und genaue Rechte bei Umsetzung planen. **Hinweis:** Rollenname kann später umbenannt werden (z. B. Gruppenleiter, Abteilungsleiter). |

**Referenz:** docs/Zeiterfassung-Offene-Punkte-und-IONOS.md §1.

---

## 6. Soll täglich/wöchentlich (Arbeitszeitkonto)

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Nur Monatssoll (aktuell) oder zusätzlich Soll pro Woche/Tag? |
| **Entscheidung** | **Zusätzlich Soll pro Woche oder Tag (Option B).** In Stammdaten AZK (Arbeitszeitenportal bzw. Benutzerverwaltung) Felder z. B. „Soll Std/Woche“ oder „Soll Std/Tag“; Monatssoll kann daraus berechnet oder weiter separat gepflegt werden. |

**Referenz:** docs/Zeiterfassung-Offene-Punkte-und-IONOS.md §3.

---

## 7. Auftragszuordnung (Zeiterfassung)

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Vor Release: wieder einblenden oder Code/UI entfernen? |
| **Entscheidung** | **Entfernen (Option B).** Code/UI für Auftragszuordnung in Haupt-App und Arbeitszeitenportal entfernen. Spalte `order_id` in `time_entries` kann aus Kompatibilität bleiben und in der Doku erwähnt werden. |

**Referenz:** docs/Zeiterfassung-Offene-Punkte-und-IONOS.md §5, docs/Arbeitszeit-Umstrukturierung-Portal.md §4/§6.

---

## 8. Lizenz-API (Edge Function vs. Netlify)

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Edge Function beibehalten oder auf Netlify wechseln? |
| **Entscheidung** | **Auf später verschoben.** Edge Function bleibt; Migration auf Netlify bei Bedarf (z. B. bei Hosting- oder Plattform-Änderung). Netlify-Option in Release-Checkliste dokumentiert. |

**Referenz:** docs/Release-Checkliste.md.

---

## 9. Etikettendrucker – Integrationsweg

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Option A (Capacitor-Wrapper + Plugin) oder Option B (separate Helper-App)? |
| **Entscheidung** | **Option A (Capacitor-Wrapper + Plugin).** Capacitor ist bereits eingebunden (Roadmap I1); Bluetooth-Drucker-Plugin in der bestehenden nativen Hülle. Option B nur erwägen, wenn die App bewusst reine PWA ohne native Hülle bleiben soll. |

**Referenz:** docs/Etikettendrucker-Planung.md §5.

---

## 10. Suche – Optimierung

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Option A (Quick-Win: weniger Spalten) oder Option B (server-seitige Suche)? |
| **Entscheidung** | **Zuerst Option A (Quick-Win):** Spalten in dataService/syncService reduzieren, davon profitiert auch die Suche. **Option B (server-seitige Suche)** bei Bedarf später umsetzen (z. B. bei sehr großen Datenmengen). |

**Referenz:** docs/Optimierungsplan.md §4.

---

## 11. Speicherkontingent – automatische Ermittlung

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Soll das verfügbare Speicherkontingent automatisch aus der Datenbank/Storage-API ausgelesen werden (statt manuell in `platform_config`)? |
| **Entscheidung** | **Auf IONOS-Umzug verschoben.** Aktuell wird der Gesamtspeicher manuell im Lizenzportal („Gesamtspeicher anpassen“) gepflegt. Die automatische Ermittlung des tatsächlich verfügbaren Speicherkontingents (z. B. über Management API oder IONOS-Storage-API) wird beim Umzug zu IONOS umgesetzt. |

**Referenz:** docs/Zeiterfassung-Offene-Punkte-und-IONOS.md §7 (IONOS Hosting).

---

## Empfohlene Reihenfolge der Umsetzung

Die folgenden Schritte sind so gewählt, dass Abhängigkeiten beachtet werden und schnelle Erfolge zuerst kommen. Punkte ohne Umsetzungsbedarf (1 App-Name, 8 Lizenz-API) sind nicht aufgeführt.

| Reihenfolge | Entscheidung | Begründung | Geschätzter Aufwand |
|-------------|--------------|------------|---------------------|
| **1** | **§7 Auftragszuordnung entfernen** | Reiner Aufräum-Schritt, keine fachlichen Abhängigkeiten. Reduziert Code und Verwirrung. | 0,5–1 T |
| **2** | **§10 Suche Quick-Win (weniger Spalten)** | Data-Layer-Anpassung, unabhängig. Nutzen für Suche und Sync sofort. | 1–2 T |
| **3** | **§2 Abgelaufene Lizenz: Schonfrist + Steuerung** | Lizenzportal: Feld „Schonfrist (Tage)“ pro Mandant/Lizenz. App: Nach Ablauf X Tage Nur-Lesen, danach Redirect. Setzt funktionierenden Lizenz-Abruf und Aktivierungs-Screen voraus. | 1–2 T |
| **4** | **§3 Lizenz-Trial** | Im Lizenzportal „Trial starten“ (14 Tage, alle Module); API/App erkennen Trial-Status. Setzt Mandanten-/Lizenzverwaltung voraus. | 1–2 T |
| **5** | **§5 Teamleiter-Rolle** | Rolle `teamleiter` (oder später umbenannt), Team-Zuordnung, RLS und UI in Haupt-App + Arbeitszeitenportal. Nach dem Arbeitszeitenportal sinnvoll. | 2–3 T |
| **6** | **§6 Soll täglich/wöchentlich** | Schema (z. B. `soll_minutes_per_week` oder `soll_hours_per_day`), Stammdaten AZK im Portal/Benutzerverwaltung, Anzeige/Abgeleitetes Monatssoll. Nach Stammdaten AZK im Portal. | 1–2 T |
| **7** | **§4 Mandanten-Self-Service Stammdaten** | Bereich „Stammdaten / Impressum“ in Einstellungen (nur Admin), Bearbeiten + Speicherung. Setzt Stammdaten aus API und ggf. Backend-Endpoint für Schreibzugriff voraus. | 1,5–2,5 T |
| **8** | **§9 Etikettendrucker (Capacitor-Plugin)** | Wenn Roadmap I2 (Bluetooth-Drucker) ansteht: Plugin in Capacitor-App integrieren. | 1–2 T (bei I2) |

**Hinweis:** Reihenfolge kann je nach Priorität (z. B. Trial vor Schonfrist) getauscht werden. Abhängigkeiten: Lizenz-Themen (2, 3) nach Lizenz-API und Mandanten-CRUD; Zeiterfassungs-Themen (5, 6) nach Arbeitszeitenportal und Stammdaten AZK.

---

## Umsetzungsstand (alle 8 Schritte)

| # | Schritt | Status | Hinweise |
|---|--------|--------|----------|
| 1 | Auftragszuordnung entfernen | ✅ | Haupt-App + Portal: Kein orderId mehr an API; DB-Spalte `order_id` bleibt. |
| 2 | Suche Quick-Win | ✅ | `TIME_ENTRY_COLUMNS` / `TIME_BREAK_COLUMNS` in dataService, timeService, syncService, Portal. |
| 3 | Schonfrist + Lizenzportal | ✅ | `grace_period_days` in Schema, API, Admin-UI; App: `read_only` + Nur-Lesen; LicenseGate lässt bei read_only durch. |
| 4 | Lizenz-Trial | ✅ | `is_trial` in Schema, API, Admin „Trial starten (14 Tage)“; Trial-Badge auf Karten. |
| 5 | Teamleiter-Rolle | ✅ | Rolle `teamleiter`, `team_id` auf profiles, RLS time_entries/time_breaks/edit_log, RPC `get_profiles_for_zeiterfassung`, `update_time_entry_admin` für Teamleiter; Layout/Portal für Teamleiter. |
| 6 | Soll täglich/wöchentlich | ✅ | `soll_minutes_per_week` auf profiles; Portal Stammdaten: Spalte Soll Min/Woche + Speichern. |
| 7 | Stammdaten in Einstellungen | ✅ | Bereich „Stammdaten / Impressum“ (nur Admin), Anzeige aus Lizenz-Cache; Bearbeiten später. |
| 8 | Etikettendrucker (Grundgerüst) | ✅ | `src/lib/etikettendrucker.ts`: `isEtikettendruckerAvailable()`, `printLabel(qrPayload)`; natives Plugin in Android noch zu implementieren. |

**Schema-Migrationen:** `supabase-complete.sql` (profiles: team_id, soll_minutes_per_week, role teamleiter; RLS/RPC). `supabase-license-portal.sql` (licenses: grace_period_days, is_trial). Nachziehen im jeweiligen Supabase-Projekt.

---

*Bei Änderungswunsch: Eintrag hier und in der Referenzdatei anpassen.*
