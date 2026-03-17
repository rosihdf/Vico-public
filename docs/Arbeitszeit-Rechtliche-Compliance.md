# Arbeitszeit & Urlaub – Rechtliche Compliance

**Stand:** März 2025  
**Zweck:** Prüfung der geplanten Soll-Berechnung, Urlaubsverwaltung und Zeiterfassung gegen ArbZG, MiLoG, BUrlG, Zollprüfungen und Steuerrecht.

---

## 1. Zeiterfassung (ArbZG, MiLoG, Zoll)

### Gesetzliche Anforderungen

| Anforderung | Quelle | Vico-Status |
|-------------|--------|-------------|
| **Beginn** der täglichen Arbeitszeit | ArbZG § 16, MiLoG § 17, EuGH 2019 | ✅ `time_entries.start` |
| **Ende** der Arbeitszeit | ArbZG § 16, MiLoG § 17 | ✅ `time_entries.end` |
| **Dauer** (ohne Pausen) | MiLoG § 17 | ✅ Berechenbar aus `time_entries` + `time_breaks` |
| **Überstunden** (> 8 h/Tag) | ArbZG | ✅ Ableitbar aus Ist vs. Soll |
| **Sonn- und Feiertagsarbeit** | ArbZG § 16 | ⚠️ Ableitbar aus `date` + Feiertagstabelle, aber nicht explizit markiert |
| **Aufzeichnung bis 7. Tag** | MiLoG § 17 | ⚠️ Keine technische Prüfung – Prozess/UI-Hinweis |
| **Aufbewahrung 2 Jahre** | ArbZG § 16 Abs. 2, MiLoG § 17 | ⚠️ Keine automatische Löschung – DB behält Daten |
| **Aufbewahrung 6–8 Jahre** | Steuerrecht (Lohnunterlagen) | ⚠️ Empfehlung: 8 Jahre für Prüfungssicherheit |
| **Unveränderbarkeit** (Audit) | Zollprüfung | ✅ `audit_log` + `time_entry_edit_log` protokollieren Änderungen |
| **Deutsche Sprache** | MiLoG § 17 | ✅ UI auf Deutsch |

### Empfehlungen für Zoll-/Mindestlohnprüfung

1. **Sonn- und Feiertagsarbeit** – optionales Flag `is_sunday` / `is_holiday` pro Eintrag oder ableitbar aus `date` + Feiertagstabelle (wird durch Soll-Feature ohnehin eingeführt).
2. **Export für Prüfer** – CSV/PDF-Export der Zeiteinträge pro Mitarbeiter/Zeitraum für Zollprüfungen.
3. **Aufbewahrungsfrist** – Dokumentieren, dass keine automatische Löschung erfolgt; ggf. Retention-Policy (z.B. „mind. 8 Jahre“) in AGB/Dokumentation.

---

## 2. Urlaub (BUrlG)

### Gesetzliche Anforderungen

| Anforderung | Quelle | Geplantes Feature |
|-------------|--------|-------------------|
| **Urlaubsanträge** mit von–bis / Einzeltagen | BUrlG | ✅ Urlaubsverwaltung |
| **Genehmigung** durch Vorgesetzten | BUrlG, Praxis | ✅ Admin/Teamleiter |
| **Urlaubsanspruch pro Jahr** | § 3 BUrlG (mind. 20 Tage bei 5-Tage-Woche) | ✅ Urlaubsanspruch |
| **Resturlaub** / Übertrag | § 7 BUrlG | ✅ Resturlaub |
| **Abgeltung bei Beendigung** | § 7 Abs. 4 BUrlG | ⚠️ Urlaubsbescheinigung bei Austritt – ggf. Export/Report |
| **Bescheinigung** bei Austritt | § 6 Abs. 2 BUrlG | ⚠️ Report „Urlaub gewährt/abgegolten“ pro Jahr – ggf. PDF-Export |

### Urlaubsentgelt (§ 11 BUrlG)

- Bemessung: Durchschnitt der letzten 13 Wochen vor Urlaubsbeginn.
- **Nicht** in Vico abbildbar (Lohndaten fehlen) – das bleibt Aufgabe der Lohnbuchhaltung.
- Vico liefert: **Urlaubstage** und **Abwesenheitsarten** für Soll-Berechnung und Dokumentation.

---

## 3. Soll-Berechnung (geplant)

### Rechtliche Einordnung

- **Kein direktes Gesetz** für „Soll-Stunden“ – betriebliche/vertragliche Regelung.
- **ArbZG** begrenzt Höchstarbeitszeit (8 h/Tag, 48 h/Woche) – Soll darf diese nicht überschreiten.
- **Feiertage** – ArbZG § 9: An gesetzlichen Feiertagen keine Arbeitspflicht → korrekt, Feiertage nicht als Arbeitstage zählen.
- **Betriebsferien / Brückentage** – betriebliche Festlegung → korrekt, als freie Tage behandelbar.
- **Urlaub** – BUrlG: Urlaubstage sind keine Arbeitstage → korrekt, Urlaub reduziert Soll.

### Compliance-Check Soll-Formel

| Element | Rechtlich | Umsetzung |
|---------|-----------|-----------|
| Arbeitstage (Mo–So) | Vertraglich/Betrieblich | ✅ Konfigurierbar |
| Feiertage (Bundesland) | ArbZG, landesrechtlich | ✅ Statische Tabelle |
| Betriebliche freie Tage | Betriebsvereinbarung | ✅ `tenant_work_free_days` |
| Urlaub | BUrlG | ✅ Urlaubsverwaltung |
| Stunden pro Tag | Vertraglich | ✅ Konfigurierbar |

---

## 4. Abwesenheitsarten

| Art | Rechtlich | Soll-Reduktion |
|----|-----------|----------------|
| **Urlaub** | BUrlG | ✅ Ja |
| **Krank** | EntgeltfortzahlungsG | ✅ Ja (kein Arbeitstag) |
| **Sonderurlaub** | Tarif/Arbeitsvertrag | ✅ Ja |
| **Unentschuldigte Abwesenheit** | – | ❌ Nein (Soll bleibt) |
| **Dienstreise** | – | ⚠️ Konfigurierbar (Arbeitstag, aber keine Zeiterfassung vor Ort) |

---

## 5. Zusammenfassung & offene Punkte

### Bereits erfüllt (Vico heute)

- Beginn, Ende, Dauer der Arbeitszeit
- Pausen getrennt erfasst
- Audit-Log für Änderungen
- Datum pro Eintrag (Sonn-/Feiertag ableitbar)

### Mit Soll/Urlaub-Feature abgedeckt

- Feiertage pro Bundesland
- Betriebliche freie Tage
- Urlaub reduziert Soll
- Abwesenheitsarten (Urlaub, Krank, Sonderurlaub)

### In Planung aufgenommen (siehe Arbeitszeit-Soll-Urlaub-Planung.md)

- **Export für Zollprüfung** – CSV/PDF der Zeiteinträge (Phase 3)
- **Urlaubsbescheinigung bei Austritt** – Report/PDF (Phase 3)
- **Aufbewahrung** – Keine automatische Löschung; UI-Hinweis „mind. 8 Jahre“; optional konfigurierbare Retention-Policy (Phase 3)
- **Explizites Flag** für Sonn-/Feiertagsarbeit – optional, wenn Prüfer es wünschen
- **Hinweis Aufzeichnung bis 7. Tag** – Prozess/UI (Phase 3)

---

## 6. Quellen

- ArbZG (Arbeitszeitgesetz) § 16
- MiLoG (Mindestlohngesetz) § 17
- BUrlG (Bundesurlaubsgesetz) §§ 3, 6, 7, 11
- EuGH-Urteil 14.05.2019 (C-55/18)
- BAG-Urteil 13.09.2022
- Zoll: Mindestlohnsonderprüfungen, Aufzeichnungspflichten
