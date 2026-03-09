# Vico – Türen & Tore

Wartungs- und Mängeldokumentation für Türen und Tore. Stand: März 2025.

---

## Inhaltsverzeichnis

1. [Quick Start](#1-quick-start)
2. [Architektur](#2-architektur)
3. [Features](#3-features)
4. [Datenbank](#4-datenbank)
5. [Deployment](#5-deployment)
6. [Projektstand](#6-projektstand)
7. [Roadmap](#7-roadmap)
   - [Geplantes Modul: Arbeitszeiterfassung](#geplantes-modul-arbeitszeiterfassung)
   - [Umbau Wartung: Auftrag → Abarbeitung → Monteursbericht](#umbau-wartung-auftrag--abarbeitung--monteursbericht)
8. [Projektstruktur](#8-projektstruktur)

---

## 1. Quick Start

### Tech Stack

| Bereich | Technologie |
|--------|-------------|
| Web-App | Vite + React + TypeScript (TailwindCSS) |
| Backend | Supabase (Auth, Database, Storage) |
| Hosting | Netlify |

### Befehle

| Ziel | Befehl |
|------|--------|
| Web Dev | `npm run dev` |
| Web Dev (Netzwerk) | `npm run dev -- --host` |
| Web Build | `npm run build` |
| Tests | `npm run test` / `npm run test:run` |
| Lint | `npm run lint` |

---

## 2. Architektur

### Datenmodell

```
Kunde → BV → Objekt → Wartungsprotokolle
```

### Routen

| Pfad | Komponente |
|------|------------|
| `/` | Startseite (Dashboard) |
| `/kunden` | Kunden |
| `/kunden/:id/bvs` | BVs |
| `/kunden/:id/bvs/:bvId/objekte` | Objekte |
| `/kunden/.../objekte/:objectId/wartung` | Wartungsprotokolle |
| `/suche` | Suche |
| `/auftrag` | Auftrag anlegen |
| `/scan` | QR-Scan |
| `/historie` | Historie (Admin) |
| `/einstellungen` | Einstellungen |
| `/benutzerverwaltung` | Benutzerverwaltung (Admin) |
| `/profil` | Profil |

### Rollen

| Rolle | Rechte |
|-------|--------|
| **Admin** | Vollzugriff, Benutzerverwaltung, Historie |
| **Mitarbeiter** | CRUD Stammdaten + Aufträge (außer Löschen von Kunden, BVs, Objekten; BV anlegen nur Admin) |
| **Operator** | Nur Wartungsprotokolle schreiben, Stammdaten/Aufträge lesen |
| **Leser** | Nur lesen |
| **Demo** | Wie Mitarbeiter, aber nur eigene Daten; keine Auftragszuweisung; Daten nach 24h gelöscht |
| **Kunde** | Portal-Benutzer (extern): Nur Wartungsprotokolle der eigenen Kunden lesen + PDF-Download |

---

## 3. Features

### Kunden & BVs

- Adressfelder (PLZ, Ort, Straße, Hausnummer)
- BVs unter Kunden ausklappbar
- Objekte unter BVs ausklappbar

### Objekte

- Stammdaten, Art, Technik, Schließmittel, Feststellanlage, Rauchmelder
- Fotos, QR-Code (Druck via Bluetooth)

### Wartungsprotokolle

- Prüfgrund, Herstellerwartung, Feststellanlage, Rauchmelder
- Mängel, Fotos, Unterschriften
- PDF-Export, E-Mail-Versand

### Offline & Sync

- Lokale Speicherung, Outbox
- Sync-Status: Offline, Ready, Synchronisiert

#### Offline-fähige Funktionen (Stand: aktuell)

| Bereich | Lesen (Cache) | Schreiben (Outbox → Sync bei Online) |
|---------|---------------|--------------------------------------|
| **Kunden** | ✅ | ✅ Anlegen, Bearbeiten, Löschen |
| **BVs** | ✅ | ✅ Anlegen, Bearbeiten, Löschen |
| **Objekte** | ✅ | ✅ Anlegen, Bearbeiten, Löschen |
| **Aufträge** | ✅ | ✅ Anlegen, Bearbeiten (Status, Zuweisung, Termin), Löschen |
| **Objekt-Fotos** | ✅ | ✅ Hinzufügen (Base64 in Outbox) |
| **Wartungsprotokolle** | ✅ | ✅ Anlegen inkl. Rauchmelder (Outbox) |
| **Wartungsprotokoll-Fotos** | ✅ | ✅ Hinzufügen (Base64 in Outbox) |
| **Wartungserinnerungen** | ✅ (aus Cache) | — (nur Server) |
| **Komponenten-Einstellungen** | ✅ (aus Cache) | ⚠️ Änderung nur lokal, kein Outbox-Sync |
| **Historie (Audit-Log)** | ❌ (leeres Array offline) | — |
| **Benutzerverwaltung** | ❌ | ❌ |
| **PDF-Export / E-Mail** | — | ❌ (erfordert Online) |

#### Potenziell offline-fähig (noch nicht umgesetzt)

| Bereich | Aufwand | Beschreibung |
|---------|---------|--------------|
| **Komponenten-Einstellungen** | Gering | Outbox für `component_settings` (insert/update) ergänzen; `processOutbox` erweitern |
| **Historie (Audit-Log)** | Mittel | Letzte N Einträge beim Online-Sync cachen; bei Offline aus Cache anzeigen (mit Hinweis „Stand: letzter Sync“) |
| **Profil (eigene Daten)** | Gering | `profiles` in Cache/Outbox; Änderungen von Vorname/Nachname offline in Outbox |
| **Benutzerverwaltung (Lesen)** | Gering | `profiles` beim Sync cachen; Rollen/Zuweisungen offline aus Cache anzeigen |
| **PDF-Export (Wartung)** | Mittel | Fotos aus Cache/Outbox (Base64) statt URL-Fetch; jsPDF arbeitet clientseitig – offline möglich, wenn Bilddaten lokal |
| **E-Mail-Versand** | Mittel | E-Mail-Outbox: Wunsch „Bericht per E-Mail“ speichern; beim nächsten Sync Edge Function aufrufen (wie notify-portal-on-report) |
| **Lizenz-Status** | Gering | Letzten Status cachen; bei Offline aus Cache anzeigen (mit Hinweis „Stand: letzter Sync“) |

**Nicht sinnvoll offline:** Login/Auth, Benutzerverwaltung Schreiben (Rollen ändern – Konflikte bei mehreren Admins), Echtzeit-Benachrichtigungen.

### Darstellung (UX)

- **Dunkelmodus**: Einstellungen → Darstellung → Hell / Dunkel / System (folgt Systempräferenz)
- **LoadingSpinner**: Einheitliche Ladeanzeige (Spinner + Text) auf allen Seiten
- **Header**: Immer Vico-Farbe (#5b7895), Logo farblich eingebettet auch im Dark-Mode

---

## 4. Datenbank (Supabase)

### Tabellen

- profiles, customers, bvs, objects
- object_photos, maintenance_reports, maintenance_report_photos, maintenance_report_smoke_detectors
- orders, component_settings, audit_log, license
- customer_portal_users (Kundenportal: Verknüpfung Auth-User ↔ Kunden)

### Indizes

- bvs(customer_id), objects(bv_id)
- maintenance_reports(object_id), maintenance_reports(object_id, maintenance_date)
- orders(order_date, assigned_to, customer_id, bv_id)
- component_settings(sort_order), audit_log(created_at)

### Schema

`supabase-complete.sql` im Supabase SQL Editor ausführen (idempotent). Enthält Rollen (admin, mitarbeiter, operator, leser, demo, kunde), RLS, RPCs, Audit-Trigger, Kundenportal-Tabellen.

---

## 5. Deployment (Netlify)

1. **Git:** Repo mit GitHub verbinden
2. **Netlify:** Add site → Deploy with GitHub
3. **Build:** `npm run build`, Publish: `dist`
4. **Env:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. **Supabase:** Site URL + Redirect URLs (`/reset-password`)

**Lizenz-Admin** (`admin/`): Separates Netlify-Site, Root: `admin/`, Build: `npm run build`, Publish: `dist`. Subdomain z.B. `admin.vico-tueren.de`. Gleiche Env-Variablen wie Haupt-App. Nur Admins (Rolle `admin`) haben Zugriff.

### Release

- `release-notes.json` pro Version
- `version.json` beim Build
- Update-Banner bei neuer Version

### Supabase Keep-Alive (Free-Tier)

Supabase pausiert Free-Tier-Projekte nach 7 Tagen Inaktivität. Das GitHub-Actions-Workflow `.github/workflows/supabase-keepalive.yml` führt Mo + Do um 9:00 UTC eine einfache DB-Abfrage aus.

**Einrichtung:** GitHub Repo → Settings → Secrets and variables → Actions:

| Secret | Beschreibung |
|--------|--------------|
| `SUPABASE_URL` | Projekt-URL (z.B. `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role-Key (Supabase Dashboard → Settings → API) |

Manueller Start: Actions → Supabase Keep-Alive → Run workflow.

### Demo-Account (24h-Löschung)

- **Rolle "demo"**: Admin weist in Benutzerverwaltung zu.
- Demo-Benutzer sehen nur eigene Daten (Kunden mit `demo_user_id`).
- Beim Anlegen von Kunden wird automatisch `demo_user_id` gesetzt (Trigger).
- **Aufträge**: Demo-User dürfen keinen Aufträgen zugewiesen werden (DB-Trigger, Filter in Zuweisungsliste).
- **Löschung**: GitHub Actions `.github/workflows/cleanup-demo-data.yml` läuft täglich 4:00 UTC, ruft RPC `cleanup_demo_customers_older_than_24h()` auf.
- Gleiche Secrets wie Keep-Alive.

---

## 6. Projektstand

### Implementierte Features

| Feature | Status |
|---------|--------|
| versionUtils | ✅ `isNewerVersion()` |
| UpdateBanner | ✅ Layout, Version-Check |
| objectUtils | ✅ `getObjectDisplayName()` |
| Objekt-Anzeige | ✅ Suche, Auftrag, Wartung, PDF, QR, Startseite, Wartungsstatus (Ampel) in Kundenübersicht |
| Rechte | ✅ Kunden/BVs/Objekte löschen nur Admin, BV anlegen nur Admin, Demo-Rolle (24h-Löschung) |
| UX | ✅ Dunkelmodus (Hell/Dunkel/System), LoadingSpinner global, Login-Fehler per Toast, Touch-Targets (44px), Header immer Vico-Farbe |
| Web-App-Test-Checkliste | ✅ 45 Punkte, `npm run generate-checklist-webapp`, Button in Einstellungen |
| Historie | ✅ Audit-Log, Route `/historie` |
| Adressuche | ✅ OpenPLZ API: PLZ→Ort, Straßen unter PLZ |
| Fehlerbehandlung | ✅ ToastContext für Supabase-Fehler |
| Types | ✅ Aufgeteilt in `types/*.ts` |
| Indizes | ✅ orders, maintenance_reports, component_settings |
| Code-Splitting | ✅ Wartungsprotokolle (generateMaintenancePdf), Objekte (ObjectQRCodeModal) |
| Unit-Tests | ✅ 17 Tests: versionUtils, objectUtils, dataService |
| npm audit | ✅ 0 Schwachstellen |
| ESLint | ✅ Konfiguriert |
| CI/CD | ✅ GitHub Actions: Lint, Test, Build bei Push/PR |
| PWA | ✅ vite-plugin-pwa 1.2.0 (Vite 7 Support), generateSW |

### Abgeschlossen

| # | Thema | Status |
|---|-------|--------|
| 1 | Supabase-Schema | ✅ supabase-complete.sql (Rolle Operator, RLS, RPCs) |
| 4 | Code-Splitting | ✅ Wartungsprotokolle, Objekte, Route-Komponenten (lazy) |
| 6 | Unit-Tests | ✅ 17 Tests |
| 8 | Audit-Log | ✅ Trigger für alle relevanten Tabellen |

---

## 7. Roadmap

### Geplant

- ~~DSGVO~~ ✅ (Kundenportal: Datenschutzerklärung, Impressum, Einwilligung beim Login)
- ~~Lizenzmodell~~ ✅ (Option A – Minimal: `license`-Tabelle, RPCs `get_license_status`/`check_can_create_customer`/`check_can_invite_user`, LicenseContext, Limits in Kunden- und Benutzerverwaltung, Lizenz-Status in Einstellungen)
- ~~Kundenportal für Wartungsberichte~~ ✅ (Separates Portal unter `portal/`, Rolle "kunde", Magic Link + Einladung, RLS)

### Offene Aufgaben

- **Secrets prüfen** – Supabase Edge Functions: RESEND_API_KEY, RESEND_FROM, PORTAL_URL (für notify-portal-on-report)

### Geplante Verbesserungen

1. ~~**E-Mail-Benachrichtigung bei neuem Wartungsbericht**~~ ✅ (Edge Function `notify-portal-on-report`, Resend)
2. ~~**Portal: Dunkelmodus**~~ ✅ (ThemeContext, Hell/Dunkel/System-Toggle; Tailwind `darkMode: ['selector', '[data-theme="dark"]']` für korrekten Theme-Wechsel)
3. ~~**Kundenübersicht/Objekte – Wartungsstatus anzeigen**~~ ✅ (Ampelfarben: rot=überfällig, gelb=bald fällig, grün=ok)

4. ~~**Erweiterte Vico Web App Test-Checkliste erstellen**~~ ✅

5. ~~**Objekte-ID im Formular**~~ ✅

6. ~~**Rauchmelder Jahresauswahl**~~ ✅

7. ~~**Objekt-Feldnamen in der Kundenübersicht**~~ ✅

8. ~~**Demo-Account mit 24h-Löschung**~~ ✅ (Rolle "demo", RLS, RPC cleanup_demo_customers_older_than_24h, GitHub Actions)

9. ~~**Benutzeranleitung erstellen**~~ ✅ (BENUTZERANLEITUNG.md)

10. ~~**Supabase-Inaktivierung vermeiden**~~ ✅ (GitHub Actions Keep-Alive: `.github/workflows/supabase-keepalive.yml`)

11. ~~**PWA-Build-Fehler beheben**~~ ✅ (vite-plugin-pwa 0.19 → 1.2.0 für Vite 7)

### Geplante Features (Vorschläge)

#### Hohe Priorität

| Feature | Beschreibung |
|---------|--------------|
| **Wartungsplanung / Erinnerungen** | Erinnerungen für bevorstehende Wartungen (z.B. 30 Tage vorher), optional E-Mail an Techniker oder Kunden |
| **Wartungsstatistik / Auswertung** | Übersicht: Wartungen pro Kunde/BV/Objekt, Auslastung pro Monat, überfällige Wartungen |
| **Export für Buchhaltung** | CSV/Excel-Export von Wartungsprotokollen oder Kunden für Abrechnung |
| **Schnellzugriff / Zuletzt bearbeitet** | Zuletzt bearbeitete Kunden/Objekte auf der Startseite oder in der Navigation |
| **Erweiterte Filter** | Filter in der Kundenliste (PLZ, Wartungsstatus, BV-Anzahl) und in der Suche |

#### Mittlere Priorität

| Feature | Beschreibung |
|---------|--------------|
| **Wartungs-Checkliste pro Objekttyp** | Vordefinierte Checklisten je nach Tür-/Tortyp (z.B. Schließanlage, Feststellanlage) |
| **Mängel-Follow-up** | Offene Mängel tracken, Erinnerung bis zur Behebung, Status „offen“ / „behoben“ |
| **Dokumente/Anhänge pro Objekt** | Technische Zeichnungen, Zertifikate, Herstellerdokumente pro Objekt ablegen |
| **Kalender-Sync** | Aufträge als iCal/Google-Kalender exportieren oder abonnieren |
| **Zwei-Faktor-Authentifizierung (2FA)** | Zusätzliche Absicherung für Admin-Accounts (Supabase unterstützt TOTP) |

#### Niedrige Priorität

| Feature | Beschreibung |
|---------|--------------|
| **Bulk-Operationen** | Mehrere Objekte oder Kunden gleichzeitig bearbeiten (z.B. Wartungsintervall ändern) |
| **Portal: Push-Benachrichtigungen** | Kunden per Push informieren, wenn ein neuer Wartungsbericht vorliegt |
| **Standort-Tracking** | Beim Erstellen eines Wartungsprotokolls den Standort erfassen (optional) |
| **Aktivitätsprotokoll** | Wer hat wann was geändert (Erweiterung des Audit-Logs) |
| **Mehrsprachigkeit** | UI auf Englisch oder weitere Sprachen umstellbar |

#### Empfohlene Reihenfolge

1. Wartungsplanung / Erinnerungen – direkter Nutzen für die tägliche Arbeit  
2. Wartungsstatistik – bessere Übersicht und Planung  
3. Export für Buchhaltung – wichtig für Abrechnung und Steuer  
4. Schnellzugriff – geringer Aufwand, großer Nutzen  
5. 2FA – erhöhte Sicherheit für sensible Daten  

### Geplantes Modul: Arbeitszeiterfassung

**Aktivierung:** Lizenzmodul über das Lizenzportal (admin/) – nur bei aktivierter Lizenz sichtbar und nutzbar.

**Zielgruppe:** Mitarbeiter (Rollen: admin, mitarbeiter, operator) erfassen ihre Arbeitszeit in der Vico-App.

**Ablauf:**
- Mitarbeiter **startet** seine Arbeitszeit (Stempeln/Button).
- Mitarbeiter **beendet** seine Arbeitszeit am Ende des Arbeitstags.
- **Pausenfunktion:** Pausen können manuell erfasst werden (Start Pause, Ende Pause).
- **Automatische Pause nach ArbZG:** Wird keine Pause eingegeben, wird sie automatisch nach den Vorgaben des Arbeitszeitgesetzes (ArbZG § 4) eingefügt:
  - Bis 6 Stunden Arbeitszeit: keine Pausenpflicht.
  - Mehr als 6 bis 9 Stunden: mindestens 30 Minuten Pause (automatisch abgezogen).
  - Mehr als 9 Stunden: mindestens 45 Minuten Pause (automatisch abgezogen).
  - Pausen können in Abschnitte von mindestens 15 Minuten aufgeteilt werden.
  - Nicht länger als 6 Stunden ohne Ruhepause – Hinweis/Warnung bei Überschreitung.

**Technische Planung:**
- Neue Tabelle `time_entries` (user_id, start_at, end_at, pause_minutes, auto_pause_applied, created_at, …).
- Lizenz-Feature-Flag (z.B. `time_tracking`) in `license`-Tabelle oder Lizenz-Admin.
- Route `/arbeitszeit` oder integriert in Startseite/Profil.
- RLS: Nutzer sieht nur eigene Einträge; Admin sieht alle.
- Optional: Verknüpfung mit Aufträgen (Zeit pro Auftrag).

### Umbau Wartung: Auftrag → Abarbeitung → Monteursbericht

**Ziel:** Aufträge werden als detaillierte Arbeitsaufträge erstellt, vom Monteur abgearbeitet und mit einem Monteursbericht (Zeiten, Material) dokumentiert. Nach Freigabe erscheint der Bericht im Kundenportal und dient der Buchhaltung/Abrechnung.

---

#### 1. Auftragstypen (Szenarien)

| Typ | Beschreibung | Monteursbericht erforderlich | Wartungsprotokoll (DIN/ASR) |
|-----|--------------|------------------------------|------------------------------|
| **Einbau** | Montage/Installation neuer Anlagen | Ja (Zeiten, Material) | Nein (ggf. Abnahme-Protokoll) |
| **Reparatur** | Instandsetzung, Mängelbeseitigung | Ja (Zeiten, Material) | Nein (außer bei Feststellanlage) |
| **Wartung** | Regelmäßige Wartung nach Intervall | Ja (Zeiten, optional Material) | **Ja** – DIN 14677 und/oder ASR A1.7 |
| **Nachprüfung** | Prüfung ohne Wartung (z.B. nach Reparatur) | Ja (Zeiten) | **Ja** – je nach Objekttyp |
| **Sonstiges** | Beratung, Besichtigung, Sonderleistungen | Ja (Zeiten, optional Material) | Nein |

**Hinweis:** Aktuell existieren `order_type`: wartung, reparatur, montage, sonstiges. Vorschlag: `montage` → `einbau` umbenennen, `nachpruefung` ergänzen.

---

#### 2. Detaillierter Auftrag

Ein Auftrag enthält mindestens:
- Kunde, BV, Objekt (optional bei Einbau)
- Auftragstyp (Einbau, Reparatur, Wartung, Nachprüfung, Sonstiges)
- Termin, Zuweisung, Status
- **Beschreibung / Arbeitsauftrag** (Freitext, ggf. Checkliste)
- Optional: Priorität, Referenz (z.B. Kundenauftragsnummer)

**Status-Flow:** `offen` → `in_bearbeitung` → `erledigt` (mit Monteursbericht) oder `storniert`

---

#### 3. Abarbeitung und Monteursbericht

Beim Abarbeiten eines Auftrags erstellt der Monteur einen **Monteursbericht** mit:

| Feld | Pflicht | Verwendung |
|------|---------|------------|
| **Arbeitszeiten** | Ja | Start, Ende, Pausen; Netto-Arbeitszeit pro Auftrag (für Abrechnung) |
| **Verwendetes Material** | Je nach Typ | Position, Artikel, Menge, Einheit, optional Einzelpreis |
| **Durchgeführte Arbeiten** | Ja | Kurzbeschreibung / Checkliste |
| **Mängel / Bemerkungen** | Optional | Für Nachfolgeaufträge und Dokumentation |
| **Fotos** | Optional | Vorher/Nachher, Mängel |
| **Unterschriften** | Bei Wartung | Techniker, Kunde (wie bisher) |

**Freigabe:** Admin oder definierter Freigeber bestätigt den Bericht → dann sichtbar im Kundenportal und für Buchhaltung.

---

#### 4. Wartungsprotokoll nach DIN 14677 und ASR A1.7

**Bei Auftragstyp „Wartung“** (und ggf. „Nachprüfung“) wird zusätzlich ein normgerechtes Wartungsprotokoll erstellt:

- **DIN 14677** (Feststellanlagen): Gilt für Objekte mit Feststellanlage. Enthält u.a.:
  - Jährliche Wartung durch Fachkraft
  - Prüfpunkte: Rauchmelder, Feststellvorrichtung, Steuerung, Not-Aus
  - Rauchmelder-Austauschfristen (5/8 Jahre)
  - Dokumentation aller Prüfschritte

- **ASR A1.7** (Türen und Tore): Gilt für kraftbetätigte/handbetätigte Türen und Tore:
  - Jährliche Prüfung durch befähigte Person
  - Sichtprüfung, Funktionsprüfung, Kraftmessung an Schließkanten
  - Dokumentation der Prüfergebnisse

**Umsetzung:** Das bestehende `maintenance_reports`-Schema erweitern oder ein separates Prüfprotokoll-Schema mit norm-spezifischen Feldern. Protokoll-Typ wählbar je nach Objekt (mit/ohne Feststellanlage, Tür vs. Tor).

---

#### 5. Kundenportal und Buchhaltung

- **Portal:** Freigegebene Monteursberichte (inkl. Zeiten, Material, Fotos) werden im Kundenportal angezeigt – analog zu Wartungsberichten.
- **Buchhaltung:** Export (CSV/Excel) mit: Auftrag, Kunde, Objekt, Datum, Arbeitszeit, Materialpositionen, Summen – für Rechnungsstellung und Abrechnung.

---

#### 6. Technische Planung (Überblick)

| Komponente | Änderung |
|------------|----------|
| **orders** | Erweiterung: `order_type` um `einbau`, `nachpruefung`; ggf. `work_description`, `priority` |
| **technician_reports** (neu) | `order_id`, `technician_id`, `start_at`, `end_at`, `pause_minutes`, `work_description`, `approved_at`, `approved_by` |
| **technician_report_materials** (neu) | `report_id`, `position`, `article`, `quantity`, `unit`, `unit_price` (optional) |
| **maintenance_reports** | Verknüpfung mit `order_id` und/oder `technician_report_id`; Protokoll-Typ (DIN 14677, ASR A1.7) |
| **Portal** | RPC/View für freigegebene Monteursberichte; Anzeige in Berichte-Seite |
| **Export** | Neuer Export für Buchhaltung (Aufträge + Monteursberichte + Material) |

---

#### 7. Roadmap

| Phase | Meilenstein | Inhalte | Abhängigkeiten |
|-------|-------------|---------|----------------|
| **1** | Aufträge erweitern | `order_type` um `einbau`, `nachpruefung`; Migration `montage`→`einbau`; Felder `work_description`, `priority`; UI anpassen | — |
| **2** | Monteursbericht (Kern) | Tabellen `technician_reports`, `technician_report_materials`; CRUD in Web-App; Zeiterfassung, Material (Freitext), Arbeiten, Fotos | Phase 1 |
| **3** | Freigabe-Workflow | Status „zur Freigabe“; Freigabe durch Admin; RLS für Portal-Sichtbarkeit | Phase 2 |
| **4** | Kundenportal | RPC/View für freigegebene Monteursberichte; Anzeige in Berichte-Seite; PDF-Download | Phase 3 |
| **5** | Wartungsprotokoll DIN/ASR | `maintenance_reports` mit `order_id`/`technician_report_id`; Protokoll-Typ (DIN 14677, ASR A1.7); normgerechte Felder und PDF | Phase 2 |
| **6** | Buchhaltungs-Export | CSV/Excel-Export: Aufträge, Zeiten, Material, Summen | Phase 3 |
| **7** | Offline & Material-Stammdaten | Offline-Erfassung Monteursbericht (Outbox); optional: Material-Stammdaten, Auftrags-Checklisten | Phase 2, 6 |
| **8** | Erweiterungen | Mehrfachbesuche (1:N), Prüfprotokoll-Vorlagen je Objekttyp, Verknüpfung Arbeitszeiterfassung | Phase 5, 7 |

**Empfohlene Reihenfolge:** 1 → 2 → 3 → 4 (MVP: Auftrag → Monteursbericht → Freigabe → Portal) → 5 → 6 → 7 → 8

---

#### 8. Eigene Vorschläge

1. **Auftrags-Checkliste:** Vordefinierte Prüfpunkte je Auftragstyp (z.B. bei Wartung: Schließmittel prüfen, Öle, Einstellungen). Monteur hakt ab – reduziert Vergessen und standardisiert die Abarbeitung.

2. **Material-Stammdaten:** Zentrale Materialliste (Artikelnummer, Bezeichnung, Einheit, Preis) – Auswahl im Monteursbericht statt Freitext. Erleichtert Abrechnung und Auswertung.

3. **Mehrfachbesuche:** Ein Auftrag kann mehrere Monteursberichte haben (z.B. Reparatur mit Vor-Ort-Besuch + Nachprüfung). Verknüpfung 1:N: `order` → `technician_reports`.

4. **Offline-Fähigkeit:** Monteursbericht und Zeiterfassung müssen offline erfassbar sein (Baustelle ohne Netz) – Outbox wie bei Wartungsprotokollen.

5. **Prüfprotokoll-Vorlagen:** Je Objekttyp (Tür mit Feststellanlage, Tor ohne, etc.) unterschiedliche Prüfprotokoll-Vorlagen – nur relevante Prüfpunkte anzeigen.

6. **Zeit-zu-Auftrag:** Verknüpfung Arbeitszeiterfassung ↔ Auftrag: Erfasste Zeiten können einem Auftrag zugeordnet werden, Monteursbericht übernimmt diese Zeiten oder ergänzt sie.

7. **Status „zur Freigabe“:** Zwischenschritt zwischen `erledigt` und Portal-Freigabe – Bericht ist fertig, wartet auf Freigabe durch Admin.

---

## 8. Projektstruktur

```
Vico/
├── src/
│   ├── components/     # AddressLookupFields, LoadingSpinner, OrderCalendar, ObjectFormModal, PortalInviteSection
│   ├── lib/            # dataService, offlineStorage, licenseService, Utils, PDF-Generierung
│   ├── types/          # TypeScript-Typen (customer, bv, object, order, maintenance)
│   └── *.tsx           # Seiten, Layout, Auth, ThemeContext, LicenseContext, ToastContext, Context
├── portal/             # Kundenportal (separates Vite-Projekt)
│   ├── src/
│   │   ├── pages/      # Login, AuthCallback, Berichte, MeineDaten, Datenschutz, Impressum
│   │   ├── components/ # Layout
│   │   └── lib/        # supabase, portalService
│   ├── public/
│   └── netlify.toml
├── admin/              # Lizenz-Admin (separates Vite-Projekt, nur für Admins)
│   ├── src/
│   │   ├── pages/      # Login, Lizenz
│   │   ├── components/ # Layout
│   │   └── lib/        # supabase, licenseService
│   ├── public/
│   └── netlify.toml
├── public/             # Favicon, Logo, Checkliste-PDF, version.json (Dev-Fallback)
├── scripts/            # generate-checklist-webapp-pdf.mjs
├── supabase/           # Edge Functions (send-maintenance-report, invite-portal-user, request-portal-magic-link, notify-portal-on-report)
├── supabase-complete.sql
├── Vico.md
├── BENUTZERANLEITUNG.md
├── netlify.toml
├── .github/workflows/ci.yml
├── .npmrc
└── eslint.config.js
```
