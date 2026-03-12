# Arbeitszeiterfassung – Detailkonzept

**Stand:** Februar 2025  
**Basis:** Entscheidungen aus dem Fragebogen

---

## 1. Zusammenfassung der Entscheidungen

| # | Thema | Entscheidung |
|---|-------|--------------|
| 1 | Pausen-Speicherung | Separate Tabelle `time_breaks` |
| 2 | Einträge pro Tag | Mehrere Einträge möglich |
| 3 | Sichtbarkeit | Jeder eigene Zeiten; Admin/Teamleiter alle |
| 4 | Bearbeitung | Nur Admin/Teamleiter; User nicht. Grund + separates LOG |
| 5 | Pausen-Erfassung | Manuell + automatischer ArbZG-Vorschlag |
| 6 | Ansichten | Tages-, Wochen-, Monatsansicht |
| 7 | Export | Später (Roadmap Punkt 3) |
| 8 | Sichtbarkeit Modul | Lizenz + Component Settings |
| 9 | Speichern | Echtzeit (Start/Ende/Pause); explizit bei Admin-Bearbeitung |
| 10 | Zeitzone | UTC speichern, Anzeige lokal |

---

## 2. Rollen & Berechtigungen

### 2.1 Bestehende Rollen

| Rolle | Zeiterfassung |
|-------|---------------|
| **Admin** | Eigene Zeiten erfassen, alle Zeiten sehen, alle bearbeiten (mit Grund) |
| **Mitarbeiter** | Eigene Zeiten erfassen, nur eigene sehen, **nicht** nachträglich bearbeiten |
| **Operator** | Eigene Zeiten erfassen, nur eigene sehen, **nicht** nachträglich bearbeiten |
| **Leser** | Keine Zeiterfassung |
| **Demo** | Optional: eigene Zeiten (Demo-Daten) |
| **Kunde** | Keine Zeiterfassung |

### 2.2 Neue Rolle: Teamleiter

**Option für spätere Differenzierung:**
- Teamleiter sieht Zeiten seines Teams (z.B. zugewiesene Mitarbeiter)
- Teamleiter darf Zeiten seines Teams bearbeiten (mit Grund)
- Aktivierung über Lizenz oder Konfiguration

**Hinweis:** In Phase 1 kann Teamleiter = Admin behandelt werden. Rollen-Differenzierung in Phase 2.

---

## 3. Datenmodell

### 3.1 Tabelle `time_entries`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → profiles(id), NOT NULL |
| `date` | date | Arbeitstag |
| `start` | timestamptz | Startzeit |
| `end` | timestamptz | Ende (NULL = noch aktiv) |
| `notes` | text | Optional |
| `order_id` | uuid | FK → orders(id), NULL – **optional** (Vico: Auftragszuordnung) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Constraints:**
- `start` < `end` (wenn end nicht null)
- `date` = Datum von `start` (konsistent)
- **Minutengenau** (ArbZG): Keine Rundung – Speicherung auf Minute genau

### 3.2 Tabelle `time_breaks`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid | PK |
| `time_entry_id` | uuid | FK → time_entries(id) ON DELETE CASCADE |
| `start` | timestamptz | Pausenbeginn |
| `end` | timestamptz | Pausenende |
| `created_at` | timestamptz | |

**Constraints:**
- `start` < `end`
- Mindestdauer 15 Minuten (ArbZG: Pausenblöcke mind. 15 Min)

### 3.3 Tabelle `time_entry_edit_log`

Für Nachvollziehbarkeit bei Admin/Teamleiter-Bearbeitungen:

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid | PK |
| `time_entry_id` | uuid | FK → time_entries |
| `edited_by` | uuid | FK → profiles |
| `edited_at` | timestamptz | |
| `reason` | text | Grund der Änderung (Pflicht) |
| `reason_code` | text | z.B. 'korrektur', 'nachreichung', 'fehler' |
| `old_start` | timestamptz | Vorher |
| `old_end` | timestamptz | Vorher |
| `new_start` | timestamptz | Nachher |
| `new_end` | timestamptz | Nachher |

**Vordefinierte Gründe (Auswahl):**
- `korrektur` – Falsche Zeit korrigiert
- `nachreichung` – Vergessen, nachgetragen
- `fehler` – Technischer Fehler
- `sonstiges` – Mit Freitext

### 3.4 Arbeitszeitkonto (Überstunden)

**Konzept:** Saldo aus Soll-Arbeitszeit vs. Ist-Arbeitszeit.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `user_id` | uuid | FK → profiles |
| `period` | text | z.B. '2025-01' (Monat) |
| `soll_minutes` | int | Vertragliche Sollzeit |
| `ist_minutes` | int | Erfasste Ist-Zeit |
| `saldo_minutes` | int | Überstunden (+/-) |

**Option:** Entweder berechnet aus `time_entries` + `time_breaks` oder separat gepflegt. Empfehlung: Berechnung aus erfassten Zeiten; Soll pro User/Monat konfigurierbar.

**Phase:** Arbeitszeitkonto in Phase 2 (nach MVP).

---

## 4. Lizenz & Sichtbarkeit

### 4.1 Lizenz-Feature

- **Key:** `arbeitszeiterfassung`
- **Admin:** Checkbox in `admin/src/pages/Lizenz.tsx` (FEATURE_KEYS erweitern)
- **Web-App:** Route `/arbeitszeit` nur wenn `hasFeature(license, 'arbeitszeiterfassung')`

### 4.2 Component Settings

- **Key:** `arbeitszeiterfassung` (oder `arbeitszeit`)
- **DEFAULT_SETTINGS_META:** Neuer Eintrag
- **Logik:** Modul sichtbar wenn Lizenz-Feature **und** Component Setting aktiv

---

## 5. RLS (Row Level Security)

| Tabelle | Policy |
|---------|--------|
| `time_entries` | User: SELECT/INSERT eigene; Admin: SELECT/UPDATE alle. Kein DELETE (Audit) |
| `time_breaks` | Über time_entry_id; gleiche Logik wie time_entries |
| `time_entry_edit_log` | Admin: SELECT alle; User: SELECT eigene (nur Einträge die sie betreffen) |

**User darf nicht:** UPDATE/DELETE auf eigene time_entries (nachträgliche Manipulation verhindern).

**Aufbewahrung (§16 ArbZG):** Keine automatische Löschung vor 2 Jahren. Kein physisches DELETE – bei Bedarf nur Soft-Delete/Stornierung für Audit-Trail.

---

## 6. UX-Ablauf

### 6.1 Tagesansicht (Heute)

- **Start-Button:** Erstellt neuen Eintrag, `end` = NULL
- **Pause-Button:** Erstellt `time_break` für aktuellen Eintrag (Pause starten)
- **Weiter-Button:** Beendet Pause (`time_break.end` setzen)
- **Ende-Button:** Setzt `time_entry.end`
- **ArbZG-Hinweis:** Bei >6h Arbeitszeit ohne 30 Min Pause: Hinweis + Vorschlag „Pause erfassen“

### 6.2 Mehrere Einträge pro Tag

- User kann z.B. morgens 8–12 Uhr, nachmittags 14–18 Uhr erfassen
- Jeder Eintrag hat eigene Pausen (`time_breaks`)
- Gesamtarbeitszeit = Summe (Eintrag - Pausen) aller Einträge des Tages

### 6.3 Wochenansicht

- Mo–So, pro Tag: Einträge + Pausen, Summe
- Navigation: Vorherige/Nächste Woche

### 6.4 Monatsansicht

- Kalender-Grid, pro Tag: Gesamtstunden (evtl. Ampelfarbe bei Überstunden/Unterstunden)

### 6.5 Admin/Teamleiter-Ansicht

- Filter: User, Zeitraum
- Tabelle: User, Datum, Start, Ende, Pausen, Gesamt
- Bearbeiten: Klick auf Zeile → Modal mit Grund-Auswahl + Speichern

### 6.6 UX-Ergänzungen

| Feature | Beschreibung | Phase |
|---------|--------------|-------|
| **„Vergessen auszustempeln“** | In-App-Hinweis: „Du hast noch nicht Feierabend gebucht“ (z.B. nach 10 h oder 20 Uhr) | 1 |
| **Wochen-Summe** | „Diese Woche: 38,5 h“ in Wochenansicht | 1 |
| **ArbZG-Warnungen** | §3: „8 h erreicht“; §5: „11 h Ruhezeit“ (siehe 7.2, 7.3) | 1 |
| **Schnellzugriff (PWA)** | Start/Ende vom Home-Screen (PWA vorhanden) | 1 |
| **Abwesenheits-Grund** | Optional: Dienstreise, Homeoffice, Schulung (für Lücken im Kalender) | 2 |
| **Genehmigungsworkflow** | Teamleiter genehmigt Zeiten vor Abrechnung | 3 |

---

## 7. ArbZG – Gesetzliche Anforderungen

### 7.1 § 4 Pausen

| Arbeitszeit (ohne Pausen) | Mindestpause |
|---------------------------|--------------|
| ≤ 6 h | keine |
| 6–9 h | 30 Min |
| > 9 h | 45 Min |

**Umsetzung:** Beim Erfassen: Berechnung der Netto-Arbeitszeit. Hinweis wenn Pause fehlt. Vorschlag: „30 Min Pause erfassen“.

### 7.2 § 3 Höchstarbeitszeit

- Werktägliche Arbeitszeit max. 8 h (10 h mit Ausgleich über 6 Monate).
- **Umsetzung:** Hinweis „Heute bereits 8 h erfasst“ in der Tagesansicht.

### 7.3 § 5 Ruhezeit

- Mind. 11 h ununterbrochene Ruhe zwischen Schichten.
- **Umsetzung:** Warnung „Weniger als 11 h Ruhe seit letztem Feierabend“, wenn neuer Start zu früh.

### 7.4 § 16 Aufbewahrung & Überstunden

- Aufzeichnungen mind. 2 Jahre aufbewahren.
- Überstunden müssen erfasst werden.
- **Umsetzung:** Keine Löschung vor 2 Jahren; Arbeitszeitkonto (Phase 2) für Überstunden.

---

## 8. Offline & Sync

- **Cache:** `time_entries` + `time_breaks` pro User (eigene Zeiten)
- **Outbox:** Neue Einträge/Pausen bei Offline
- **Sync:** `pullFromServer` lädt time_entries; `processOutbox` schreibt Outbox
- **Echtzeit:** Start/Ende/Pause → sofort in Outbox oder DB (je nach Online-Status)

---

## 9. Phasen-Plan

### Phase 1 – MVP (5–6 T)

- [ ] Lizenz-Feature `arbeitszeiterfassung`
- [ ] Component Setting `arbeitszeiterfassung`
- [ ] Tabellen: `time_entries`, `time_breaks`
- [ ] RLS, Audit-Trigger für time_entries
- [ ] Route `/arbeitszeit`, Menüpunkt
- [ ] Tagesansicht: Start, Pause, Ende
- [ ] Manuelle Pausen (time_breaks)
- [ ] ArbZG §4-Hinweis bei >6h; §3-Hinweis bei 8h; §5-Warnung bei <11h Ruhezeit
- [ ] Minutengenau speichern (keine Rundung)
- [ ] „Vergessen auszustempeln“-Hinweis (z.B. nach 10h oder 20 Uhr)
- [ ] Wochen-Summe in Ansicht
- [ ] Offline: Cache + Outbox
- [ ] Nur eigene Zeiten sichtbar (Admin sieht alle)

### Phase 2 (2–3 T)

- [ ] `time_entry_edit_log` + Grund-Auswahl
- [ ] Admin/Teamleiter: Bearbeiten mit Grund
- [ ] Wochenansicht
- [ ] Monatsansicht
- [ ] Separates Zeiterfassungs-LOG (Übersicht Änderungen)
- [ ] Arbeitszeitkonto (Überstunden)
- [ ] Rolle Teamleiter (optional)
- [ ] Abwesenheits-Grund (optional)
- [ ] **Optional:** Auftragszuordnung (order_id) – Vico-spezifisch

### Phase 3

- [ ] Export CSV/Excel (mit Roadmap Punkt 3)
- [ ] ArbZG-Vorschlag automatisch („Pause jetzt starten?“)
- [ ] Genehmigungsworkflow

---

## 10. Technische Anknüpfungspunkte

| Bereich | Datei/Struktur |
|---------|----------------|
| Lizenz | `license.features`, `admin/.../Lizenz.tsx`, `hasFeature()` |
| Component Settings | `componentSettingsService.ts`, `DEFAULT_SETTINGS_META` |
| Routes | `App.tsx`, `Layout.tsx` (Menü) |
| Offline | `offlineStorage.ts`, `syncService.ts` |
| Audit | `audit_trigger_fn`, `audit_log` (bestehend) |

---

## 11. Optional: Vico-spezifisch – Auftragszuordnung

**Idee:** Beim Erfassen optional einen **Auftrag** auswählen (FK `order_id` in `time_entries`).

- Techniker bucht Zeit für „Auftrag #123 – Kunde XY“
- Auswertung: Stunden pro Kunde/Auftrag
- Anbindung an bestehende `orders`-Tabelle

**Phase:** Optional in Phase 2. Spalte `order_id` kann in Phase 1 bereits im Schema vorgesehen werden (NULL).

---

## 12. Weitere Aspekte

| Thema | Beschreibung |
|-------|--------------|
| **Überlappende Einträge** | Prüfung: Keine zwei aktiven Einträge gleichzeitig pro User. Bei neuem Start: offenen Eintrag automatisch beenden oder Hinweis anzeigen. |
| **DSGVO** | Zeitdaten sind personenbezogen. Zweckbindung dokumentieren. Löschkonzept: Nach 2 Jahren Aufbewahrung optional Anonymisierung/Löschung (nach Prüfung). |
| **Soll-Arbeitszeit** | Pro User/Monat konfigurierbar für Arbeitszeitkonto (z.B. 40 h/Woche). In Phase 2. |
| **Mobile** | Responsive Design – Techniker erfassen oft mobil. Touch-freundliche Buttons. |

### 12.1 Regelmäßige Sicherung (Datenverlust vermeiden)

| Ebene | Maßnahme | Beschreibung |
|-------|----------|--------------|
| **Supabase** | Automatische Backups | Supabase Free: tägliche Backups (7 Tage Aufbewahrung). Pro: Point-in-time Recovery. Prüfen, ob für Zeiterfassung ausreichend. |
| **Zusätzlich** | Geplante Export-Sicherung | GitHub Actions oder Cron: wöchentlich/monatlich Export von `time_entries` + `time_breaks` (CSV/JSON) → Supabase Storage Bucket oder extern. |
| **Admin-Export** | Manueller Backup-Export | In Einstellungen/Admin: „Zeiterfassung sichern“ – Download aller Zeiten als CSV/JSON für lokale Archivierung. |

**Empfehlung:** Supabase-Backups als Basis. Optional: GitHub Action für zusätzliche Sicherungskopie (z.B. wöchentlich) in Storage. Admin-Export für manuelle Archivierung.

---

## 13. Nächster Schritt

Nach Freigabe dieses Detailkonzepts: **Technische Umsetzung Phase 1** starten.
