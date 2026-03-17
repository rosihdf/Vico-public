# Arbeitszeit: Soll-Berechnung, Urlaub & Compliance – Planung

**Stand:** März 2025  
**Referenz:** Arbeitszeit-Rechtliche-Compliance.md

---

## 1. Soll-Berechnung

### 1.1 Konfiguration (Mandant + optional Mitarbeiter)

| Einstellung | Standard | Individuell |
|-------------|----------|-------------|
| **Bundesland** | Pro Mandant | Optional pro Mitarbeiter |
| **Arbeitstage (Mo–So)** | Pro Mandant | Optional pro Mitarbeiter |
| **Stunden pro Tag** | Pro Mandant | Optional pro Mitarbeiter |

### 1.2 Feiertage

- **Statische Tabelle** `public_holidays` (Bundesland, Datum, Jahr)
- **Button „Feiertage aktualisieren“** – API-Aufruf oder Import, aktualisiert die Tabelle
- Zeitraum: z.B. 2020–2035, jährlich erweiterbar

### 1.3 Mandantendefinierte freie Tage

- Tabelle `tenant_work_free_days` (Mandant, Datum, Typ, Bezeichnung)
- Typen: Brückentag, Betriebsferien, Betriebsausflug, Jubiläum, Trauertag, Sonstiger
- Reduzieren Arbeitstage bei Soll-Berechnung

### 1.4 Formel

**Soll = (Arbeitstage − Feiertage − betriebliche freie Tage − Urlaubstage) × Stunden pro Tag**

### 1.5 Manuelle Überschreibung

- Pro Mitarbeiter: `soll_minutes_per_month` manuell setzbar (überschreibt Berechnung)
- Wenn gesetzt: Berechnung ignoriert

---

## 2. Urlaubsverwaltung

### 2.1 Kernfunktionen

| Funktion | Beschreibung |
|----------|--------------|
| **Urlaubsanträge** | Von–bis oder Einzeltage |
| **Genehmigung** | Admin/Teamleiter genehmigt oder lehnt ab |
| **Urlaubsanspruch pro Jahr** | Konfigurierbar pro Mitarbeiter (z.B. 20–30 Tage) |
| **Resturlaub** | Übertrag, Anzeige |
| **Abwesenheitsarten** | Urlaub, Krank, Sonderurlaub, … |

### 2.2 Anbindung Soll

- Genehmigte Urlaubstage reduzieren Soll im jeweiligen Monat

---

## 3. Compliance-Empfehlungen (in Planung aufgenommen)

### 3.1 Export für Zoll-/Mindestlohnprüfung

| Punkt | Beschreibung |
|-------|--------------|
| **CSV/PDF-Export** | Zeiteinträge pro Mitarbeiter/Zeitraum (Beginn, Ende, Dauer, Pausen) |
| **Ort** | Arbeitszeitenportal, Admin-Bereich oder Haupt-App |
| **Inhalt** | `time_entries` + `time_breaks`, netto Arbeitszeit pro Tag |

### 3.2 Aufbewahrung (Retention)

| Punkt | Beschreibung |
|-------|--------------|
| **Keine automatische Löschung** | Zeiteinträge und Urlaubsdaten werden nicht automatisch gelöscht |
| **Mindestfrist** | ArbZG/MiLoG: 2 Jahre; Steuerrecht: 6–8 Jahre |
| **Empfehlung** | 8 Jahre Aufbewahrung für Prüfungssicherheit (Zoll, Finanzamt) |
| **UI-Hinweis** | In Einstellungen oder Dokumentation: „Zeiteinträge werden mind. 8 Jahre aufbewahrt“ |
| **Retention-Policy** | Optional: Konfigurierbare Mindestaufbewahrung (z.B. 2/6/8 Jahre), danach nur manuelle Löschung durch Admin |

### 3.3 Urlaubsbescheinigung bei Austritt

| Punkt | Beschreibung |
|-------|--------------|
| **§ 6 Abs. 2 BUrlG** | Bescheinigung über gewährten/abgegoltenen Urlaub im laufenden Jahr |
| **Report/PDF** | Export „Urlaub gewährt/abgegolten“ pro Mitarbeiter/Jahr |
| **Ort** | Arbeitszeitenportal oder Admin, bei Austritt auslösbar |

### 3.4 Sonn- und Feiertagsarbeit (optional)

| Punkt | Beschreibung |
|-------|--------------|
| **Ableitbar** | Aus `date` + Feiertagstabelle (wird durch Soll-Feature eingeführt) |
| **Explizites Flag** | Optional: `is_sunday` / `is_holiday` pro Eintrag, wenn Prüfer es wünschen |

### 3.5 Aufzeichnung bis 7. Tag (MiLoG § 17)

| Punkt | Beschreibung |
|-------|--------------|
| **Keine technische Prüfung** | System erzwingt nicht die 7-Tage-Frist |
| **Prozess/UI-Hinweis** | Hinweis in Zeiterfassung: „Einträge bitte spätestens bis 7 Tage nach dem Arbeitstag erfassen“ |

---

## 4. Datenmodell (Überblick)

| Tabelle/Objekt | Zweck |
|----------------|-------|
| `public_holidays` | Feiertage pro Bundesland/Jahr |
| `tenant_work_free_days` | Mandantendefinierte freie Tage |
| `tenant_settings` / Erweiterung | Bundesland, Arbeitstage, Std/Tag (Mandant) |
| `profiles` Erweiterung | Bundesland, Arbeitstage, Std/Tag (optional pro Mitarbeiter) |
| `leave_requests` | Urlaubsanträge (Mitarbeiter, von, bis, Art, Status) |
| `leave_entitlements` | Urlaubsanspruch pro Jahr/Mitarbeiter |

---

## 5. Implementierungsreihenfolge (Vorschlag)

1. **Phase 1: Soll-Berechnung**
   - Feiertagstabelle + Button „Feiertage aktualisieren“
   - Mandant-Einstellungen (Bundesland, Arbeitstage, Std/Tag)
   - Mitarbeiter-Override (optional)
   - Mandantendefinierte freie Tage
   - Soll-Formel in Haupt-App/Portal

2. **Phase 2: Urlaubsverwaltung**
   - Abwesenheitsarten
   - Urlaubsanträge, Genehmigung
   - Urlaubsanspruch, Resturlaub
   - Anbindung an Soll (Urlaub reduziert Soll)

3. **Phase 3: Compliance**
   - Export für Zollprüfung (CSV/PDF)
   - Aufbewahrungs-Hinweis in UI/Dokumentation
   - Urlaubsbescheinigung bei Austritt (Report/PDF)
   - Optional: Hinweis „Aufzeichnung bis 7. Tag“
