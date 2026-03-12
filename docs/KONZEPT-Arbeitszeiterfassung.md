# Konzept: Arbeitszeiterfassung (Roadmap Punkt 7)

**Stand:** Februar 2025  
**Aufwand:** 5–8 Tage (geschätzt)

---

## 1. Ziel und Kontext

Das Modul **Arbeitszeiterfassung** soll Technikern ermöglichen, Arbeitszeiten (Start/Ende, Pausen) zu erfassen. Es wird als **Lizenzmodul** aktiviert und nutzt die bestehende Infrastruktur (Lizenz-Features, Component Settings, Offline/Outbox).

### Bestehende Infrastruktur (relevant)

| Bereich | Aktuell |
|--------|---------|
| **Lizenz** | `license.features` (JSONB), z.B. `kundenportal`, `historie` |
| **Admin** | `admin/src/pages/Lizenz.tsx` – Feature-Checkboxen |
| **Web-App** | `hasFeature(license, 'xyz')` – Feature-Check |
| **Component Settings** | Ein-/Ausblenden von Menüpunkten (z.B. Dashboard, Kunden) |
| **Offline** | Outbox-Pattern für Wartungsprotokolle, Fotos, E-Mails |

---

## 2. ArbZG § 4 – Pausenregelung (Rechtlicher Rahmen)

| Arbeitszeit | Mindestpause |
|-------------|--------------|
| ≤ 6 Stunden | keine |
| 6–9 Stunden | 30 Minuten |
| > 9 Stunden | 45 Minuten |

**Weitere Regeln:**
- Pausen müssen im Voraus feststehen
- Pausen können in Abschnitte von mind. 15 Minuten aufgeteilt werden
- Pausen zählen nicht zur Arbeitszeit und werden daher in der Regel nicht vergütet

---

## 3. Technische Architektur (Vorschlag)

### 3.1 Datenmodell

**Tabelle `time_entries`**

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → profiles(id) |
| `date` | date | Arbeitstag |
| `start` | timestamptz | Start |
| `end` | timestamptz | Ende (oder null) |
| `break_minutes` | int | Pause in Minuten |
| `notes` | text | optional |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Optional: `time_breaks`** (für detaillierte Pausen)

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid | PK |
| `time_entry_id` | uuid | FK |
| `start` | timestamptz | Pausenbeginn |
| `end` | timestamptz | Pausenende |

**Frage:** Sollen Pausen als einzelne Zeitblöcke (`time_breaks`) oder nur als Gesamtzahl (`break_minutes`) gespeichert werden?

- **Nur `break_minutes`:** Einfacher, weniger Flexibilität
- **`time_breaks`:** ArbZG-konform („im Voraus feststehend“), bessere Nachvollziehbarkeit, mehr Aufwand

### 3.2 Lizenz & Sichtbarkeit

- **Feature:** `arbeitszeiterfassung` in `license.features`
- **Admin:** Checkbox „Arbeitszeiterfassung“ in Lizenz-Seite
- **Web-App:** Route `/arbeitszeit` nur sichtbar, wenn `hasFeature(license, 'arbeitszeiterfassung')`
- **Component Settings:** Optional zusätzlicher Schalter „Arbeitszeiterfassung“ (für Ein-/Ausblenden pro Mandant)

**Frage:** Soll die Sichtbarkeit nur über die Lizenz laufen oder zusätzlich über Component Settings (wie bei anderen Modulen)?

### 3.3 Rollen & Berechtigungen

- **Wer darf erfassen?** Nur eigene Zeiten oder auch fremde?
- **Wer darf sehen?** Nur eigene Zeiten oder auch Admin/Teamleiter?

**Vorschlag:** Jeder User erfasst nur seine eigenen Zeiten. Admin sieht alle Zeiten (für Auswertung/Export).

**Frage:** Sollen Admins/Teamleiter alle Zeiten sehen oder nur die eigenen?

### 3.4 Offline & Outbox

- **Cache:** `time_entries` pro User im Cache
- **Outbox:** Neue/geänderte Einträge bei Offline in Outbox
- **Sync:** Bei Online: Outbox → DB, `pullFromServer` lädt `time_entries`

**Frage:** Sollen Zeiteinträge in Echtzeit gespeichert werden (z.B. bei jeder Änderung) oder nur bei explizitem „Speichern“?

---

## 4. UX-Ablauf (Vorschlag)

### 4.1 Tagesansicht

- **Heute:** Start-Button, Pause-Button, Ende-Button
- **Liste:** Heutige Einträge mit Start, Ende, Pause, Gesamtzeit
- **Bearbeitung:** Start/Ende/Pause nachträglich änderbar (bis zum Abschluss des Tages)

### 4.2 Pausen-Erfassung

**Option A – Manuell:** User klickt „Pause starten“ / „Pause beenden“  
**Option B – Automatisch (ArbZG § 4):** System schlägt bei > 6 h Arbeitszeit 30 Min Pause vor

**Frage:** Manuell, automatisch oder beides (mit Vorschlag)?

### 4.3 Kalenderansicht

- **Wochenansicht:** Mo–So mit Tageszeiten
- **Monatsansicht:** Optional, Übersicht

**Frage:** Reicht eine Tages-/Listenansicht oder soll es auch Wochen-/Monatsansicht geben?

### 4.4 Export

- **Export:** CSV/Excel für Buchhaltung/Abrechnung
- **Zeitraum:** Woche, Monat, frei wählbar

**Frage:** Export in Phase 1 oder erst später (Roadmap Punkt 3 „Export für Buchhaltung“)?

---

## 5. Offene Fragen (Zusammenfassung)

### 5.1 Datenmodell

1. **Pausen:** Nur `break_minutes` oder separate Tabelle `time_breaks`?
2. **Mehrere Einträge pro Tag:** Ein Eintrag pro Tag (Start–Ende) oder mehrere (z.B. morgens + nachmittags)?

### 5.2 Berechtigungen

3. **Sichtbarkeit:** Nur eigene Zeiten oder auch Admin/Teamleiter?
4. **Bearbeitung:** Nur eigene Einträge oder auch Admin/Teamleiter?

### 5.3 UX

5. **Pausen:** Manuell, automatisch (ArbZG § 4) oder beides?
6. **Ansicht:** Nur Tages-/Listenansicht oder auch Wochen-/Monatsansicht?
7. **Export:** In Phase 1 oder später?

### 5.4 Lizenz & Sichtbarkeit

8. **Sichtbarkeit:** Nur Lizenz-Feature oder zusätzlich Component Settings?

### 5.5 Technische Details

9. **Speichern:** Echtzeit oder bei explizitem „Speichern“?
10. **Zeitzone:** Immer lokale Zeit des Users oder UTC mit Konvertierung?

---

## 6. Phasen-Vorschlag

### Phase 1 (MVP, 4–5 T)

- Lizenz-Feature `arbeitszeiterfassung`
- Tabelle `time_entries` (minimal: user_id, date, start, end, break_minutes)
- Route `/arbeitszeit`, RLS
- Tagesansicht: Start, Pause, Ende
- Manuelle Pausen-Erfassung
- Offline: Cache + Outbox

### Phase 2 (optional, 2–3 T)

- Admin-Sicht auf alle Zeiten
- Wochenansicht
- ArbZG-Hinweise (Pausen-Vorschlag)
- Export (CSV)

### Phase 3 (optional)

- `time_breaks` für detaillierte Pausen
- Monatsansicht
- Integration mit Buchhaltungs-Export (Roadmap Punkt 3)

---

## 7. Nächste Schritte

1. **Fragen klären** (siehe Abschnitt 5)
2. **Datenmodell finalisieren**
3. **Schema & RLS** in `supabase-complete.sql` ergänzen
4. **Implementierung** Phase 1 starten
