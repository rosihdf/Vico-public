# Chat-Backup: Wartungsplanung (2026-04-02)

Zweck:
- Fallback-Dokument für die in diesem Chat gestartete Planung.
- Zentraler Verweis auf die abgestimmten Punkte und Entscheidungen.

## Ausgangswunsch (User)

- Nächste Punkte für die Planung immer in `Vico.md` aufnehmen.
- Eine Backup-Datei für den Chat-Verlauf anlegen.
- Rückfragen nacheinander stellen (jeweils mit Antwortvorschlägen + Empfehlung).
- Themen:
  - Wartungsseite im LP für Wartungsmodus und Datenverlust-Minimierung
  - `Wartungsprotokolle` in `Prüfbericht` umbenennen
  - Prüfbericht nur Monteur-Signatur
  - Monteurbericht Monteur + Kunden-Signatur
  - Feststellanlagen-Checkliste in die Checkliste integrieren (nur bei Türen mit Feststellanlage)
  - `Feststellanlage Wartung nach Herstellerangaben` entfernen
  - `Wartung nach Herstellervorgabe` entfernen
  - Funktion prüfen: Fotos je Mangel
  - Punkt `Sicherheit` aus Einstellungen entfernen

## Bereits dokumentiert in `Vico.md`

- Abschnitt `11.13 Planungspunkte (Stand 2026-04-02) + Rückfragenprozess`

## Offene Entscheidungsfragen (sequenziell)

1. Wartungsseite im LP: Scope und Verhalten im Wartungsmodus. ✅
2. Umbenennung auf `Prüfbericht`: nur UI oder auch DB/API-Feldnamen.
3. Signaturregeln pro Dokument (rechtlich/fachlich verbindlich).
4. Checklisten-Fusion inkl. Sichtbarkeitslogik bei Feststellanlage.
5. Entfernen der Herstellerangaben-Punkte (Alt-Daten, Migration).
6. Mangel-Fotos: Speicherort, Limits, Offline-Verhalten, PDF/Portal-Ausgabe.
7. Entfernen `Sicherheit` in Einstellungen (vollständig vs. versteckt).

## Hinweis

Dieses Backup enthält die inhaltlichen Chat-Punkte für den Fallback.
Die endgültigen Entscheidungen werden Schritt für Schritt ergänzt.

## Entscheidungen (laufend)

- Q1: Option **B** bestätigt  
  Echter Wartungsmodus im LP mit serverseitiger Schreibsperre (Admin-Bypass optional).
- Q2: Option **A** bestätigt  
  Umbenennung auf „Prüfbericht“ nur in UI-Texten; technische Namen und DB-Schema bleiben.
- Q3: Option **B** bestätigt  
  Prüfbericht nur Monteur verpflichtend; Monteurbericht Monteur verpflichtend und Kunde optional mit Grund (`nicht anwesend` / `Unterschrift abgelehnt`).
- Q4: Variante **A** bestätigt  
  Eine gemeinsame Checkliste; Feststellanlagen-Punkte werden nur angezeigt, wenn die Tür eine Feststellanlage hat (`has_hold_open=true`).

### Ist-Stand Compact-Modus (Prüfung)

- Vorhanden in DB/Backend:
  - `monteur_report_settings.wartung_checkliste_modus` (`compact` / `detail`)
  - SQL-Constraint + Default in `supabase-complete.sql`
  - Auswertung im Code (u. a. `dataService`, `Auftragsdetail`, Kataloge/PDF)
- Aktuell keine aktive UI-Steuerung in `Einstellungen.tsx` sichtbar.

- Q5: Option **C** bestätigt  
  Compact/Detail-Steuerung als globaler Default in `Einstellungen` plus optionaler Override in `Auftragsdetail`.
- Q6: Option **A** bestätigt  
  Herstellerangaben-Punkte aus UI/Neuanlage entfernen; Alt-Daten historisch lesbar belassen.
- Q7: Option **B** bestätigt  
  Mangel-Fotos über eigene relationale Tabelle, initial max. 3 Fotos pro Mangel.
- Q8: Option **A** bestätigt  
  Fotos im Prüfbericht direkt unter dem jeweiligen Mangelpunkt.
- Q9: Option **B** bestätigt  
  `Sicherheit` aus `Einstellungen` entfernen; Sicherheitsfunktionen bleiben im `Profil`.

## Nächster Umsetzungsschritt

- Konkrete Umsetzungsplanung wurde in `Vico.md` unter `11.14 Umsetzungsplan` ergänzt (Phasen 1-5).
