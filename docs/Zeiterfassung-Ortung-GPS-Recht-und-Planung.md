# Zeiterfassung: Ortungsfunktion (GPS) – Rechtliche Anforderungen und Umsetzungsplan

**Stand:** Februar 2025  
**Ziel:** Ortungsfunktion für die Zeiterfassung gesetzeskonform planen – inkl. aller Informations- und Einwilligungspflichten sowie Anzeige des Standorts im Zeiterfassungs-Portal.

---

## 1. Kurzüberblick

| Thema | Inhalt |
|-------|--------|
| **Rechtliche Grundlagen** | DSGVO, BDSG § 26, BetrVG § 87 Abs. 1 Nr. 6 |
| **Rechtsgrundlage Verarbeitung** | Einwilligung (§ 26 Abs. 2 BDSG) oder ggf. Erforderlichkeit (§ 26 Abs. 1 BDSG) – bei reiner Zeiterfassung mit Standort überwiegt Einwilligungslösung |
| **Betriebsrat** | Mitbestimmung bei Einführung technischer Überwachung (§ 87 Abs. 1 Nr. 6 BetrVG) – **Betriebsvereinbarung empfohlen** |
| **Informationspflicht** | Art. 13 DSGVO: Zweck, Rechtsgrundlage, Speicherdauer, Empfänger, Rechte, Widerruf, Verantwortlicher |
| **Einwilligung** | Schriftlich/elektronisch, freiwillig, jederzeit widerrufbar; Nutzer muss vor Nutzung informiert werden und explizit zustimmen |
| **DSFA** | Datenschutz-Folgenabschätzung (Art. 35 DSGVO) ist bei systematischer Ortung in der Regel **erforderlich** (hohes Risiko) |
| **Anzeige Standort** | Im Zeiterfassungs-Portal (Admin/Teamleiter) pro Zeiteintrag, nur wenn Ortung aktiv und Nutzer eingewilligt hat |

---

## 2. Rechtliche Rahmenbedingungen (Deutschland/EU)

### 2.1 DSGVO und BDSG

- **Standortdaten** sind personenbezogene Daten (Art. 4 Nr. 1 DSGVO). Sie können Bewegungsprofile ermöglichen und sind besonders sensibel.
- **Rechtsgrundlagen** im Beschäftigtenkontext:
  - **§ 26 Abs. 1 BDSG:** Verarbeitung, die für die **Durchführung oder Beendigung** des Beschäftigungsverhältnisses **erforderlich** ist. Bloße Effizienzsteigerung oder Kontrolle reichen nicht; bei reiner „Standortkontrolle“ ohne zwingenden betrieblichen Zweck (z. B. Sicherheit bei Geldtransport) wird die Erforderlichkeit oft verneint.
  - **§ 26 Abs. 2 BDSG:** **Einwilligung** des Beschäftigten. Wegen des Machtgefälles muss die Freiwilligkeit besonders beachtet werden; die Einwilligung ist **jederzeit widerrufbar**. Sie muss **vor** der ersten Erhebung eingeholt werden und der Arbeitgeber muss über **Zweck** und **Widerrufsrecht** aufklären.

Für eine **optionale** Ortung im Rahmen der Zeiterfassung („wenn der Nutzer einverstanden ist“) ist die **Einwilligungslösung** der passende Weg: Der Nutzer erhält alle gesetzlich vorgeschriebenen Informationen und bestätigt ausdrücklich, dass er die Ortungsfunktion nutzen möchte.

### 2.2 Informationspflicht (Art. 13 DSGVO)

Der Verantwortliche (Arbeitgeber / Betreiber der App) muss die betroffene Person **bei der Erhebung** der Daten u. a. informieren über:

| Pflichtangabe | Inhalt (Beispiel für Ortung Zeiterfassung) |
|---------------|--------------------------------------------|
| **Verantwortlicher** | Name/Kontakt des Verantwortlichen (Firma/Anschrift) |
| **Zweck** | Erfassung des Standorts bei Arbeitsbeginn/-ende zur Dokumentation im Rahmen der Zeiterfassung (keine Dauerüberwachung, keine Bewegungsprofile) |
| **Rechtsgrundlage** | Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 26 Abs. 2 BDSG) |
| **Speicherdauer** | z. B. „Bis zum Ende der gesetzlichen Aufbewahrungsfrist für Arbeitszeitdaten (in der Regel 2 Jahre nach Ablauf des Kalenderjahres)“ oder betrieblich festgelegte Frist |
| **Empfänger** | Wer sieht die Daten (z. B. Admin, Teamleiter, ggf. IT-Dienstleister) |
| **Rechte** | Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch, Widerruf der Einwilligung |
| **Widerruf** | Hinweis: Einwilligung ist freiwillig und kann jederzeit mit Wirkung für die Zukunft widerrufen werden |
| **Beschwerde** | Recht, sich bei einer Aufsichtsbehörde zu beschweren |
| **Pflicht/optional** | Dass die Angabe freiwillig ist und Zeiterfassung auch ohne Ortung möglich ist |

Diese Informationen müssen der Nutzer **vor** der ersten Aktivierung der Ortung **lesen können** und durch eine **aktive Bestätigung** (z. B. Checkbox + Button „Einverstanden und Ortung aktivieren“) zustimmen.

### 2.3 Einwilligung – gesetzliche Vorgaben

- **Freiwilligkeit:** Kein Nachteil bei Verweigerung (Zeiterfassung ohne Ortung muss uneingeschränkt nutzbar sein).
- **Form:** Schriftlich oder in gleichwertiger elektronischer Form (z. B. bestätigte Erklärung in der App mit Datum/Zeit).
- **Nachweis:** Speicherung, dass und wann die Einwilligung erteilt (und ggf. widerrufen) wurde (z. B. `gps_consent_at`, `gps_consent_revoked_at` im Profil).
- **Widerruf:** Jederzeit möglich; nach Widerruf keine weitere Ortung, bestehende Standortdaten nach Maßgabe der Speicherfrist löschen oder anonymisieren.

### 2.4 Betriebsverfassungsgesetz (BetrVG) – Betriebsrat

- **§ 87 Abs. 1 Nr. 6 BetrVG:** Bei der **Einführung und Anwendung technischer Einrichtungen**, die dazu bestimmt sind, das Verhalten oder die Leistung der Beschäftigten zu überwachen, hat der **Betriebsrat ein zwingendes Mitbestimmungsrecht**.
- GPS-Ortung zur Zeiterfassung fällt in der Regel unter diese Vorschrift. Der Arbeitgeber darf die Ortungsfunktion **nicht einseitig** einführen; eine **Betriebsvereinbarung** (oder Einigung mit dem Betriebsrat) ist erforderlich.
- **Hinweis für die Dokumentation:** In der Planung und in den AGB/Informationstexten sollte festgehalten werden: „Die Nutzung der Ortungsfunktion setzt eine betriebliche Regelung (z. B. Betriebsvereinbarung) voraus. Bitte klären Sie mit dem Betriebsrat bzw. Arbeitgeber die Einführung.“

### 2.5 Datenschutz-Folgenabschätzung (Art. 35 DSGVO)

- Eine **DSFA** ist erforderlich, wenn die Verarbeitung voraussichtlich ein **hohes Risiko** für die Rechte und Freiheiten natürlicher Personen zur Folge hat.
- **Standortdaten** und mögliche Bewegungsprofile werden von Aufsichtsbehörden und Gerichten als **hoch riskant** eingestuft; bei systematischer Ortung von Beschäftigten ist eine **DSFA in der Regel Pflicht**.
- Die DSFA muss **vor Beginn** der Verarbeitung durchgeführt werden und u. a. enthalten:
  - Beschreibung der Verarbeitung und der Zwecke,
  - Bewertung von Notwendigkeit und Verhältnismäßigkeit,
  - Risiken für die Betroffenen,
  - geplante Abhilfemaßnahmen (technisch und organisatorisch).

**Umsetzungshinweis:** Der Betreiber/Arbeitgeber muss die DSFA selbst (oder mit dem Datenschutzbeauftragten) erstellen; die Software kann keine DSFA ersetzen. In der Dokumentation/den Release Notes sollte darauf hingewiesen werden: „Vor Einführung der Ortungsfunktion ist eine Datenschutz-Folgenabschätzung durch den Verantwortlichen erforderlich.“

### 2.6 Speicherdauer

- Arbeitszeitdaten unterliegen **aufbewahrungspflichtigen** Vorgaben (z. B. Mindestdauer für Nachweise). Standortdaten sollten **nicht länger** als nötig aufbewahrt werden.
- Empfehlung: **Gleiche oder kürzere Frist** als für die Zeiteinträge selbst (z. B. 2 Jahre nach Ablauf des Kalenderjahres), sofern keine längere gesetzliche Frist gilt. In den Nutzerinformationen muss die Speicherdauer klar angegeben werden.

---

## 3. Was der Nutzer erhalten und bestätigen muss

### 3.1 Ablauf (nutzergeführt)

1. **Information anzeigen**  
   Beim ersten Aufruf der Zeiterfassung (oder in den Einstellungen „Ortung“) wird ein **Informationsblock** angezeigt mit:
   - allen oben genannten Pflichtangaben (Art. 13 DSGVO) in verständlicher Sprache,
   - Hinweis auf Freiwilligkeit und darauf, dass Zeiterfassung auch ohne Ortung möglich ist,
   - Hinweis auf Widerruf jederzeit möglich.

2. **Aktive Bestätigung**  
   - Checkbox: „Ich habe die Informationen gelesen und bin damit einverstanden, dass mein Standort bei Arbeitsbeginn und -ende im Rahmen der Zeiterfassung erfasst und gespeichert wird.“  
   - Button: „Einverstanden und Ortung aktivieren“ (oder vergleichbar).  
   - Ohne Häkchen ist der Button deaktiviert. Ein Klick speichert die Einwilligung (Zeitstempel, User-ID) und aktiviert die Ortung.

3. **Widerruf**  
   - In den Einstellungen (oder auf der Zeiterfassungsseite): Option „Ortung deaktivieren / Einwilligung widerrufen“.  
   - Nach Widerruf: keine weiteren Standortdaten erfassen; Hinweis auf Löschung/Anonymisierung bestehender Daten gemäß Speicherfrist.

4. **Erneute Aktivierung**  
   - Wenn der Nutzer später wieder Ortung nutzen möchte: Informationsblock erneut anzeigen und erneute Bestätigung verlangen (Datum der neuen Einwilligung speichern).

### 3.2 Mustervorschlag für den Informationstext (Kerninhalt)

*(Rechtlich verbindlich ist der vom Verantwortlichen/Rechtsberatung freigegebene Text; hier nur als Gerüst.)*

- **Wer ist verantwortlich?** [Name/Anschrift des Verantwortlichen]
- **Wozu wird der Standort erfasst?** Zur Dokumentation des Arbeitsortes bei Beginn und Ende der Arbeitszeit im Rahmen der Zeiterfassung. Es erfolgt keine Dauerortung und keine Auswertung von Bewegungsprofilen.
- **Rechtsgrundlage:** Ihre Einwilligung (§ 26 Abs. 2 BDSG, Art. 6 Abs. 1 lit. a DSGVO).
- **Speicherdauer:** [z. B. 2 Jahre nach Ablauf des Kalenderjahres der Erfassung.]
- **Wer sieht die Daten?** [Admin, ggf. Teamleiter; nur im Rahmen der Zeiterfassung.]
- **Ihre Rechte:** Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch, Widerruf der Einwilligung. Bei Widerruf wird keine weitere Ortung durchgeführt.
- **Freiwilligkeit:** Die Angabe ist freiwillig. Sie können die Zeiterfassung auch ohne Ortung nutzen.
- **Beschwerde:** Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.

Zusätzlich: **Hinweis auf Betriebsrat:** „Die Einführung der Ortungsfunktion erfolgt im Einklang mit der betrieblichen Regelung (Betriebsvereinbarung).“

---

## 4. Technische Umsetzungsplanung

### 4.1 Schema (Datenbank)

- **`profiles`** (bereits vorhanden), erweitern um:
  - `gps_consent_at` (timestamptz, null): Zeitpunkt der letzten Einwilligung zur Ortung.
  - `gps_consent_revoked_at` (timestamptz, null): Zeitpunkt des Widerrufs (wenn widerrufen, dann keine weitere Ortung).
- **`time_entries`** erweitern um (optional, nur befüllt wenn Ortung aktiv und Nutzer eingewilligt):
  - `location_start_lat` (double precision, null), `location_start_lon` (double precision, null), optional `location_start_accuracy` (float, null).
  - `location_end_lat`, `location_end_lon`, optional `location_end_accuracy`.
- Alternative: Nur **ein** Standort pro Eintrag (z. B. bei Start) speichern, wenn gewünscht geringerer Umfang.

RLS: Unverändert – wer Zeiteinträge lesen darf, darf die Standortspalten mitlesen (keine separate Policy nötig, da gleiche Zeile). Zugriff nur für Berechtigte (Admin/Teamleiter/Eigener Eintrag).

### 4.2 Haupt-App (Vico Web-App) – Zeiterfassung

- **Route `/arbeitszeit`:**  
  - Beim **Start** und **Ende** einer Arbeitszeit: Wenn `gps_consent_at` gesetzt und `gps_consent_revoked_at` null ist, **Geolocation API** (navigator.geolocation.getCurrentPosition) aufrufen und Koordinaten (und ggf. Genauigkeit) in den neuen bzw. aktualisierten Zeiteintrag schreiben.
  - Wenn der Nutzer noch keine Einwilligung gegeben hat: **Informationsseite/Modal** mit vollständigem Informationstext und Checkbox + „Einverstanden und Ortung aktivieren“. Nach Bestätigung: `gps_consent_at` setzen (Update Profil), danach Ortung bei Start/Ende durchführen.
  - **Einstellungen / Zeiterfassung:** Option „Ortung deaktivieren (Einwilligung widerrufen)“: setzt `gps_consent_revoked_at`, keine weiteren Standortabfragen.
- **Capacitor/App:** Auf Mobilgeräten ggf. **Permissions** (iOS/Android) für Standort abfragen; nur wenn Nutzer bereits in der App eingewilligt hat (Reihenfolge: erst rechtliche Einwilligung in der App, dann System-Permission).

### 4.3 Zeiterfassungs-Portal (arbeitszeit-portal)

- **Anzeige des Standorts:**  
  - In der Ansicht **„Alle Zeiten“** (und ggf. im **Bearbeitungslog**) pro Zeiteintrag: Wenn `location_start_*` oder `location_end_*` befüllt sind, Anzeige z. B. als „Standort (Start): 52.5200° N, 13.4050° E“ oder als Link zu einer Karte (z. B. OpenStreetMap: `https://www.openstreetmap.org/?mlat=...&mlon=...`).
  - Optional: kleine Kartenvorschau (Static Map API oder iframe) – datenschutzfreundlich nur für berechtigte Rollen (Admin/Teamleiter).
- **Filter/Export:** Keine Weitergabe von Standortdaten außerhalb der berechtigten Nutzer; in Exports (falls später) Standort optional und nur für Berechtigte.

### 4.4 Sync / Offline

- Standortfelder in `time_entries` werden wie die übrigen Felder mitgesynct. Offline: Standort beim Stempeln erfassen und in der Outbox mitsenden (wie andere Zeiterfassungsdaten).

### 4.5 Zusammenfassung Implementierung

| Komponente | Inhalt |
|------------|--------|
| **Schema** | `profiles`: `gps_consent_at`, `gps_consent_revoked_at`; `time_entries`: `location_start_lat/lon` (und ggf. `location_end_*`, `*_accuracy`) |
| **Haupt-App** | Informationsblock + Einwilligungs-UI (vor erster Ortung); bei Start/Ende Ortung nur wenn Einwilligung aktiv; Einstellung „Ortung widerrufen“ |
| **Portal** | Anzeige Standort pro Zeiteintrag in „Alle Zeiten“ (und ggf. Log), nur wenn Daten vorhanden |
| **Rechtstexte** | Vom Verantwortlichen bereitstellbar (Konfiguration oder feste Texte in der App); Mustervorschlag siehe Abschnitt 3.2 |

---

## 5. Checkliste für gesetzeskonforme Umsetzung

| Nr. | Anforderung | Erledigung |
|-----|------------|------------|
| 1 | Information nach Art. 13 DSGVO (Zweck, Rechtsgrundlage, Speicherdauer, Rechte, Widerruf, Verantwortlicher) dem Nutzer **vor** erster Ortung anzeigen | |
| 2 | Einwilligung nur durch **aktive Bestätigung** (Checkbox + Button), keine stillschweigende Ortung | |
| 3 | **Nachweis** der Einwilligung (Datum/Zeit in `gps_consent_at`) und des Widerrufs (`gps_consent_revoked_at`) | |
| 4 | **Widerruf** jederzeit möglich; nach Widerruf keine weitere Ortung | |
| 5 | Zeiterfassung **ohne Ortung** uneingeschränkt nutzbar (Freiwilligkeit) | |
| 6 | **Betriebsrat** einbeziehen (Hinweis in Doku/AGB; Betriebsvereinbarung durch Kunde) | |
| 7 | **DSFA** durch Verantwortlichen vor Go-Live (Hinweis in Doku) | |
| 8 | **Speicherdauer** in den Nutzerinformationen angegeben und technisch umsetzbar (Löschung/Anonymisierung nach Frist) | |
| 9 | **Anzeige Standort** nur für berechtigte Rollen (Admin/Teamleiter) im Portal | |
| 10 | Keine Dauerortung; nur **punktuelle** Erfassung bei Start/Ende der Arbeitszeit | |

---

## 6. Verweise

- **Vico.md:** Arbeitszeiterfassung (Modul), Route `/arbeitszeit`, Lizenzmodul.
- **Arbeitszeiterfassung-Detailkonzept.md:** Datenmodell `time_entries`, `time_breaks`, Rollen.
- **arbeitszeit-portal:** Zeiterfassungs-Portal (Alle Zeiten, Log, Stammdaten); hier Standort-Anzeige ergänzen.
- **Recht:** DSGVO Art. 4, 6, 13, 35; BDSG § 26; BetrVG § 87 Abs. 1 Nr. 6.

---

*Dieses Dokument dient der Planung und rechtlichen Orientierung. Die endgültige rechtliche Bewertung und die Texte für Informationspflicht und Einwilligung obliegen dem Verantwortlichen (Auftraggeber/Arbeitgeber) ggf. unter Einbindung des Betriebsrats und eines Rechtsberaters oder Datenschutzbeauftragten.*
