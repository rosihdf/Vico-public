# Offene Module & Vorschläge – Übersicht

**Stand:** März 2025  
**Quellen:** Vico.md Roadmap, Noch-zu-erledigen, Zeiterfassung-Offene-Punkte, Entscheidungen-Offene-Punkte

---

## Kurzüberblick

| Kategorie | Anzahl | Aufwand gesamt |
|-----------|--------|----------------|
| **Wartung & Auswertung** | 5 Module | 26–36 T |
| **UX & Produktivität** | 4 Module | 6–9 T |
| **Zeiterfassung** | 6 Module | 8–15 T |
| **Sicherheit & Betrieb** | 4 Module | 5–9 T |
| **Infrastruktur** | 2 Module | 1–2 T |

---

## 1. Wartung & Auswertung

### J1 – Wartungsplanung / Erinnerungen
| | |
|---|---|
| **Beschreibung** | Erinnerungen z. B. 30 Tage vor Fälligkeit; optional E-Mail an Techniker oder Kunden |
| **Aufwand** | 3–5 T |
| **Priorität** | Hoch |
| **Status** | Teilweise: Erinnerungsliste & „due_soon“ vorhanden, **E-Mail-Benachrichtigung fehlt** |

### J2 – Wartungsstatistik / Auswertung
| | |
|---|---|
| **Beschreibung** | Wartungen pro Kunde/BV/Objekt, Auslastung, überfällige Wartungen, Auswertungs-Dashboard |
| **Aufwand** | 3–4 T |
| **Priorität** | Hoch |

### J3 – Export für Buchhaltung
| | |
|---|---|
| **Beschreibung** | CSV/Excel-Export für Abrechnung (Wartungen, Aufträge, Zeiten) |
| **Aufwand** | 2–3 T |
| **Priorität** | Hoch |

### J6 – Umbau Wartung (MVP)
| | |
|---|---|
| **Beschreibung** | Auftrag → Monteursbericht → Freigabe → Kundenportal. Phasen: Freigabe-Workflow, Portal-Integration, Buchhaltungs-Export |
| **Aufwand** | 15–20 T (Rest nach order_completions) |
| **Priorität** | Hoch |
| **Status** | Teilweise: Monteursbericht, Unterschriften vorhanden; **Freigabe-Workflow & Portal-Integration offen** |

### J7 – Mängel-Follow-up
| | |
|---|---|
| **Beschreibung** | Offene Mängel tracken, Status offen/behoben, Nachverfolgung |
| **Aufwand** | 3 T |
| **Priorität** | Mittel |

---

## 2. UX & Produktivität

### J4 – Schnellzugriff / Zuletzt bearbeitet
| | |
|---|---|
| **Beschreibung** | Zuletzt bearbeitete Kunden/Objekte auf der Startseite – schneller Zugriff für häufige Arbeit |
| **Aufwand** | 1–2 T |
| **Priorität** | Hoch |

### J5 – Erweiterte Filter Kundenliste
| | |
|---|---|
| **Beschreibung** | Filter nach PLZ, Wartungsstatus, BV-Anzahl – bessere Übersicht bei vielen Kunden |
| **Aufwand** | 2 T |
| **Priorität** | Hoch |

### J7 – Kalender-Sync (iCal)
| | |
|---|---|
| **Beschreibung** | Aufträge als iCal/Google-Kalender exportieren – Integration in bestehende Kalender-Apps |
| **Aufwand** | 2–3 T |
| **Priorität** | Mittel |

### J7 – Bulk-Operationen
| | |
|---|---|
| **Beschreibung** | Mehrere Objekte/Kunden gleichzeitig bearbeiten (z. B. Status ändern, löschen) |
| **Aufwand** | 3 T |
| **Priorität** | Niedrig |

---

## 3. Zeiterfassung

### Auftragszuordnung
| | |
|---|---|
| **Beschreibung** | Technisch umgesetzt, UI ausgeblendet. **Entscheidung:** Einblenden oder Code entfernen |
| **Aufwand** | 0,5 T |
| **Priorität** | Vor Release |

### Abwesenheits-Grund
| | |
|---|---|
| **Beschreibung** | Optionaler Grund für Tage ohne Erfassung (Dienstreise, Homeoffice, Schulung) |
| **Aufwand** | 1–2 T |
| **Priorität** | Optional |

### Zeiterfassung Export CSV/Excel
| | |
|---|---|
| **Beschreibung** | Zeiterfassung für Buchhaltung exportieren (Buchhaltung, Admin) |
| **Aufwand** | 1–2 T |
| **Priorität** | Optional |

### ArbZG-Erweiterungen
| | |
|---|---|
| **Beschreibung** | 45-Min-Pause bei >9 h; „Pause jetzt starten?“ bei >6 h ohne Pause; Überlappende Einträge prüfen |
| **Aufwand** | 1–2 T |
| **Priorität** | Optional |

### Genehmigungsworkflow
| | |
|---|---|
| **Beschreibung** | Teamleiter/Admin genehmigt Zeiten vor Abrechnung |
| **Aufwand** | 3–4 T |
| **Priorität** | Optional |

### Admin-Export „Zeiterfassung sichern“
| | |
|---|---|
| **Beschreibung** | Manueller Download aller Zeiten als CSV/JSON für Archivierung |
| **Aufwand** | 0,5–1 T |
| **Priorität** | Optional |

### Ortung (GPS)
| | |
|---|---|
| **Beschreibung** | Standort bei Start/Ende erfassen; Einwilligung + Informationspflicht (DSGVO); Anzeige im Zeiterfassungs-Portal |
| **Aufwand** | 3–5 T |
| **Priorität** | Geplant |
| **Referenz** | docs/Zeiterfassung-Ortung-GPS-Recht-und-Planung.md |

### Rolle Teamleiter
| | |
|---|---|
| **Beschreibung** | Eigene Rolle „teamleiter“: sieht/bearbeitet nur Zeiten des zugewiesenen Teams |
| **Aufwand** | 2–3 T |
| **Priorität** | Optional |

---

## 4. Sicherheit & Betrieb

### J9 – Ladezeiten-Monitoring / Performance-Dashboard
| | |
|---|---|
| **Beschreibung** | Sync- und Startseiten-Ladezeiten grafisch anzeigen (Admin); Verlauf Batch1/Batch2/Gesamt |
| **Aufwand** | 1–2 T |
| **Priorität** | Niedrig |
| **Status** | Messung in Konsole vorhanden; **grafisches Dashboard fehlt** |

### J10 – Bug-Erfassungsmodul
| | |
|---|---|
| **Beschreibung** | Automatische Erfassung von JS-Fehlern (onerror, unhandledrejection, ErrorBoundary) und Speicherung in DB; Admin-Ansicht „Fehlerberichte“ |
| **Aufwand** | 1–2 T |
| **Priorität** | Niedrig |
| **Status** | ✅ Implementiert |

### 2FA – Zwei-Faktor-Authentifizierung
| | |
|---|---|
| **Beschreibung** | TOTP für Admin (Lizenzportal + App). Supabase MFA nativ unterstützt |
| **Aufwand** | 2–3 T |
| **Priorität** | Mittel |
| **Status** | ✅ Implementiert |

### Wartungs-Checkliste pro Objekttyp
| | |
|---|---|
| **Beschreibung** | Vordefinierte Checklisten je Tür-/Tortyp (DIN 14677, ASR A1.7) |
| **Aufwand** | 3–4 T |
| **Priorität** | Mittel |

---

## 5. Mobile & Hardware

### I2 – Bluetooth-Drucker-Plugin
| | |
|---|---|
| **Beschreibung** | QR-Etikettendruck aus der App auf Bluetooth-Drucker (Zebra, Brother, Bixolon). Capacitor-Plugin erforderlich |
| **Aufwand** | 1–2 T |
| **Priorität** | Optional |
| **Referenz** | docs/Etikettendrucker-Planung.md |

### Portal: Push-Benachrichtigungen
| | |
|---|---|
| **Beschreibung** | Kunden bei neuem Wartungsbericht informieren (Web Push oder E-Mail) |
| **Aufwand** | 2–3 T |
| **Priorität** | Niedrig |

---

## 6. Infrastruktur & Sonstiges

### Stammdaten bearbeiten
| | |
|---|---|
| **Beschreibung** | Bearbeiten-Button für Stammdaten/Impressum in Einstellungen (aktuell nur Anzeige) |
| **Aufwand** | 1–2 T |
| **Priorität** | Mittel |

### Speicherkontingent – automatische Ermittlung
| | |
|---|---|
| **Beschreibung** | Verfügbares Speicherkontingent aus DB/Storage-API auslesen (statt manuell) |
| **Aufwand** | 1–2 T |
| **Priorität** | Auf IONOS-Umzug verschoben. Siehe docs/Entscheidungen-Offene-Punkte.md §11 |

### IONOS Deploy
| | |
|---|---|
| **Beschreibung** | Frontend (Haupt-App, Admin, Portal, Arbeitszeitenportal) per Deploy Now + GitHub |
| **Aufwand** | 3–5 T |
| **Priorität** | Operativ |

---

## Empfohlene Reihenfolge (Quick Wins zuerst)

| # | Modul | Aufwand | Nutzen |
|---|-------|---------|--------|
| 1 | **J4 – Schnellzugriff** | 1–2 T | Sofort spürbarer Arbeitsfluss |
| 2 | **Auftragszuordnung** | 0,5 T | Klare Entscheidung vor Release |
| 3 | **J3 – Export Buchhaltung** | 2–3 T | Oft betrieblich erforderlich |
| 4 | **J5 – Erweiterte Filter** | 2 T | Bessere Übersicht bei vielen Kunden |
| 5 | **J9 – Performance-Dashboard** | 1–2 T | Flaschenhälse auf einen Blick |
| 6 | **J1 – E-Mail bei Erinnerungen** | 1–2 T | Ergänzung zu bestehender Erinnerungsliste |
| 7 | **J2 – Wartungsstatistik** | 3–4 T | Auswertung pro Kunde/BV/Objekt |
| 8 | **Stammdaten bearbeiten** | 1–2 T | Self-Service für Mandanten |

---

## Module nach Aufwand (Klein → Groß)

| Aufwand | Module |
|---------|--------|
| **0,5–1 T** | Auftragszuordnung, Admin-Export Zeiterfassung |
| **1–2 T** | J4 Schnellzugriff, J9 Performance-Dashboard, Stammdaten bearbeiten, J1 E-Mail-Ergänzung |
| **2–3 T** | J3 Export Buchhaltung, J5 Filter, J7 Kalender-Sync, Zeiterfassung Export |
| **3–4 T** | J2 Wartungsstatistik, J7 Mängel-Follow-up, J7 Bulk-Operationen, Wartungs-Checkliste, Genehmigungsworkflow |
| **3–5 T** | J1 Wartungsplanung (vollständig), Portal Push |
| **15–20 T** | J6 Umbau Wartung (Rest) |

---

*Bei Änderungswunsch: Eintrag hier und in der Referenzdatei anpassen.*
