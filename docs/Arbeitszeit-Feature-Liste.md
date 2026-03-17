# Arbeitszeiterfassung – Feature-Liste

**Stand:** März 2025  
**Zweck:** Übersicht aller geplanten und optionalen Features. Priorität bestimmt Reihenfolge; spätere Entscheidung über zusätzliche Realisierung.

---

## Priorität: Hoch (empfohlene Reihenfolge)

| Nr | Feature | Beschreibung | Status |
|----|---------|--------------|--------|
| 1 | **ArbZG-Vorschlag automatisch** | Bei >6 h ohne Pause: „Pause jetzt starten?“ anzeigen | ✅ Erledigt |
| 2 | **Genehmigungsworkflow** | Teamleiter/Admin genehmigt Zeiten vor Abrechnung | ✅ Erledigt |
| 3 | **Export CSV/Excel** | Zeiteinträge für Buchhaltung exportieren | ✅ Erledigt |
| 4 | **„Vergessen auszustempeln“-Erinnerung** | Nach X Stunden ohne Ende: Hinweis oder Push-Benachrichtigung | ✅ Erledigt |
| 5 | **Pausen-Mindestdauer 15 Min** | Pausenblöcke mind. 15 Min (ArbZG) – Validierung beim Speichern | ✅ Erledigt |

---

## Priorität: Mittel

### ArbZG & Compliance

| Feature | Beschreibung |
|---------|--------------|
| **Überlappende Einträge verhindern** | Kein zweiter aktiver Eintrag; bei neuem Start Hinweis oder automatisch beenden |
| **Wochenhöchstgrenze 48 h** | Hinweis bei Überschreitung von 48 h/Woche (ArbZG §3) |
| **Sonn-/Feiertagsarbeit markieren** | Einträge an Sonn-/Feiertagen kennzeichnen (für Zollprüfung) |

### UX & Alltag

| Feature | Beschreibung |
|---------|--------------|
| **Schnellzugriff PWA** | Start/Ende direkt vom Home-Screen (ohne App öffnen) |
| **Offline-Stempeln** | Stempeln ohne Internet, Sync bei Verbindung |
| **Rundung** | Optional: Zeiten auf 5/15 Min runden (für Vertrauensarbeitszeit) |
| **Vorausfüllung** | Start/Ende aus letztem Tag vorschlagen |

### Genehmigung & Workflow

| Feature | Beschreibung |
|---------|--------------|
| **Status pro Eintrag** | Entwurf, eingereicht, genehmigt, abgelehnt |
| **Sammel-Freigabe** | Alle Zeiten einer Woche/Monats auf einmal freigeben |
| **Erinnerung an Freigabe** | Hinweis für Teamleiter bei offenen Zeiten |

### Auswertung & Export

| Feature | Beschreibung |
|---------|--------------|
| **Export für Zollprüfung** | Formatiert für MiLoG-Prüfung (in Soll-Planung) |
| **Monatsübersicht PDF** | Zusammenfassung pro Mitarbeiter/Monat als PDF |
| **Überstunden-Report** | Überstunden pro Mitarbeiter/Zeitraum |

### Arbeitszeitkonto & Saldo

| Feature | Beschreibung |
|---------|--------------|
| **Jahres-Saldo** | Übertrag von Vorjahr, Jahresbilanz |
| **Überstunden-Abbau** | Geplante Abbauzeiten erfassen |

### Projekt/Auftrag

| Feature | Beschreibung |
|---------|--------------|
| **Zeit pro Auftrag/Kunde** | Stempeln mit Auftragszuordnung (Schema vorhanden) |

### Integration

| Feature | Beschreibung |
|---------|--------------|
| **iCal-Export** | Arbeitszeiten als Kalenderfeed |

### Admin

| Feature | Beschreibung |
|---------|--------------|
| **Massenbearbeitung** | Mehrere Einträge gleichzeitig bearbeiten |
| **Stornierung statt Löschen** | Einträge stornieren, für Audit behalten |

---

## Priorität: Niedrig

| Feature | Beschreibung |
|---------|--------------|
| **Tastatur-Shortcuts** | z.B. S = Start, E = Ende, P = Pause |
| **Jahresübersicht AZK** | Saldo-Verlauf über 12 Monate |
| **Gleitzeit-Fenster** | Kernzeit vs. Gleitzeit visualisieren |
| **Zeit pro Tätigkeit** | z.B. Verwaltung, Montage, Schulung |
| **Outlook/Google-Kalender** | Abgleich mit Kalender |
| **Import** | Zeiteinträge aus CSV/Excel importieren |

---

## Bereits umgesetzt

| Feature | Beschreibung |
|---------|--------------|
| Start/Ende/Pause | Tagesansicht, Stempeln |
| ArbZG §3/§4/§5 | Hinweise 8h, Pause 6h/9h, Ruhezeit 11h |
| Soll/Ist/Saldo | Monat (mit manueller Überschreibung) |
| Arbeitszeitenportal | Alle Zeiten, Log, Stammdaten, Bearbeiten |
| Audit-Log | Änderungen protokolliert |
| GPS-Ortung | Optional bei Stempeln |
