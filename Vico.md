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
8. [Projektstruktur](#8-projektstruktur)
9. [Plan: Mandantenfähigkeit & Lizenzportal](#9-plan-mandantenfähigkeit--lizenzportal)
10. [Konzept: Geplante Änderungen Hauptapp](#10-konzept-geplante-änderungen-hauptapp)
11. [Konzepte & Planungsdokumente (konsolidiert)](#11-konzepte--planungsdokumente-konsolidiert)

**Getroffene Entscheidungen** und weitergehende Konzepte (ehemals viele Einzeldateien unter `docs/`): **Abschnitt 11** in dieser Datei. Operative Checklisten und Setup-Hilfen verbleiben in `docs/` (siehe §11.12).

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
| Web Dev (Netzwerk) | `npm run dev` (alle Vite-Configs haben `host: true`) |
| Web Build | `npm run build` |

### Dev-Server (Ports & IP-Zugriff)

Alle Apps sind per IP erreichbar (`host: true` in Vite). Nach `npm run dev` in jedem Projekt:

| App | Port | Local | Netzwerk (IP) |
|-----|------|-------|---------------|
| **Haupt-App** | 5173 | http://localhost:5173/ | http://&lt;IP&gt;:5173/ |
| **Kundenportal** | 5174 | http://localhost:5174/ | http://&lt;IP&gt;:5174/ |
| **Admin (Lizenz)** | 5175 | http://localhost:5175/ | http://&lt;IP&gt;:5175/ |
| **Arbeitszeit-Portal** | 5176 | http://localhost:5176/ | http://&lt;IP&gt;:5176/ |

Start: `npm run dev` im Root (Haupt-App), `cd admin && npm run dev`, `cd portal && npm run dev`, `cd arbeitszeit-portal && npm run dev`. Die IP-Adresse zeigt Vite beim Start (z. B. `Network: http://192.168.0.186:5173/`).
| Tests | `npm run test` / `npm run test:run` |
| Lint | `npm run lint` |
| Vico-Dokumentation als PDF | `npm run generate-vico-pdf` |
| Komponenten & Funktionen (PDF) | `npm run generate-komponenten-pdf` (auch beim Admin-Build) |

---

## 2. Architektur

### Datenmodell

**Aktuell:** `Kunde → BV → Objekt → Wartungsprotokolle`

**Geplant (Konzept Hauptapp, siehe Abschnitt 10):** Begriffe werden angepasst: **BV → Objekt/BV** (Gebäude/Standort), **Objekt → Tür/Tor** (konkretes Element). Tür/Tor kann bei Kunden ohne Objekte/BVs auch direkt unter dem Kunden angelegt werden. Wartungsvertrag entweder auf Kundenebene (wenn keine Objekte/BVs) oder pro Objekt/BV.

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
| `/arbeitszeit` | Arbeitszeiterfassung (Lizenzmodul) |

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

#### Offline-fähige Funktionen

| Bereich | Lesen | Schreiben |
|---------|-------|-----------|
| Kunden, BVs, Objekte, Aufträge | ✅ | ✅ CRUD |
| Objekt-Fotos, Objekt-Dokumente (Zeichnungen, Zertifikate), Wartungsprotokolle, Wartungsprotokoll-Fotos | ✅ | ✅ |
| Wartungserinnerungen | ✅ | — |
| Komponenten-Einstellungen | ✅ | ✅ (Outbox → Sync) |
| Lizenz-Status | ✅ (Cache) | — |
| Profil | ✅ (Cache) | ✅ (Outbox → Sync) |
| Benutzerverwaltung | ✅ (Cache) | — |
| Historie | ✅ (Cache) | — |
| PDF-Export | ✅ (Fotos aus Cache) | — |
| E-Mail-Versand | — | ✅ (Outbox → Sync) |

---

## 4. Datenbank (Supabase)

### Tabellen

- profiles, customers, bvs, objects
- object_photos, object_documents, maintenance_reports, maintenance_report_photos, maintenance_report_smoke_detectors
- orders, time_entries, time_breaks, component_settings, audit_log, license
- customer_portal_users (Kundenportal)

### Schema

`supabase-complete.sql` im Supabase SQL Editor ausführen (idempotent). Enthält Rollen, RLS, RPCs, Audit-Trigger, Kundenportal-Tabellen.

---

## 5. Deployment (Netlify)

1. **Git:** Repo mit GitHub verbinden
2. **Netlify:** Add site → Deploy with GitHub
3. **Build:** `npm run build`, Publish: `dist`
4. **Env:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. **Supabase:** Site URL + Redirect URLs (`/reset-password`)

**Lizenz-Admin** (`admin/`): Separates Netlify-Site, Root: `admin/`, Subdomain z.B. `admin.vico-tueren.de`.

### Supabase Keep-Alive (Free-Tier)

GitHub Actions `.github/workflows/supabase-keepalive.yml` – Mo + Do 9:00 UTC. Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Supabase-Region & Ladezeiten

**Aktuelle Region anzeigen**

- Supabase Dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard) → dein Projekt wählen
- **Settings** (Zahnrad links) → **General**
- Unter **Infrastructure** steht die **Region** (z. B. `Frankfurt (eu-central-1)` oder `N. Virginia (us-east-1)`)

**Region wechseln**

Supabase erlaubt **kein Umstellen der Region** eines bestehenden Projekts. Optionen:

1. **Neues Projekt in der gewünschten Region anlegen**
   - Dashboard → **New project** → bei **Region** eine Region nahe an den Nutzern wählen (z. B. **Frankfurt** für DACH).
   - Verfügbare Regionen: [Supabase Docs – Regions](https://supabase.com/docs/guides/platform/regions) (General regions bzw. konkrete AWS-Regionen).

2. **Daten migrieren**
   - Schema (z. B. `supabase-complete.sql`) im neuen Projekt ausführen.
   - Daten exportieren/importieren (pg_dump/pg_restore oder Supabase Backup).
   - Anschließend in der App die neuen Werte für `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen (Netlify Env, lokale `.env`).

**Ladezeiten messen (aktuell)**

Die App schreibt bei jedem Sync und beim Laden der Startseite Zeiten in die **Browser-Konsole** (DevTools → Console):

- `[Sync] pullFromServer: Batch1 (Stammdaten) Xms, Batch2 (…) Yms, gesamt Zms`
- `[Sync] runSync: Push Xms, … gesamt Yms`
- `[Startseite] loadData: Xms`

So siehst du, ob der Flaschenhals beim ersten Datenblock (Stammdaten), beim zweiten (Einstellungen/Profile/Lizenz/Audit/Reminders) oder beim Push liegt. Bei hohen Werten: Region prüfen und ggf. neues Projekt in näherer Region anlegen.

**Lizenzportal (Admin-App, `admin/`):** Gleiches Vorgehen wie in der Haupt-App – parallele Abfragen und Ladezeit-Logs in der Konsole:

- **Auth:** `[Lizenzportal] Auth: getSession Xms, checkRole Yms, gesamt Zms`
- **Mandanten:** `[Lizenzportal] Mandanten load: Xms` (Tenants, Lizenzen, Grenzüberschreitungs-Log bereits in einem `Promise.all`)
- **Mandant bearbeiten:** Mandant + Lizenzen + Lizenzmodelle in einem `Promise.all` → `[Lizenzportal] MandantForm load: Xms`
- **Grenzüberschreitungen / Lizenzmodelle / Export:** je eigene Log-Zeile

Das Lizenzportal-Supabase-Projekt (B3/L1) sollte ebenfalls in einer nahen Region liegen (siehe Checkliste oben).

### Mobile-Build (Capacitor / Android & iOS)

Die Web-App läuft in einer nativen Hülle (Capacitor). **Parallel zur PWA** – gleicher Code, Build für Android und iOS.

**Voraussetzung:** Node, npm, Android Studio (für APK/Emulator), ggf. Xcode (für iOS, nur macOS).

**Ablauf:**

1. **Web-Build + Sync:** `npm run build:mobile` (baut die App und kopiert sie in `android/` und `ios/`).
2. **Android:** `npm run cap:android` öffnet Android Studio. Von dort: Device/Emulator wählen → Run, oder Build → Build Bundle(s) / APK(s) für Release.
3. **iOS:** `npm run cap:ios` öffnet Xcode (nur macOS). Scheme wählen, Simulator oder Gerät, Run. Für Release: Archive → Distribute.

**Scripts (package.json):**

| Befehl | Bedeutung |
|--------|-----------|
| `npm run build:mobile` | `npm run build` + `npx cap sync` |
| `npm run cap:sync` | Web-Assets aus `dist/` in native Projekte kopieren (nach Änderungen an der Web-App). |
| `npm run cap:android` | Android Studio öffnen |
| `npm run cap:ios` | Xcode öffnen (macOS) |

**Konfiguration:** `capacitor.config.ts` – `appId: 'de.vico.app'`, `appName: 'Vico'`, `webDir: 'dist'`. Optional: `server.url` für Live-Reload im Emulator (z. B. `http://192.168.x.x:5173`).

**Hinweis:** Nach Änderungen an der Web-App immer `npm run build:mobile` (oder `npm run build` + `npm run cap:sync`) ausführen, bevor in Android Studio/Xcode gebaut wird.

**Ladezeiten-Dashboard (Roadmap J9) – ✅ umgesetzt**

`src/pages/Ladezeiten.tsx` – Performance-Dashboard (nur Admin): Ladezeiten in localStorage, grafische Anzeige von Sync Batch1/Batch2/Gesamt und Startseite loadData. Ziel: Flaschenhälse auf einen Blick erkennen.

### Demo-Account (24h-Löschung)

Rolle "demo", RPC `cleanup_demo_customers_older_than_24h()`, GitHub Actions täglich 4:00 UTC.

---

## 6. Projektstand

### Implementiert

- shared/versionUtils, shared/UpdateBanner, objectUtils
- Objekt-Anzeige (Suche, Auftrag, Wartung, PDF, QR, Wartungsstatus-Ampel)
- Rechte (Admin, Demo-Rolle, BV nur Admin)
- UX: Dunkelmodus, LoadingSpinner, Toast, Touch-Targets
- Web-App-Test-Checkliste, Historie (Audit-Log)
- Adressuche (OpenPLZ), Fehlerbehandlung (ToastContext)
- Types, Indizes, Code-Splitting
- Unit-Tests, ESLint, CI/CD, PWA

---

## 7. Roadmap

**Maßgeblich** ist die **konsolidierte Roadmap in Abschnitt 7.1** weiter unten (eine Tabelle mit Erledigt-Status ✅ und offenen Punkten). **7.2** ist die Feature-Referenz (Priorität, Aufwand). Die frühere Doppeltabelle (A–H, Weitere W1–W7 ohne ✅) ist darin aufgegangen.

### 7.2 Roadmap: Geplante Features (mit Aufwand) – Referenz

| # | Feature | Priorität | Aufwand | Beschreibung |
|---|---------|-----------|---------|--------------|
| 1 | Wartungsplanung / Erinnerungen | Hoch | 3–5 T | Erinnerungen (z.B. 30 Tage vorher), optional E-Mail an Techniker/Kunden |
| 2 | Wartungsstatistik / Auswertung | Hoch | 3–4 T | Wartungen pro Kunde/BV/Objekt, Auslastung, überfällige Wartungen |
| 3 | Export für Buchhaltung | Hoch | 2–3 T | CSV/Excel-Export für Abrechnung |
| 4 | Schnellzugriff / Zuletzt bearbeitet | Hoch | 1–2 T | Zuletzt bearbeitete Kunden/Objekte auf Startseite |
| 5 | Erweiterte Filter | Hoch | 2 T | Filter Kundenliste (PLZ, Wartungsstatus, BV-Anzahl) |
| 6 | Umbau Wartung (MVP) | Hoch | 15–20 T | Auftrag → Monteursbericht → Freigabe → Portal (Phasen 1–4) |
| 7 | Arbeitszeiterfassung (Modul) | Mittel | 5–8 T | Lizenzmodul: Start/Ende, Pausen, ArbZG, Outbox |
| 8 | Wartungs-Checkliste pro Objekttyp | Mittel | 3–4 T | Vordefinierte Checklisten je Tür-/Tortyp |
| 9 | Mängel-Follow-up | Mittel | 3 T | Offene Mängel tracken, Status offen/behoben |
| 10 | Kalender-Sync (iCal) | Mittel | 2–3 T | Aufträge als iCal/Google-Kalender |
| 11 | 2FA | Mittel | 2–3 T | Zwei-Faktor-Authentifizierung für Admins |
| 12 | Offline-Erweiterungen | Mittel | 3–5 T | ~~Komponenten-Einstellungen, Historie-Cache, PDF, Profil, E-Mail-Outbox~~ ✅ |
| 13 | Dokumente/Anhänge pro Objekt | Niedrig | 4 T | ~~Zeichnungen, Zertifikate pro Objekt~~ ✅ |
| 14 | Bulk-Operationen | Niedrig | 3 T | Mehrere Objekte/Kunden gleichzeitig bearbeiten |
| 15 | Portal: Push-Benachrichtigungen | Niedrig | 2–3 T | Kunden bei neuem Wartungsbericht informieren |
| 16 | ✅ Ladezeiten-Monitoring / Performance-Dashboard | – | – | Umgesetzt: `src/pages/Ladezeiten.tsx` – Sync- und Startseiten-Metriken (Admin). |
| 17 | **Bug-Erfassungsmodul** | Niedrig | 1–2 T | Automatische Erfassung von JS-Fehlern (onerror, unhandledrejection, ErrorBoundary) und Speicherung in DB; Admin unter **System → Fehlerberichte**. Konzept: **§11.3**. |

**Aufwand:** T = Tage (geschätzt, 1 Entwickler)

### Umbau Wartung: Auftrag → Monteursbericht (Detail)

**Ziel:** Detaillierte Aufträge, Abarbeitung durch Monteur, Monteursbericht (Zeiten, Material), Freigabe → Kundenportal + Buchhaltung.

**Auftragstypen:** Einbau, Reparatur, Wartung, Nachprüfung, Sonstiges. Bei Wartung: Wartungsprotokoll nach DIN 14677 (Feststellanlagen) und ASR A1.7 (Türen/Tore).

**Phasen:** (1) Aufträge erweitern → (2) Monteursbericht (Tabellen, CRUD) → (3) Freigabe-Workflow → (4) Kundenportal → (5) Wartungsprotokoll DIN/ASR → (6) Buchhaltungs-Export → (7) Offline, Material-Stammdaten → (8) Erweiterungen (Mehrfachbesuche, Vorlagen).

### Arbeitszeiterfassung (Modul)

**Aktivierung:** Lizenzmodul über admin/. **Ablauf:** Start/Ende Arbeitszeit, Pausen (manuell oder automatisch nach ArbZG § 4). **Technisch:** Tabelle `time_entries`, `time_breaks`, Feature-Flag, Component Setting, Route `/arbeitszeit`, RLS.

**Phase 1 (MVP) abgeschlossen:** Tagesansicht, Start/Pause/Ende, ArbZG §3/§4/§5, Wochen-Summe, „Vergessen auszustempeln“-Hinweis, Admin sieht alle (User-Dropdown), Offline/Outbox. **Details:** **§11.6**.

**Phase 2 (umgesetzt):** Bearbeiten mit Grund (`time_entry_edit_log`, RPC `update_time_entry_admin`), Admin-Modal mit Grund-Auswahl (Korrektur/Nachreichung/Fehler/Sonstiges), **Wochenansicht** (Mo–So, Vorherige/Nächste Woche), **Monatsansicht** (Kalender-Grid mit Stundensummen pro Tag). **LOG-Übersicht:** Tab „Log“ mit Filter (Zeitraum, Benutzer), Paginierung, „Filter zurücksetzen“. **Auftragszuordnung:** per Entscheidung **entfernt** (UI/Code); Spalte `order_id` kann in der DB bleiben – **§11.1 §7**. **Arbeitszeitkonto:** `profiles.soll_minutes_per_month` / `soll_minutes_per_week`; Monatsansicht Soll/Ist/Saldo; Admin in Benutzerverwaltung.
**IONOS-Hosting, weitere AZK-Themen:** **§11.8**. **Ortung (GPS):** **§11.7**. **Standortabfrage** (Arbeitszeitenportal): **§11.9**.

---

### 7.1 Konsolidierte Roadmap (offene Punkte, empfohlene Abarbeitsreihenfolge)

Alle noch offenen Punkte aus Vico.md (Abschnitte 7, 9, 10) in einer sinnvollen Reihenfolge. Empfehlung: zuerst schnelle UX-Anpassungen und Lizenz-Abschluss, dann fachliche Erweiterungen (Auftrag, Datenmodell), zuletzt Mobile/APK und optionale Auswertungen.

| Phase | Nr. | Offener Punkt | Quelle | Geschätzter Aufwand |
|-------|-----|----------------|--------|---------------------|
| **A – Menü & Einstellungen** | A1 | ✅ Neuer Menüpunkt **„Info“** (oder „App-Info“): Appversion, Lizenz, Anleitung. Diese Inhalte aus Einstellungen entfernen. | 10.5 | 0,5–1 T |
| | A2 | ✅ Aus **Einstellungen:** Benutzerverwaltung-Link entfernen. Aus **Benutzerverwaltung:** Einstellungen-Link entfernen. | 10.5 | 0,25 T |
| **B – Lizenzportal (Abschluss)** | B1 | ✅ **Grenzwarnungen** (80 %/90 %/100 %) in Benutzerverwaltung + ggf. Einstellungen/Dashboard. | 9.17 | 1 T |
| | B2 | ✅ **Verhalten bei abgelaufener Lizenz:** Schonfrist Nur-Lesen (Tage im Lizenzportal konfigurierbar), danach Redirect. **§11.1 §2.** | 9.10, 9.17 | 1–2 T |
| | B3 | ✅ **Lizenzportal-Supabase-Projekt** anlegen, Schema `supabase-license-portal.sql` im neuen Projekt ausführen (operativer Schritt). | 9.17 | 0,5 T |
| **C – Benutzerverwaltung** | C1 | ✅ **Benutzer anlegen:** Auswahl der Rolle (Rollenliste abhängig von Lizenz/Modulen). | 10.6, 10.12 | 0,5 T |
| | C2 | ✅ **Portalbenutzer:** Anzeige/Bearbeitung zu welchem Kunde; Auswahl der Objekte/BV für Zugriff (Whitelist-UI). | 10.3, 10.6 | 1–2 T |
| **D – Auftrag** | D1 | ✅ **Auftrag anlegen:** Objekt/BV nur anzeigen wenn Kunde mehrere hat; Uhrzeit optional. Felder wie in 10.8. | 10.8 | 0,5 T |
| | D2 | ✅ **Tabelle `order_completions`** (Monteursbericht): Schema, RLS, CRUD. Felder: ausgeführte Arbeiten, Material, Arbeitszeit, Unterschriften (Bild + Name/Datum). | 10.9, 10.12 | 2–3 T |
| | D3 | ✅ **Route `/auftrag/:orderId`**, Auftragsdetail-Seite (kein Popup): Kunden-/Objekt/BV-Daten, Beschreibung, Completion-Formular, Unterschriften. | 10.9 | 1,5–2 T |
| | D4 | ✅ Dashboard: Klick auf Auftrag führt zu Auftragsdetail; Mitarbeiter kann Auftrag von dort abarbeiten. | 10.9 | 0,5 T |
| **E – Datenmodell & Labels** | E1 | ✅ **Labels:** BV → „Objekt/BV“, Objekt → „Tür/Tor“ in UI (Menü, Titel, Formulare). URLs unverändert. | 10.2, 10.12 | 1 T |
| | E2 | ✅ **Tür/Tor direkt unter Kunde:** Schema erweitern (`objects.bv_id` optional, ggf. `customer_id` oder Default-Objekt/BV). UI: Tür unter Kunde anlegbar wenn keine Objekte/BV. | 10.2, 10.12 | 1,5–2 T |
| | E3 | ✅ **Verschieben von Türen:** Dropdown „Zuordnung: [Objekt/BV wählen]“ pro Tür; Protokolle/Fotos/Dokumente bleiben der Tür zugeordnet. | 10.2, 10.12 | 1 T |
| | E4 | ✅ **Wartungsvertrag:** Tabelle/Felder (Vertragsnummer JJJJ/0000, Datum Beginn, Ende); unter Kunde (wenn keine Objekte/BV) oder unter Objekt/BV. Mehrere Verträge pro Kunde/Objekt/BV. | 10.10, 10.12 | 1,5–2 T |
| **F – Kundenportal** | F1 | ✅ **Tabelle `portal_user_object_visibility`** (Whitelist); RLS/API im Portal: nur sichtbare Objekte/BV liefern. Standard: alle. | 10.3, 10.12 | 1,5–2 T |
| **G – Historie** | G1 | ✅ **Historie:** Details on-demand (Klick auf Zeile → RPC `get_audit_log_detail(id)`). Optional: audit_log um Vorher/Nachher erweitern. | 10.4, 10.12 | 1–2 T |
| **H – Stammdatenimport** | H1 | ✅ **Menüpunkt „Import“** (oder unter Kunden). CSV/Excel-Upload, Spalten-Mapping (Firma, PLZ, Straße, Stadt, Mail, Tel, Anprechpartner, Objekt/BV). Objekt/BV verknüpfen oder neu anlegen; Fehlerzeilen überspringen, Fehlerliste am Ende. | 10.7, 10.12 | 2–3 T |
| **I – Mobile (Capacitor + APK/iOS)** | I1 | ✅ **Capacitor** einbinden; Web-App in native Hülle; **Android-APK** + **iOS** von Anfang an mitgeplant. Parallel zur PWA. (Siehe Abschnitt 5: Mobile-Build.) | 10.1, 10.12 | 3–5 T |
| | I2 | Optional: **Bluetooth-Drucker-Plugin** für QR-Etikettendruck aus der App (**§11.4**). | 10.1, docs | 1–2 T |
| **J – Optionale Auswertungen & Sonstiges** | J1 | Wartungsplanung / Erinnerungen (z. B. 30 Tage vorher), optional E-Mail. | 7 | 3–5 T |
| | J2 | Wartungsstatistik / Auswertung (pro Kunde/BV/Objekt, überfällige Wartungen). | 7 | 3–4 T |
| | J3 | Export für Buchhaltung (CSV/Excel). | 7 | 2–3 T |
| | J4 | Schnellzugriff / Zuletzt bearbeitet auf Startseite. | 7 | 1–2 T |
| | J5 | ✅ **Erweiterte Filter Kundenliste** (PLZ, Wartungsstatus, BV-Anzahl). | 7 | 2 T |
| | J6 | Umbau Wartung (MVP) – Auftrag → Monteursbericht → Freigabe → Portal (Phasen 1–4, Detail in Abschnitt 7). | 7 | 15–20 T |
| | J7 | Mängel-Follow-up, Kalender-Sync (iCal), Bulk-Operationen, Portal Push-Benachrichtigungen. | 7 | je 2–3 T |
| | J8 | ✅ **Lizenzportal: Daten-Export bei Mandantenkündigung;** ggf. manuelle Statusabfrage pro Mandant. (Export: Button „Daten exportieren (JSON, z. B. bei Kündigung)“ in Mandanten, `exportService.ts`.) | 9.11, 9.12 | 1–2 T |
| | J9 | ✅ **Ladezeiten-Monitoring / Performance-Dashboard:** `src/pages/Ladezeiten.tsx` – Sync- und Startseiten-Metriken, grafische Anzeige (Admin). | 5 (Supabase-Region), 10.12 | 1–2 T |
| | J10 | **Bug-Erfassungsmodul:** Automatische Erfassung von Fehlern und Speicherung in DB; Admin unter **System → Fehlerberichte**. **§11.3.** | docs | 1–2 T |
| **Lizenzportal** | L1 | ✅ **Lizenzportal-Supabase** anlegen, Schema `supabase-license-portal.sql` ausführen (operativer Schritt, siehe B3). | 9.17 | 0,5 T |
| | L2 | ✅ **Status pro Mandant:** Letzte Grenzüberschreitungs-Meldung in Mandantenliste; Link „Grenzüberschreitungen anzeigen“ (Filter nach Mandant). | 9.12 | 1 T |
| | L3 | ✅ **Daten-Export bei Kündigung:** Button „Export“ pro Mandant → JSON-Download (Mandant, Lizenzen, limit_exceeded_log). | 9.11 | 1–2 T |

**Hinweis:** Arbeitszeiterfassung (Modul) und 2FA sind bereits implementiert. Die Tabelle oben enthält nur **noch offene** Punkte. Aufwand „T“ = Tage (Schätzung, 1 Entwickler).

#### Status B3 / L1 (Lizenzportal-Supabase – operativer Schritt)

B3 und L1 sind derselbe Schritt: **ein separates Supabase-Projekt nur für das Lizenzportal** anlegen und das Schema einspielen. Die Haupt-App (Vico Web-App) nutzt weiterhin ihr eigenes Supabase-Projekt; die **Admin-App** (`admin/`) spricht mit dem **Lizenzportal-Supabase**.

**Checkliste – erledigt, wenn:**

| # | Aufgabe | Erledigt? |
|---|---------|------------|
| 1 | Neues Supabase-Projekt im Dashboard anlegen (z. B. Name „vico-license-portal“, Region wählen). | |
| 2 | Im neuen Projekt: **SQL Editor** → Inhalt von `supabase-license-portal.sql` einfügen und ausführen (idempotent). | |
| 3 | **Auth:** E-Mail bestätigen ggf. deaktivieren (Settings → Auth), Redirect-URLs für Admin-App eintragen (z. B. `https://admin.vico-tueren.de/**`, `http://localhost:*/**`). | |
| 4 | **API Keys** kopieren: Project URL + anon key (für Admin-Frontend). Optional: service_role key für Netlify/Backend (Lizenz-API). | |
| 5 | Admin-App konfigurieren: `admin/.env` (lokal) bzw. Netlify-Umgebungsvariablen: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` = Werte aus dem **Lizenzportal**-Projekt (nicht Haupt-App). | |
| 6 | Optional (Lizenz-API aus Haupt-App/Netlify): `SUPABASE_LICENSE_PORTAL_URL` + `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` setzen. | |
| 7 | Test: Admin-App starten (`cd admin && npm run dev`), Login mit neuem Benutzer (wird über Trigger als `profiles.role = 'admin'` angelegt). Mandanten/Lizenzen anlegen prüfen. | |

**Status im Repo prüfen:** Im Repo liegt **kein** `.env` (nur `admin/.env.example`). Ob B3/L1 erledigt sind, erkennst du nur außerhalb des Repos: zweites Supabase-Projekt vorhanden? Admin-App mit korrekten Env-Variablen deployt und Login funktionsfähig? Wenn ja → B3/L1 in der Roadmap als ✅ markieren.

#### Verifizierung „bereits umgesetzt?“ (Stand Prüfung)

Alle Punkte ohne ✅ wurden im Code geprüft. Ergebnis:

| Punkt | Im Code geprüft | Ergebnis |
|-------|------------------|----------|
| **B3 / L1** | Nicht prüfbar (operativer Schritt: zweites Supabase-Projekt). | Nur manuell prüfbar (Checkliste oben). |
| **I1** Capacitor | `@capacitor/core`, `@capacitor/cli`, `android`, `ios`; `capacitor.config.ts`; Scripts `build:mobile`, `cap:sync`, `cap:android`, `cap:ios`. | ✅ Umgesetzt. |
| **I2** Bluetooth-Drucker | Kein Plugin/Code. | ❌ Nicht umgesetzt. |
| **J1** Wartungsplanung/Erinnerungen | `get_maintenance_reminders` (30-Tage-Status), Anzeige Startseite/Kunden. | ⚠️ Teilweise: Erinnerungsliste & „due_soon“ ja, **optionale E-Mail** fehlt. |
| **J2** Wartungsstatistik | Keine dedizierte Statistik-/Auswertungsseite. | ❌ Nicht umgesetzt. |
| **J3** Export Buchhaltung | Nur Import (CSV), kein Export für Buchhaltung. | ❌ Nicht umgesetzt. |
| **J4** Schnellzugriff/Zuletzt bearbeitet | Startseite: Aufträge, Erinnerungen; kein „Zuletzt bearbeitet“. | ❌ Nicht umgesetzt. |
| **J5** Erweiterte Filter Kundenliste | `Kunden.tsx`: Filter-Panel PLZ, Wartungsstatus, BV Min/Max. | ✅ Umgesetzt (März 2026). |
| **J6** Umbau Wartung MVP | `order_completions`, Auftragsdetail, Unterschriften vorhanden. | ⚠️ Teilweise: Monteursbericht ja; Freigabe-Workflow & Portal-Integration offen. |
| **J7** Mängel-Follow-up, iCal, Bulk, Push | Kein iCal, kein Mängel-Tracking, keine Bulk-UI, kein Portal-Push. | ❌ Nicht umgesetzt. |
| **J8** Lizenzportal Export Kündigung | `admin/exportService.ts`, Button „Daten exportieren“ in Mandanten. | ✅ Umgesetzt → als erledigt markiert. |
| **J9** Ladezeiten-Dashboard | `src/pages/Ladezeiten.tsx` – Sync- und Startseiten-Metriken, grafisches Dashboard (Admin). | ✅ Umgesetzt. |

---

## 8. Projektstruktur

```
Vico/
├── src/              # Web-App (Vite + React)
├── portal/           # Kundenportal (separates Vite-Projekt)
├── admin/            # Lizenzportal (separates Vite-Projekt)
├── public/           # Favicon, Logo, Checkliste-PDF, Vico-Dokumentation.pdf (via generate-vico-pdf)
├── scripts/          # generate-checklist-webapp-pdf.mjs, generate-vico-pdf.mjs
├── supabase/         # Edge Functions
├── supabase-complete.sql
├── Vico.md           # Diese Dokumentation
├── BENUTZERANLEITUNG.md
├── docs/             # Weitere Konzept- und Planungsdokumente (siehe Abschnitt 10.11)
└── …
```

---

## 9. Plan: Mandantenfähigkeit & Lizenzportal

**Ziel:** App mandantenfähig machen, Lizenzportal als zentrale Steuerung, individuelle Mandanten-Instanzen mit eigenem Corporate Design.

### 9.1 Übersicht der geplanten Änderungen

| Bereich | Geplante Änderung |
|---------|-------------------|
| **App-Name** | Auf später verschoben (Frage 1) |
| **Lizenzportal** | Mandanten anlegen, Stammdaten, Corporate Design, Module, Lizenzvergabe |
| **Lizenz-Aktivierung** | Lizenznummer in App eingeben → Abruf per API → Grenzen lokal gesetzt |
| **App ohne Lizenz** | Aktivierungs-Screen, Impressum, Datenschutz, ggf. Hilfe |
| **Module** | Alle Module über Lizenzportal bereitstellen |
| **Demokunde** | Mandant im Lizenzportal mit allen Modulen |

### 9.2 App-Name & Personalisierung

**Konzept:**
- **Projektname** (technisch): Einprägsam, funktionsbasiert – „Vico“ ist Firmenname des ursprünglichen Auftraggebers, daher nicht als App-Name geeignet.
- **Kundenseitig:** App wird personalisiert – z.B. beim Kunden Vico: „Vico Türen und Tore App“.
- **Daten aus Lizenzportal:** Firmenname, Adresse, etc. ersetzen feste Werte in der App durch Platzhalter; Abruf aus Lizenzportal.
- **Farbliche Anpassung:** Individuell pro Mandant, Steuerung über Lizenzportal.

**Frage 1:** Welcher Projektname? (Vorschläge: WartungsLog, TürWart, TorCheck, MängelLog, WartungsApp – oder eigener Vorschlag?)  
→ **Entscheidung:** Bleibt auf später verschoben. App-Name kommt aus API; bei Festlegung Anpassung in Lizenzportal, package.json, Manifest. **§11.1 §1.**

**Frage 2:** Soll die App branchenspezifisch bleiben (Türen & Tore) oder generisch werden?  
→ **Entscheidung:** Hybrid – Kern branchenspezifisch, Labels konfigurierbar für spätere Erweiterung.

---

### 9.3 Mandanten-Anlage im Lizenzportal

**Geplante Funktionen:**
- Button „Neuer Mandant“
- Stammdaten: Name, Adresse, Kontakt, etc.
- Erzeugung einer neuen App-Instanz/Version für diesen Mandanten

**Frage 3:** Was bedeutet „neue Version der App“ konkret?
- **A)** Separate Supabase-Projekt + separate Netlify-Site pro Mandant (vollständige Isolation)
- **B)** Ein Supabase-Projekt (Multi-Tenant), Mandanten per `tenant_id` getrennt; eine App-URL mit Mandantenerkennung
- **C)** Eine Codebasis, mehrere Netlify-Sites (Subdomains), pro Mandant eigenes Supabase-Projekt
- **D)** Anderes Modell?

→ **Entscheidung:** C – eine Codebasis, mehrere Netlify-Sites, pro Mandant eigenes Supabase-Projekt. Individuelle Domain pro Mandant (z.B. app.amrtech.de, app.kunde.de). Vollständige Datenisolation, DSGVO-konform.

**Frage 4:** Welche Stammdaten pro Mandant sollen im Lizenzportal erfasst werden?

**Antwort – rechtlich erforderliche und empfohlene Stammdaten:**

| Kategorie | Feld | Rechtliche Grundlage | Pflicht? |
|-----------|------|----------------------|----------|
| **Impressum (DDG § 5)** | Firmenname | DDG § 5 | Ja |
| | Vollständige Anschrift (Straße, Hausnr., PLZ, Ort) | DDG § 5 | Ja |
| | Rechtsform (GmbH, AG, etc.) | DDG § 5 (jur. Personen) | Ja |
| | Vertreten durch (Vertretungsberechtigte) | DDG § 5 | Ja |
| | E-Mail | DDG § 5 | Ja |
| | Telefon (mind. 1 weiterer Kontaktweg) | DDG § 5 | Ja |
| | Handelsregister (Amtsgericht + Registernummer) | DDG § 5 | Ja, wenn eingetragen |
| | **USt-ID oder Wirtschafts-ID** | DDG § 5 Abs. 1 Nr. 6 | Ja, falls vorhanden |
| | Stamm-/Grundkapital | DDG § 5 (GmbH/AG) | Ja, wenn relevant |
| **Nicht erforderlich** | Steuernummer | — | Nein (nur USt-ID/W-IdNr.) |
| **Datenschutz (DSGVO)** | Verantwortlicher (Name, Kontakt) | Art. 13/14 DSGVO | Ja |
| | Kontakt DSB (falls vorhanden) | Art. 13 Abs. 1 lit. b | Ja, wenn bestellt |
| **Corporate Design** | Logo, Favicon | — | Empfohlen |
| | Primärfarbe, Sekundärfarbe | — | Empfohlen |
| | Schriftart | — | Optional |
| **Technisch** | App-Domain (z.B. app.amrtech.de) | — | Ja |
| | Portal-Domain (z.B. portal.amrtech.de) | — | Ja |
| | App-Name (personalisiert) | — | Empfohlen |

**Hinweise:**
- **Steuernummer:** Nicht im Impressum erforderlich. Nur **USt-ID** (wenn zugeteilt) oder alternativ **Wirtschafts-Identifikationsnummer** (W-IdNr., automatisch vom BZSt).
- **Kundenportal:** Impressum und Datenschutzerklärung müssen vor Registrierung erreichbar sein. Der Mandant ist Verantwortlicher; Supabase/Netlify sind Auftragsverarbeiter (AVV gem. Art. 28 DSGVO).
- **DDG:** Seit 14.05.2024 ersetzt das Digitale-Dienste-Gesetz (DDG) das TMG; Verweis in Impressum ggf. auf § 5 DDG anpassen.

**USt-ID/W-IdNr.:** Impressum hat Feld `IMPRESSUM.vat_id` – bei Vorhandensein eintragen, Abschnitt wird angezeigt. Bei Mandantenfähigkeit kommt Wert aus API (`impressum.vat_id`).

**Individuelle Domain/Subdomain pro Mandant:** Der Kunde hat eine individuelle Domain oder Subdomain, über die er App und Kundenportal erreicht. Beispiel: `app.amrtech.de` (App), `portal.amrtech.de` (Kundenportal). Hosting erfolgt bei uns; der Endkunde sieht beim Aufruf seine persönliche Domain. Die Weiterleitung (CNAME) zu unserem Hosting richtet der Kunde bei seinem Domainanbieter selbst ein – wir liefern die Angaben für die Weiterleitung (Ziel-URL). Im Lizenzportal steuerbar: pro Mandant `app_domain` und `portal_domain`.

**Ablauf Domain-Einrichtung:**
1. Im Lizenzportal: `app_domain` und `portal_domain` pro Mandant erfassen (z.B. app.kunde.de, portal.kunde.de)
2. Netlify: Custom Domain für Mandanten-Site hinzufügen
3. Kunde erhält von uns: Ziel-Adresse (z.B. `mandant-xyz-app.netlify.app`) + Anleitung
4. Kunde richtet bei seinem Domainanbieter ein: CNAME `app.kunde.de` → `mandant-xyz-app.netlify.app`

**Frage 5:** Soll jeder Mandant eine eigene Supabase-Datenbank haben (vollständige Datenisolation) oder eine gemeinsame DB mit tenant_id?

→ **Entscheidung:** Ja – durch Modell C bereits festgelegt: Pro Mandant eigenes Supabase-Projekt, vollständige Datenisolation.

---

### 9.4 Corporate Design pro Mandant

**Geplante Steuerung im Lizenzportal:**
- Logo
- Primärfarbe / Sekundärfarbe
- Schriftart (optional)
- Favicon

**Frage 6:** Welche Design-Anpassungen sind erforderlich? (Logo, Farben, Schrift – oder mehr?)

→ **Entscheidung:** Logo, Primärfarbe, Favicon als Pflicht. Sekundärfarbe und Schriftart optional. App-Name (personalisiert) bereits in Stammdaten. Aktuell nutzt die App `--vico-primary`, `--vico-primary-hover`, Logo (`/logo_vico.png`), PWA `theme_color` – diese werden mandantenfähig gemacht.

**Frage 7:** Soll das Design zur Laufzeit per API geladen werden (App fragt Mandanten-Config ab) oder bei der Bereitstellung fest eingebaut (Build pro Mandant)?

→ **Entscheidung:** Zur Laufzeit – die Design-Config (Logo-URL, Farben, App-Name) wird zusammen mit der Lizenz beim Lizenz-Abruf geliefert. Ein Build-Deploy pro Codebasis, keine separaten Builds pro Mandant. Änderungen im Lizenzportal wirken nach nächstem App-Start/Refresh.

---

### 9.5 Lizenzvergabe & Aktivierung

**Geplanter Ablauf:**
1. Lizenzportal erzeugt Lizenznummer für Mandanten
2. In der App: Lizenznummer eingeben (z.B. bei erstem Start oder in Einstellungen)
3. App ruft per API Lizenz vom Lizenzportal ab
4. Lizenz wird lokal gespeichert (Grenzen: max. Nutzer, max. Kunden, Module, etc.)
5. App verwaltet Grenzen selbst; bei Überschreitung: Meldung an Lizenzportal
6. Weitere Lizenzänderungen: manueller Push aus dem Lizenzportal

**Frage 8:** Wo soll die Lizenznummer eingegeben werden? (Login-Screen, separater Aktivierungs-Screen, Einstellungen nur für Admin?)

→ **Entscheidung:** Separater Aktivierungs-Screen vor dem Login – bei erstem Start oder wenn keine gültige Lizenz vorhanden ist. Admin kann Lizenz in Einstellungen ändern/erneuern.

**Frage 9:** Soll die Lizenz einmalig aktiviert werden oder bei jedem App-Start erneut geprüft? (Konzept: „nur bei Aktivierung“ – wie oft soll die Aktivierung erfolgen?)

→ **Entscheidung:** Lizenz lokal cachen, bei jedem App-Start prüfen (kurzer API-Call oder lokale Gültigkeitsprüfung). Optional: periodische Hintergrund-Prüfung (z.B. täglich), um Ablauf rechtzeitig zu melden. **Prüfintervall pro Mandant im Lizenzportal konfigurierbar** (z.B. bei jedem Start, täglich, wöchentlich).

**Frage 10:** Wie soll die Meldung bei Grenzüberschreitung ans Lizenzportal erfolgen? (Webhook, periodischer Abgleich, E-Mail an Admin?)

→ **Entscheidung:** API-Call ans Lizenzportal bei Erkennung der Grenzüberschreitung (z.B. beim Anlegen eines Nutzers über Limit). Lizenzportal speichert Meldung; Admin wird im Portal benachrichtigt; optional E-Mail-Benachrichtigung. **Manuelle Statusabfrage im Lizenzportal:** Admin kann pro Mandant „Aktuellen Status abfragen“ auslösen – Lizenzportal ruft dann die Mandanten-Supabase oder einen App-Endpoint ab und zeigt den Nutzungsstand (z.B. 8/10 Nutzer). *Technisch:* Lizenzportal benötigt Zugriff auf Mandanten-Supabase (z.B. Service-Role) oder die Mandanten-App exponiert einen Status-Endpoint.

**Grenzwarnungen (UX):** Nutzer rechtzeitig vor Erreichen des Limits informieren:

| Schwellwert | Verhalten | Ort |
|-------------|-----------|-----|
| **80 %** | Hinweis: „Sie haben X von Y Nutzerlizenzen genutzt. Bei Bedarf Lizenz erweitern.“ | Einstellungen, ggf. Dashboard |
| **90 %** | Deutlicher Hinweis (z.B. gelb/orange): „Noch 1 Lizenz frei. Bitte rechtzeitig erweitern.“ | Beim Öffnen der Benutzerverwaltung, Einstellungen |
| **100 %** | Block + Meldung: „Limit erreicht. Bitte Lizenz im Lizenzportal erweitern.“ | Beim Versuch, weiteren Nutzer anzulegen |

Schwellwerte (80 %, 90 %) pro Mandant im Lizenzportal konfigurierbar oder fest. Betrifft alle limitierten Ressourcen (Nutzer, Kunden, ggf. Objekte).

**Frage 11:** Was bedeutet „manueller Push“ aus dem Lizenzportal? (Admin klickt „Lizenz an Mandant senden“ → App pollt oder erhält Push?)

→ **Entscheidung:** App pollt bei Start und bei periodischer Prüfung. Kein Echtzeit-Push – bei nächstem App-Start/Refresh wird die aktualisierte Lizenz geladen. Ausreichend für Lizenzänderungen (Verlängerung, Modul-Upgrade).

**Frage 12:** Soll die Lizenz-API öffentlich erreichbar sein oder nur von bekannten App-Instanzen (z.B. per API-Key)?

→ **Entscheidung:** API mit API-Key oder Lizenznummer als Authentifizierung – nicht vollständig öffentlich. Lizenznummer + ggf. Mandanten-ID reichen zur Validierung; zusätzlicher API-Key pro Mandanten-Instanz möglich für höhere Sicherheit.

---

### 9.6 Module bereitstellen

**Geplante Funktionen:**
- Alle Module im Lizenzportal schaltbar
- Pro Mandant: welche Module aktiv sind

**Frage 13:** Welche Module gibt es aktuell bzw. sind geplant? (z.B. Kunden, Wartungsprotokolle, Aufträge, Arbeitszeiterfassung, Historie, Kundenportal, Benutzerverwaltung, …)

→ **Entscheidung:** Aktuell: Kunden, Wartungsprotokolle, Auftrag, Suche, Scan, Profil, Einstellungen, Benutzerverwaltung, Historie (Admin), Arbeitszeiterfassung. Geplant: Kundenportal (separate App), ggf. Monteursbericht, Buchhaltungs-Export. Alle außer Einstellungen/Profil über Lizenz schaltbar.

**Frage 14:** Soll es „Basis-Module“ geben, die immer enthalten sind, auch ohne Lizenz? Oder ist ohne Lizenz wirklich alles leer?

→ **Entscheidung:** Ohne Lizenz: nur Aktivierungs-Screen, Impressum, Datenschutz, ggf. Hilfe-Link. Keine fachlichen Module – Einstellungen/Profil erst nach Lizenz-Aktivierung. Keine Basis-Module.

---

### 9.7 App ohne Lizenz

**Geplante Funktionen:**
- Ohne Lizenz: App leer, nur Grundfunktionen

**Frage 15:** Welche Grundfunktionen sollen ohne Lizenz verfügbar sein?
- **Login** (oder erst nach Aktivierung)?
- **Aktivierungs-Screen** (Lizenznummer eingeben)?
- **Hilfe/Support-Link**?
- **Impressum/Datenschutz**?
- Sonstiges?

→ **Entscheidung:** Ohne Lizenz: Aktivierungs-Screen (Lizenznummer eingeben), Impressum, Datenschutz, ggf. Hilfe/Support-Link. Kein Login – erst nach erfolgreicher Lizenz-Aktivierung wird der Login angezeigt.

**Frage 16:** Soll der Benutzer ohne Lizenz überhaupt etwas sehen können, oder nur einen „Bitte Lizenz aktivieren“-Screen?

→ **Entscheidung:** Ja – Aktivierungs-Screen mit Lizenznummer-Eingabe, plus Links zu Impressum, Datenschutz, ggf. Support. Kein „nur“-Block – der Nutzer kann aktivieren und hat Zugang zu rechtlich erforderlichen Seiten.

---

### 9.8 Demokunde im Lizenzportal

**Geplante Funktionen:**
- Demokunde als Mandant im Lizenzportal
- Alle Module für Demokunde schaltbar

**Frage 17:** Soll der Demokunde ein „echter“ Mandant sein (eigene Supabase/Instanz) oder ein spezieller Modus innerhalb eines bestehenden Mandanten?

→ **Entscheidung:** Echter Mandant – eigene Supabase + eigene Netlify-Site (z.B. `demo.amrtech.de`). Einfacher zu warten, klare Trennung, keine Sonderlogik in der App.

**Frage 18:** Soll die 24h-Löschung für Demo-Daten beibehalten werden? Wie soll das mit dem Mandantenmodell zusammenspielen?

→ **Entscheidung:** Ja – beim Demokunden-Mandanten: Cronjob oder periodischer Job löscht Daten älter als 24h (oder konfigurierbar). Rolle „Demo“ bleibt für Nutzer, die nur eigene Daten sehen; Mandanten-Isolation bleibt unberührt.

**Frage 19:** Soll der Demokunde öffentlich zugänglich sein (z.B. `demo.amrtech.de`) oder nur per Einladung/Link?

→ **Entscheidung:** Öffentlich – `demo.amrtech.de` mit Login per Demo-Account (z.B. demo@demo.de / Testpasswort). Öffentlich erreichbar, aber geschützter Zugang; verhindert anonyme Änderungen.

---

### 9.9 Technische Architektur (Vorschlag)

```
┌─────────────────────────────────────────────────────────────────┐
│  Lizenzportal (lizenz.amrtech.de)                                 │
│  - Mandanten verwalten                                            │
│  - Stammdaten, Corporate Design, Module, Lizenz                  │
│  - Domain pro Mandant: app_domain, portal_domain                  │
│  - API: Lizenz abrufen, Grenzüberschreitung melden                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API (Lizenznummer → Lizenz)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Mandanten-App (app.amrtech.de, app.kunde.de, …)                  │
│  Mandanten-Portal (portal.amrtech.de, portal.kunde.de, …)        │
│  - Individuelle Domain/Subdomain pro Mandant                      │
│  - Kunde richtet CNAME bei seinem Domainanbieter ein              │
│  - Hosting bei uns; Endkunde sieht seine Domain                   │
└─────────────────────────────────────────────────────────────────┘
```

**Frage 20:** Passt diese grobe Architektur, oder gibt es andere Vorstellungen (z.B. eine App-URL für alle Mandanten mit Mandantenauswahl)?

→ **Entscheidung:** Ja – eine App-URL pro Mandant (Subdomain), keine Mandantenauswahl in einer gemeinsamen App. Klare Trennung, bessere DSGVO-Isolation.

---

### 9.10 Offene Punkte & weitere Vorschläge

**Entscheidung (abgelaufene Lizenz):** Schonfrist Nur-Lesen (konfigurierbare Tage), danach Redirect/Sperre. **Steuerung der Schonfrist (Anzahl Tage) im Lizenzportal** pro Mandant/Lizenz. **§11.1 §2.**

**Vorschlag 1 – Lizenz-Caching:** Lizenz nach Aktivierung lokal speichern; optional periodische Prüfung (z.B. täglich) ob Lizenz noch gültig ist.

**Vorschlag 2 – Lizenz-Trial:** Optional: Mandant erhält 14 Tage Trial mit allen Modulen; danach Einschränkung ohne Verlängerung.

**Vorschlag 3 – Mandanten-Self-Service:** Sollen Mandanten selbst ihre Lizenz verlängern oder Stammdaten ändern können, oder nur über das Lizenzportal durch den Betreiber?

**Vorschlag 4 – Daten-Export:** Bei Mandantenkündigung: Export aller Daten als CSV/JSON; optional automatische Löschung nach Frist.

**Frage 21:** Welche dieser Vorschläge sind relevant oder sollen berücksichtigt werden?

→ **Entscheidung:** **Umsetzen:** Vorschlag 1 (Lizenz-Caching), Vorschlag 4 (Daten-Export). **Trial (Vorschlag 2):** Ja – 14 Tage, alle Module; genaue Trial-Definition bei Umsetzung. **Self-Service (Vorschlag 3):** Erstmal nur Betreiber; später Self-Service – **Ort in Haupt-App:** Einstellungen, Bereich „Stammdaten / Impressum“ (nur Admin). **§11.1 §3, §4.**

---

### 9.11 Phasen-Vorschlag

| Phase | Inhalt | Aufwand (Schätzung) |
|-------|--------|---------------------|
| 1 | Lizenzportal: Mandanten-CRUD, Stammdaten | 3–5 T |
| 2 | Lizenz-API (Lizenznummer → Lizenz), Aktivierung in App | 2–3 T |
| 3 | Corporate Design pro Mandant (Logo, Farben) | 2–3 T |
| 4 | App ohne Lizenz: Grundfunktionen, Aktivierungs-Screen | 1–2 T |
| 5 | Module über Lizenzportal steuerbar | 2–3 T |
| 6 | Demokunde als Mandant im Lizenzportal | 2–3 T |
| 7 | Grenzüberschreitung → Meldung an Lizenzportal | 1–2 T |
| 8 | Lizenz-Update (App pollt bei Start) | 1 T |
| 9 | Daten-Export bei Mandantenkündigung | 1–2 T |

**Frage 22:** Passt diese Reihenfolge, oder gibt es andere Prioritäten?

→ **Entscheidung:** Reihenfolge passt. Phase 4 (App ohne Lizenz) könnte vor Phase 3, falls schneller sichtbarer Fortschritt gewünscht – aber technisch sinnvoll, erst Lizenz-API (Phase 2) zu haben, bevor der Aktivierungs-Screen (Phase 4) implementiert wird.

---

### 9.12 Umbau-Schritte (konkrete Aufgaben)

**Strategie:** Bestehendes erweitern (Umbau), nicht neu aufbauen. Geschätzter Gesamtaufwand: 12–18 T.

#### App (src/)

| Nr. | Aufgabe | Dateien/Stellen | Aufwand |
|-----|---------|-----------------|---------|
| 1 | **Aktivierungs-Screen** – Lizenznummer-Eingabe, Button „Aktivieren“, Links zu Impressum/Datenschutz | Neue Komponente `AktivierungsScreen.tsx`, Route `/aktivierung` | 1–2 T |
| 2 | **Lizenz-API-Client** – Fetch Lizenz + Design-Config per Lizenznummer (API-Key) | Neue Datei `lib/licensePortalApi.ts` | 1–2 T |
| 3 | **LicenseContext anpassen** – Lizenz von API statt Supabase-RPC; Lizenznummer in localStorage; Prüfintervall aus Lizenz-Response | `LicenseContext.tsx`, `licenseService.ts` | 0,5–1 T |
| 4 | **Routing-Logik** – Keine gültige Lizenz → Aktivierungs-Screen; gültige Lizenz, nicht eingeloggt → Login; eingeloggt → App | `App.tsx`, `AuthLoader.tsx` | 0,5 T |
| 5 | **Design zur Laufzeit** – CSS-Variablen (`--vico-primary`), Logo-URL, PWA `theme_color` aus Lizenz-Response setzen | Neuer `DesignConfigContext` oder in `LicenseContext` integriert; `index.css`, `vite.config.ts` | 1–2 T |
| 6 | **ComponentGuard/Module** – `license.features` aus API statt `component_settings` (oder Hybrid) | `ComponentSettingsContext.tsx`, `ComponentGuard.tsx` | 0,5 T |
| 7 | **Grenzwarnungen** – Hinweise bei 80 %/90 % Nutzung; Block bei 100 % | `Benutzerverwaltung.tsx`, `Einstellungen.tsx`, ggf. `Startseite.tsx` | 1 T |
| 8 | **Lizenz in Einstellungen** – Admin kann Lizenznummer ändern/erneuern | `Einstellungen.tsx` | 0,5 T |

#### Lizenzportal (admin/)

| Nr. | Aufgabe | Dateien/Stellen | Aufwand |
|-----|---------|-----------------|---------|
| 9 | **Mandanten-CRUD** – Liste, Anlegen, Bearbeiten, Löschen | Neue Seiten `Mandanten.tsx`, `MandantForm.tsx` | 2–3 T |
| 10 | **Stammdaten pro Mandant** – Formular mit allen Pflichtfeldern (Impressum, Datenschutz, Design, **app_domain**, **portal_domain**) | `MandantForm.tsx`, Backend/Speicher | 1–2 T |
| 11 | **Corporate Design** – Logo-Upload, Primärfarbe, Favicon | In Mandanten-Form integriert | 0,5–1 T |
| 12 | **Module pro Mandant** – Checkboxen für Kunden, Wartung, Auftrag, etc. | In Mandanten-Form oder eigene Sektion | 0,5 T |
| 13 | **Lizenzvergabe** – Lizenznummer erzeugen, Ablaufdatum, Limits (Nutzer, Kunden) | Erweiterung `Lizenz.tsx` oder Mandanten-Detail | 1 T |
| 14 | **Manuelle Statusabfrage** – Button „Status abfragen“ pro Mandant | Mandanten-Detail; Backend: Supabase-Zugriff oder App-Endpoint | 1 T |
| 15 | **Grenzüberschreitung-Meldungen** – Anzeige eingehender Meldungen | Neue Sektion oder Dashboard | 0,5 T |

#### Lizenz-API (Backend)

| Nr. | Aufgabe | Technik | Aufwand |
|-----|---------|---------|---------|
| 16 | **Lizenz-Endpoint** – `GET /api/license?key=...&licenseNumber=...` → Lizenz + Design-Config | Netlify Function, Vercel, oder eigener Service | 2–3 T |
| 17 | **Grenzüberschreitung-Endpoint** – `POST /api/limit-exceeded` – Meldung speichern, optional E-Mail | Wie oben | 0,5 T |
| 18 | **Daten-Export** – Export aller Mandanten-Daten bei Kündigung | Script oder Admin-Funktion | 1–2 T |

#### Unverändert (Wiederverwendung)

- Business-Logik: Kunden, BVs, Objekte, Wartung, Aufträge, Suche, Scan
- Datenbank-Schema, RLS, RPCs (pro Mandant eigene Supabase)
- Auth, Rollen, Offline, Sync
- Portal (`portal/`), bestehende UI-Komponenten

---

### 9.13 Technische Vorab-Entscheidungen (geklärt vor Phase 1)

**Speicherort Mandanten-Daten:** Eigenes Supabase-Projekt für das Lizenzportal. Tabellen z.B. `tenants`, `licenses`. Admin-App (`admin/`) verbindet sich mit diesem Supabase.

**Lizenzportal-Hosting:** Netlify, separate Site für `admin/`. Domain: **lizenz.amrtech.de**.

**Lizenz-API-Standort:** Netlify Function bei der admin-Site. Liest aus dem Lizenzportal-Supabase.

**API-Response-Schema (Lizenz + Design + Impressum/Datenschutz):**

- **license:** tier, valid_until, max_users, max_customers, check_interval (`on_start` | `daily` | `weekly`), features (kunden, wartungsprotokolle, auftrag, …)
- **design:** app_name, logo_url, primary_color, secondary_color?, favicon_url
- **impressum:** company_name, address, contact, represented_by, register, vat_id (Stammdaten für Template)
- **datenschutz:** responsible, contact_email, dsb_email? (Stammdaten für Template)

App nutzt Templates für Impressum/Datenschutz, gefüllt mit Stammdaten aus der API (Option C – Hybrid).

---

### 9.14 Status: Alle Fragen geklärt

**Auf später verschoben (nicht blockierend):** Frage 1 (App-Name). Trial und Self-Service sind umgesetzt bzw. geplant – **§11.1 §3, §4.**

**Alle übrigen Fragen (2–22) beantwortet.** Planung vollständig für Start Phase 1.

---

### 9.15 2FA, Backup & Redundanz

#### 2FA – Empfohlene Orte

| Stelle | Priorität | Begründung |
|--------|-----------|------------|
| **Lizenzportal (admin/)** | Pflicht | Höchste Berechtigung – Mandanten, Lizenzen, Stammdaten. Kompromittierung = Zugriff auf alle Mandanten. |
| **App: Admin-Rolle** | Pflicht | Vollzugriff auf Kunden, Nutzer, Historie. Kritische Daten. |
| **App: Mitarbeiter** | Optional | Konfigurierbar pro Mandant. Weniger kritisch, aber sinnvoll bei sensiblen Branchen. |
| **Kundenportal** | Nein | Externe Kunden, nur eingeschränkte Daten. Kein 2FA nötig. |

**Technik:** Supabase unterstützt MFA nativ (TOTP via Authenticator-App, optional SMS). API: `enrollFactor`, `challengeFactor`, `verifyFactor`. Aufwand: 2–3 T pro App (Lizenzportal + App).

---

#### 2. Redundanz – Datenverlust vermeiden

| Ebene | Maßnahme | Beschreibung |
|-------|----------|--------------|
| **Supabase pro Mandant** | Tägliche Backups | Supabase: tägliche Backups (Free: begrenzte Aufbewahrung; Pro: 7 Tage). |
| **Off-Site-Backup** | Automatischer Export | `pg_dump` oder Supabase-Export → S3, Supabase Storage (anderes Projekt) oder externe Backuplösung. |
| **Lizenzportal-Supabase** | Backup | Mandanten-Daten, Lizenzen – kritisch. Täglicher Export. |
| **Storage (Fotos, Dokumente)** | Replikation | Supabase Storage: optional Cross-Region- oder S3-Sync. |

**Redundanz-Strategie:** Primär: Supabase. Sekundär: Täglicher Dump in externes Storage (z.B. S3, Backblaze B2). Kein Single Point of Failure.

---

#### 3. Automatisches Backup

| Option | Aufwand | Kosten | Aufbewahrung |
|--------|---------|--------|--------------|
| **Supabase Pro** | 0 | 25 $/Monat | 7 Tage Point-in-Time |
| **GitHub Actions + pg_dump** | 1–2 T | 0 | Beliebig (z.B. 30 Tage) |
| **Supabase Edge Function** | 1–2 T | 0 | Dump → Storage |
| **Externer Cron (z.B. Railway)** | 1 T | 0–5 € | Beliebig |

**Empfehlung:** GitHub Actions + `supabase db dump` (oder `pg_dump` mit DB-URL). Täglich ausführen, Dump in S3/Backblaze B2 speichern. Retention: 30 Tage (oder konfigurierbar). Pro Mandanten-Supabase eine eigene Action.

**Wichtig:** Backups niemals in öffentlichen Repositories speichern. Dumps verschlüsselt oder in privatem Storage ablegen.

---

### 9.17 Implementierung: Mandantenfähigkeit Phase 1 (gestartet)

**Erledigt:**
- `supabase-license-portal.sql` – Schema für Lizenzportal-Supabase (tenants, licenses, profiles, limit_exceeded_log)
- Aktivierungs-Screen (`/aktivierung`) – Lizenznummer-Eingabe, Links Impressum/Datenschutz
- `licensePortalApi.ts` – API-Client, Speicherung Lizenznummer in localStorage
- `LicenseGate` – Prüfung bei API-Modus, Weiterleitung zu Aktivierung wenn nötig
- `LicenseContext` – Unterstützt API-Modus (fetch von Lizenz-API) und Legacy (Supabase RPC)
- Routes `/impressum`, `/datenschutz` in App
- Supabase Edge Function `supabase-license-portal/supabase/functions/license` – GET /license?licenseNumber=... (Option D; Netlify-Funktion als Fallback vorhanden)
- Admin: Mandanten-CRUD (Liste, Anlegen, Bearbeiten, Löschen), Navigation

**Erledigt (Lizenzvergabe):**
- Admin: Lizenzvergabe pro Mandant (Lizenznummer erzeugen, zuweisen, Tier, Limits, Features, Prüfintervall)
- Lizenz-Seite: Liste aller Lizenzen, Neue Lizenz anlegen, Bearbeiten, Löschen
- MandantForm: Lizenzen-Sektion beim Bearbeiten, Link „Lizenz anlegen“ mit vorausgewähltem Mandanten

**Erledigt (Lizenz in Einstellungen + Design):**
- App: Lizenznummer in Einstellungen änderbar (Admin, API-Modus)
- Design zur Laufzeit: CSS-Variablen (--vico-primary), Logo-URL, Favicon, App-Name, theme-color aus Lizenz-API

**Hinweise:**
- Vor Release auf Netlify: Lizenz-Architektur nochmals überdenken (aktuell: Supabase Edge Function).
- Ladezeiten Lizenzportal: zum Teil noch lang – wird beobachtet.

**Nächste Schritte:**
- Lizenzportal-Supabase-Projekt anlegen, Schema ausführen
- Grenzwarnungen (80 %/90 %/100 %) in Benutzerverwaltung
- **Verhalten bei abgelaufener Lizenz** definieren und ggf. umsetzen (Hinweis, Sperre, Frist)

---

### 9.16 Implementierung: Backup & 2FA

#### GitHub Actions Backup (`.github/workflows/db-backup.yml`)

- **Trigger:** Täglich 3:00 UTC, manuell via `workflow_dispatch`
- **Secrets:** `SUPABASE_DB_URL` (Connection String aus Supabase Dashboard → Settings → Database)
- **Optional S3:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BACKUP_BUCKET`, `AWS_REGION`
- **Artifact:** Dump wird 90 Tage aufbewahrt

#### 2FA (TOTP) – Implementiert

- **App:** Login mit MFA-Challenge, Profil-Einstellungen für 2FA-Aktivierung/-Deaktivierung
- **Admin:** Login mit MFA-Challenge
- **Supabase:** MFA muss im Dashboard aktiviert sein (Authentication → Providers → MFA)

---

## 10. Konzept: Geplante Änderungen Hauptapp

Die folgenden Punkte sind als Konzept für die Hauptapp vorgesehen. **Fachliche Konzepte** (Etikettendrucker, Arbeitszeit, Briefbogen, Entscheidungen, …) sind in **Abschnitt 11** gebündelt. Technische Optimierung: `docs/Optimierungsplan.md`.

### 10.1 React Native / APK

- **Ausbaustufe:** Erstellung einer nativen Android-APK über React Native (oder vergleichbaren Ansatz) einplanen.
- **Ziel:** Installierbare App aus einem Store oder als APK, bessere Integration z. B. für Bluetooth-Drucker (**§11.4**).

### 10.2 Begriffe & Datenmodell: BV → Objekt/BV, Objekt → Tür/Tor

- **BV umbenennen in „Objekt/BV“** (Anzeige und Konzept).
- **Aus dem bisherigen Objekt** wird die konkrete **Tür oder das Tor** (ein Objekt = eine Tür/ein Tor).
- **Objekt/BV** bleibt die organisatorische Ebene (Gebäude/Standort); darunter liegen die **Türen/Tore**.
- **Sonderfall Kunde ohne Objekt/BV:** Wenn ein Kunde keine Objekte/BVs hat, sollen **Türen/Tore direkt unter dem Kunden** angelegt werden können.
- **Barrierefreiheit / Verschieben:** Türen müssen **innerhalb des Kunden verschiebbar** sein (z. B. wenn nachträglich Objekt/BV angelegt wird und vorher alles nur unter dem Kunden hing). Drag & Drop oder explizite „Zuordnung ändern“-Funktion.

### 10.3 Kundenportal – Sichtbarkeit pro Portalzugang

- **Auswahl, welche Objekte/BV** einem Kundenportal-Zugang angezeigt werden.
- **Beispiel:** Zugang 1 sieht Objekt/BV 1, 2, 3; Zugang 2 sieht Objekt/BV 4, 5, 6. Zugang bleibt immer auf einen Kunden beschränkt.
- **Standard:** Alle Objekte/BV des Kunden sind ausgewählt; Admin kann die Sichtbarkeit pro Portalbenutzer einschränken.
- **Erweiterung:** In der Benutzerverwaltung bei Portalbenutzer: Zuordnung zum Kunden + optional welche Objekte/BV der Benutzer sieht (siehe 10.8).

### 10.4 Historie

- **Klar erkennbar:** Welche Änderungen gemacht wurden und ggf. was geändert wurde (Vorher/Nachher oder Änderungsdetails).
- **Performance:** Details **erst auf Anforderung** laden (z. B. Klick auf Zeile → nachladen). Immer auf Performance achten (Paginierung, schlanke Abfragen).

### 10.5 Menü & Einstellungen

- **Neuer Menüpunkt** (eigener Eintrag im Seitenmenü, nicht unter Einstellungen):
  - **Appversion**
  - **Lizenz**
  - **Anleitung**
- Diese Inhalte werden **aus Einstellungen entfernt** und nur noch unter dem neuen Menüpunkt geführt.
- **Einstellungen:** Punkt **Benutzerverwaltung** entfernen (doppelt; Benutzerverwaltung bleibt eigener Menüpunkt mit voller Funktionalität).
- **Benutzerverwaltung:** Punkt **Einstellungen** entfernen (kein Einstellungs-Link dort).

### 10.6 Benutzerverwaltung – Erweiterungen

- **Benutzer anlegen:** Auswahl **welche Rolle** der Benutzer erhält.
- **Portalbenutzer:** Anzeige/ Bearbeitung **zu welchem Kunden** der Portalbenutzer gehört; idealerweise zusätzlich **Auswahl der Objekte/BV**, auf die der Benutzer Zugriff hat (siehe 10.3).

### 10.7 Stammdatenimport

- **Format:** Excel/CSV.
- **Spalten (Beispiel):** Firma, PLZ, Straße, Stadt, Mail, Tel, Anprechpartner, Objekt/BV.
- Import-Wizard oder Upload mit Zuordnung der Spalten zu den App-Feldern.

### 10.8 Auftrag anlegen – Felder

- **Art** (z. B. Wartung, Reparatur, Montage, Sonstiges)
- **Kunde**
- **Objekt/BV:** Auswahl nur anzeigen, wenn der Kunde **mehrere** Objekte/BV hat; sonst Feld ausblenden bzw. nach Kundenauswahl prüfen und bei nur einem Objekt/BV automatisch setzen.
- **Datum**
- **Uhrzeit** (optional)
- **Zugewiesen an**
- **Beschreibung**

### 10.9 Auftrag abarbeiten (Dashboard → Auftragsdetail)

- Der **Mitarbeiter** kann den Auftrag **direkt aus dem Dashboard** abarbeiten (nicht nur anlegen/zugewiesen sehen).
- **Kein Popup:** Klick auf Auftrag öffnet eine **eigene Auftragsdetail-Seite** (keine Modal-Ansicht).
- **Inhalt der Auftragsdetail-Ansicht (z. B. Reparaturauftrag):**
  - Kundenstammdaten und Objekt/BV
  - Beschreibung aus dem Auftrag
  - **Feld für ausgeführte Arbeiten** (Freitext)
  - **Feld für Material**
  - **Feld für Erfassung der Arbeitszeit**
  - **Unterschrift des App-Benutzers** (Name bereits vorausgefüllt)
  - **Unterschrift des Kunden** (Name muss händisch eingetragen werden)

### 10.10 Wartungsvertrag

- **Ort:** Wenn der Kunde **keine** weiteren Objekte/BV hat → Feld **Wartungsvertrag** direkt **unter Kunde**. Ansonsten **unter Objekt/BV**.
- **Felder:** Wartungsvertrag (Format z. B. JJJJ/0000), **Datum Beginn**, **Datum Ende**. Später für Auflistung der Wartungsverträge nutzbar.

### 10.11 Verweise auf weitere Dokumentation

| Thema | Ort | Inhalt |
|-------|-----|--------|
| **Konzepte gesammelt** | **Vico.md §11** | Entscheidungen, Briefbogen-PDF, Bug-Modul, Etikettendrucker, Domain-Bindung, Arbeitszeit/GPS/Standort, Modul-Ideen |
| Optimierung (technisch) | `docs/Optimierungsplan.md` | Data-Layer, Sync, Suche, Vite, Historie |
| Lizenzportal / Mandanten | Vico.md §9 | Mandantenfähigkeit, Lizenz-API, Aktivierung |
| Lizenzportal-Setup | `docs/Lizenzportal-Setup.md` | Setup Admin-App, Domain, API, Betrieb |
| Demokunde | `docs/Demokunde-Setup.md` | Demo-Mandant einrichten, 24h-Löschung |
| Release | `docs/Release-Checkliste.md` | Checkliste vor Release |
| Updates & Versionierung | `docs/App-Updates-und-Versionierung.md` | SemVer, `version.json`, Release Notes, Multi-App, DB/Capacitor |
| Roadmap-Reihenfolge | `docs/Roadmap-Abarbeitung-Vorschlag.md` | Vorschlag Phasen 0–7 aus Noch-zu-erledigen + Vico §7 |
| DB-Backup (Live) | `docs/Supabase-Datenbank-Backup.md` | GitHub Action, pg_dump lokal, Dashboard – nicht in Git |

### 10.12 Umsetzungsfragen & Vorschläge

Die folgenden Punkte sollten vor der Umsetzung entschieden werden. Pro Frage ist ein **Vorschlag** angegeben – zum Abhaken bzw. Anpassen.

---

#### 1. React Native / APK

| # | Frage | Vorschlag | Deine Entscheidung |
|---|--------|-----------|--------------------|
| 1.1 | React Native neu oder Capacitor um die bestehende Web-App? | **Capacitor** – eine Codebasis (Web-App), native Hülle + Plugins; weniger Aufwand als komplett React Native. | |
| 1.2 | APK parallel zur PWA oder später PWA ersetzen? | **Parallel** – PWA bleibt für Browser-Nutzung; APK für Techniker mit Drucker/Offline. Gleiche Backend-URL. | |
| 1.3 | iOS von vornherein mitplanen? | **Ja** – iOS von Anfang an mitplanen (Capacitor unterstützt beides, zweites Build). | ✅ Entscheidung: Ja, iOS mitplanen |

---

#### 2. Objekt/BV und Tür/Tor (Datenmodell)

| # | Frage | Vorschlag | Deine Entscheidung |
|---|--------|-----------|--------------------|
| 2.1 | Bestehende Tabellen umbenennen oder neue + Migration? | **Bestehende Tabellen behalten**, nur **Anzeige-Labels** umstellen (BV → „Objekt/BV“, Objekt → „Tür/Tor“). Später optional DB-Spalten/Views umbenennen. | |
| 2.2 | URLs/Routen beibehalten (QR-Codes) oder anpassen? | **URLs beibehalten** (`/kunden/…/bvs/…/objekte`) – bestehende QR-Codes bleiben gültig; nur Menü-/Seitentitel anpassen. | |
| 2.3 | Tür/Tor direkt unter Kunde: neue Relation oder virtuelles Default-Objekt/BV? | **Option A:** Neue Relation (Objekt kann `bv_id` NULL haben, dann `customer_id` gesetzt). Sauberer, erfordert Schema-Erweiterung. **Alternative:** Ein „Default-Objekt/BV“ pro Kunde (unsichtbar in UI) – weniger Schema-Änderung. | |

**Entscheidung:** Wie Vorschlag – bestehende Tabellen/Labels, URLs beibehalten, echte Relation Kunde→Tür/Tor (`bv_id` optional).

---

#### 3. Verschieben von Türen (Barrierefreiheit)

| # | Frage | Vorschlag | Deine Entscheidung |
|---|--------|-----------|--------------------|
| 3.1 | Drag & Drop oder Dropdown/Auswahl? | **Dropdown/Auswahl** – „Zuordnung: [Objekt/BV wählen]“ pro Tür. Einfacher umsetzbar und barrierefrei (Tastatur, Screenreader). | |
| 3.2 | Wartungsprotokolle, Fotos, Dokumente der Tür bleiben zugeordnet? | **Ja** – sie bleiben der gleichen Tür (ID) zugeordnet; nur die Zuordnung „Kunde ↔ Objekt/BV“ ändert sich. | |

**Entscheidung:** Wie Vorschlag – Dropdown/Auswahl, Protokolle/Fotos/Dokumente bleiben der Tür zugeordnet.

---

#### 4. Kundenportal – Sichtbarkeit Objekte/BV

| # | Frage | Vorschlag | Deine Entscheidung |
|---|--------|-----------|--------------------|
| 4.1 | Whitelist-Tabelle oder „ausgewählte Objekte/BV“ pro Portalbenutzer? | **Whitelist:** Tabelle `portal_user_object_visibility` (portal_user_id, bv_id). Standard: alle Objekte/BV des Kunden ausgewählt; Admin kann einschränken. | |
| 4.2 | Filterung nur Backend (API/RLS) oder auch Frontend? | **Nur Backend** – RLS/API liefert nur sichtbare Objekte/BV; Portal-Frontend zeigt alles, was es bekommt. | |

**Entscheidung:** Wie Vorschlag – Whitelist-Tabelle, Filterung nur im Backend.

---

#### 5. Historie – Details on-demand

| # | Frage | Vorschlag | Deine Entscheidung |
|---|--------|-----------|--------------------|
| 5.1 | „Details“ = nur geänderte Spalte oder Vorher/Nachher? | **Zunächst:** nur **welche Spalte** (table_name, record_id, action). **Später:** Vorher/Nachher, wenn audit_log erweitert wird (alte/new Werte speichern). | |
| 5.2 | Lazy-Load: Klick auf Zeile → separater API-Call? | **Ja** – Klick auf Zeile lädt Details nach (z. B. RPC `get_audit_log_detail(id)` oder erweiterte Zeile). Liste bleibt schlank (Paginierung beibehalten). | |

**Entscheidung:** Wie Vorschlag – Vorher/Nachher wenn audit_log erweiterbar; Lazy-Load per RPC/Detail-Call.

---

#### 6. Neuer Menüpunkt (Appversion, Lizenz, Anleitung)

| # | Frage | Vorschlag | Deine Entscheidung |
|---|--------|-----------|--------------------|
| 6.1 | Name des Menüpunkts? | **„Info“** oder **„App-Info“** – kurz, eindeutig. | |
| 6.2 | Anleitung: eine PDF oder mehrere Dokumente? | **Eine PDF** (BENUTZERANLEITUNG) wie bisher; Link „Anleitung öffnen“. Später erweiterbar. | |

**Entscheidung:** Wie Vorschlag – Menüpunkt „Info“ oder „App-Info“, Anleitung eine PDF.

---

#### 7. Auftrag abarbeiten – Auftragsdetail-Seite

| # | Frage | Vorschlag | Deine Entscheidung |
|---|--------|-----------|--------------------|
| 7.1 | Route für Auftragsdetail? | **`/auftrag/:orderId`** – Klick auf Auftrag im Dashboard führt zu dieser Seite. | |
| 7.2 | Neue Spalten in `orders` oder neue Tabelle (z. B. Monteursbericht)? | **Neue Tabelle `order_completions`** (oder `monteursbericht`) – order_id, ausgeführte_arbeiten, material, arbeitszeit_minuten, unterschrift_mitarbeiter_path, unterschrift_mitarbeiter_name, unterschrift_kunde_path, unterschrift_kunde_name, created_at. Orders bleibt für Stammdaten; Completion für Abarbeitung. | |
| 7.3 | Unterschriften: nur Bild oder auch Name/Datum strukturiert? | **Beides** – Bild (Storage-Pfad) + strukturierte Felder (Name, Datum) für Anzeige und Export. | |

**Entscheidung:** Wie Vorschlag – Route `/auftrag/:orderId`, Tabelle `order_completions`, Unterschriften Bild + strukturierte Felder.

---

#### 8. Wartungsvertrag

| # | Frage | Vorschlag | Deine Entscheidung |
|---|--------|-----------|--------------------|
| 8.1 | Nur Vertragsnummer, Beginn, Ende oder weitere Felder? | **MVP:** Vertragsnummer (JJJJ/0000), Datum Beginn, Datum Ende. **Später:** optional Kundennummer, Ansprechpartner, Verlängerung. | |
| 8.2 | Ein Wartungsvertrag oder mehrere pro Kunde/Objekt/BV? | **Mehrere erlauben** – Liste von Verträgen (z. B. Verlängerungen). Pro Eintrag: Nummer, Beginn, Ende. | |

**Entscheidung:** Wie Vorschlag – MVP-Felder (Nummer, Beginn, Ende), mehrere Verträge pro Kunde/Objekt/BV möglich.

---

#### 9. Stammdatenimport (CSV/Excel)

| # | Frage | Vorschlag | Deine Entscheidung |
|---|--------|-----------|--------------------|
| 9.1 | Wo in der App? | **Eigener Menüpunkt „Import“** oder Unterpunkt unter **Kunden** („Stammdaten importieren“). | |
| 9.2 | Objekt/BV-Spalte: bestehendes verknüpfen oder neu anlegen? | **Beides** – Wenn Objekt/BV-Name/ID in CSV existiert → verknüpfen; wenn neu → optional anlegen (Checkbox „Unbekannte Objekte/BV anlegen“). | |
| 9.3 | Bei Fehlern: Abbruch oder Zeile überspringen + Fehlerliste? | **Zeile überspringen** – fehlerhafte Zeilen in Fehlerliste, Rest importieren. Am Ende Zusammenfassung: „X importiert, Y Fehler“ + Download Fehlerliste. | |

**Entscheidung:** Wie Vorschlag – Menüpunkt „Import“, Objekt/BV verknüpfen oder neu anlegen, Zeile überspringen + Fehlerliste.

---

#### 10. Sonstiges

| # | Frage | Vorschlag | Deine Entscheidung |
|---|--------|-----------|--------------------|
| 10.1 | Reihenfolge der Umsetzung? | **Vorschlag:** (1) Menü/Info + Einstellungen aufräumen → (2) Benutzerverwaltung (Rolle, Portalbenutzer Kunde/Objekte) → (3) Auftrag anlegen + abarbeiten + Completion-Tabelle → (4) Datenmodell/Labels Objekt/BV + Tür/Tor + Wartungsvertrag → (5) Kundenportal-Sichtbarkeit → (6) Historie-Details → (7) Stammdatenimport → (8) React Native/Capacitor + APK. | |
| 10.2 | Rollenauswahl beim Anlegen: abhängig von Lizenz? | **Ja** – Nur Rollen anbieten, die durch Lizenz/Module freigegeben sind (z. B. „Kunde“ nur wenn Kundenportal-Modul aktiv). | |

**Entscheidung:** Wie Vorschlag – Reihenfolge wie oben, Rollenauswahl abhängig von Lizenz/Modulen.


---

## 11. Konzepte & Planungsdokumente (konsolidiert)

Hier sind die wichtigsten **fachlichen Konzepte** gebündelt, die zuvor als einzelne Dateien unter `docs/` lagen. **Operative** Dokumente (Setup, Checklisten, SQL-Hinweise) bleiben in `docs/` – siehe **§11.12**.

---

### 11.1 Getroffene Entscheidungen (offene Punkte)

**Stand:** Februar 2025  
**Zweck:** Verbindliche Entscheidungen zu App-Name, Lizenz, Zeiterfassung, Etikettendrucker, Suche, Speicher usw.

#### 1. App-Name (Projektname)

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Welcher Projektname? |
| **Entscheidung** | **Auf später verschoben.** Kundenseitiger App-Name aus Lizenz-API (Stammdaten Mandant). |

**Referenz:** Vico.md §9.2 (Frage 1).

#### 2. Verhalten bei abgelaufener Lizenz

| Thema | Entscheidung |
|--------|---------------|
| **Frage** | Hinweis, Sperre, Schonfrist Nur-Lesen, Redirect? |
| **Entscheidung** | **Schonfrist Nur-Lesen:** Nach Ablauf für konfigurierbare Tage nur Lesen, danach Redirect zum Aktivierungs-Screen. **Schonfrist** im **Lizenzportal** pro Mandant/Lizenz (`grace_period_days`). |

**Referenz:** Vico.md §9.10, §9.17 (Roadmap B2).

#### 3. Lizenz-Trial (14 Tage)

| Thema | Entscheidung |
|--------|---------------|
| **Entscheidung** | **Ja – Trial anbieten.** 14 Tage, alle Module; Details bei Umsetzung im Lizenzportal („Trial starten“). |

**Referenz:** Vico.md §9.10, §9.13.

#### 4. Mandanten-Self-Service

| Thema | Entscheidung |
|--------|---------------|
| **Entscheidung** | **Erstmal nur Betreiber im Lizenzportal.** Self-Service später. **Stammdaten-Self-Service (wenn):** Einstellungen → „Stammdaten / Impressum“ (nur Admin). |

**Referenz:** Vico.md §9.10, §9.13.

#### 5. Rechte Zeiterfassung / Teamleiter

| Thema | Entscheidung |
|--------|---------------|
| **Entscheidung** | **Teamleiter-Rolle** (`teamleiter`): sieht/bearbeitet nur Zeiten des zugewiesenen Teams. |

**Referenz:** §11.8 (Zeiterfassung/Portal).

#### 6. Soll täglich/wöchentlich (Arbeitszeitkonto)

| Thema | Entscheidung |
|--------|---------------|
| **Entscheidung** | **Zusätzlich Soll pro Woche oder Tag** in Stammdaten AZK; Monatssoll ableitbar oder separat. |

**Referenz:** §11.8.

#### 7. Auftragszuordnung (Zeiterfassung)

| Thema | Entscheidung |
|--------|---------------|
| **Entscheidung** | **Entfernen (Option B).** Code/UI in Haupt-App und Portal entfernen. Spalte `order_id` in `time_entries` kann bleiben. |

**Referenz:** §11.8, `docs/Arbeitszeit-Umstrukturierung-Portal.md`.

#### 8. Lizenz-API (Edge Function vs. Netlify)

| Thema | Entscheidung |
|--------|---------------|
| **Entscheidung** | **Auf später verschoben.** Edge Function bleibt. |

**Referenz:** `docs/Release-Checkliste.md`.

#### 9. Etikettendrucker – Integrationsweg

| Thema | Entscheidung |
|--------|---------------|
| **Entscheidung** | **Option A:** Capacitor-Wrapper + Bluetooth-Plugin. Option B (Helper-App) nur bei bewusst reiner PWA. |

**Referenz:** §11.4.

#### 10. Suche – Optimierung

| Thema | Entscheidung |
|--------|---------------|
| **Entscheidung** | **Zuerst Option A** (weniger Spalten im Data-Layer). **Option B** (server-seitige Suche) später bei Bedarf. |

**Referenz:** `docs/Optimierungsplan.md` §4.

#### 11. Speicherkontingent – automatische Ermittlung

| Thema | Entscheidung |
|--------|---------------|
| **Entscheidung** | **Auf IONOS-Umzug verschoben.** Aktuell manuell im Lizenzportal. |

**Referenz:** §11.8 (IONOS).

#### Empfohlene Reihenfolge der Umsetzung

| Reihenfolge | Entscheidung | Begründung | Geschätzter Aufwand |
|-------------|--------------|------------|---------------------|
| **1** | §7 Auftragszuordnung entfernen | Aufräumen | 0,5–1 T |
| **2** | §10 Suche Quick-Win | Data-Layer | 1–2 T |
| **3** | §2 Abgelaufene Lizenz: Schonfrist | Lizenzportal + App | 1–2 T |
| **4** | §3 Lizenz-Trial | Portal + API | 1–2 T |
| **5** | §5 Teamleiter-Rolle | RLS, UI | 2–3 T |
| **6** | §6 Soll täglich/wöchentlich | Schema, Portal | 1–2 T |
| **7** | §4 Mandanten-Self-Service Stammdaten | Einstellungen | 1,5–2,5 T |
| **8** | §9 Etikettendrucker (Capacitor-Plugin) | Bei Roadmap I2 | 1–2 T |

#### Umsetzungsstand (alle 8 Schritte)

| # | Schritt | Status | Hinweise |
|---|--------|--------|----------|
| 1 | Auftragszuordnung entfernen | ✅ | Kein orderId mehr an API; `order_id` in DB optional |
| 2 | Suche Quick-Win | ✅ | `TIME_ENTRY_COLUMNS` / `TIME_BREAK_COLUMNS` reduziert |
| 3 | Schonfrist + Lizenzportal | ✅ | `grace_period_days`, App Nur-Lesen |
| 4 | Lizenz-Trial | ✅ | `is_trial`, Admin „Trial starten“ |
| 5 | Teamleiter-Rolle | ✅ | `teamleiter`, `team_id`, RLS, RPC |
| 6 | Soll täglich/wöchentlich | ✅ | `soll_minutes_per_week` u. a. |
| 7 | Stammdaten in Einstellungen | ✅ | „Stammdaten / Impressum“; Bearbeiten später |
| 8 | Etikettendrucker (Grundgerüst) | ✅ | `src/lib/etikettendrucker.ts`; natives Android-Plugin ggf. offen |

**Schema:** `supabase-complete.sql`, `supabase-license-portal.sql` – im jeweiligen Projekt nachziehen.

*Änderungen an diesen Entscheidungen: hier in §11.1 und ggf. Querverweise in Vico.md §9 aktualisieren.*

---

### 11.2 PDF-Ausgabe mit Mandanten-Briefbogen

**Ziel:** PDFs (Wartungsprotokolle, Zoll-Export, Urlaubsbescheinigung) auf dem **Briefbogen des Mandanten** statt neutralem Weiß.

**Konzept:** Admin lädt Briefbogen hoch (Einstellungen oder Lizenzportal/Design). **Speicherung:** Supabase Storage, pro Mandant. **Bei PDF-Erzeugung:** Briefbogen als erste Seite oder **Hintergrund** (Variante B empfohlen: PNG/JPEG + jsPDF).

**Datenmodell (Vorschlag):** `briefbogen_storage_path` in `design_config` oder `admin_config`. Bucket z. B. `briefbogen`, Pfad `{tenant_id}/briefbogen.png`.

**Umsetzung:** `generateMaintenancePdf` / `exportCompliance` – gemeinsame Hilfsfunktion z. B. `addLetterheadToPdf`. **Aufwand:** ca. 1–2 Tage.

---

### 11.3 Bug-Erfassungsmodul

**Ziel:** JS-Fehler (`window.onerror`, `unhandledrejection`), Error-Boundary → DB; Admin unter **System → Fehlerberichte**.

**Kern:** Tabelle `app_errors` (message, stack, source `main_app|portal|admin`, path, user_agent, status, fingerprint), RLS (Insert authentifiziert, Select/Update Admin), **Debounce/Deduplizierung** clientseitig, Service z. B. `errorReportService`.

---

### 11.4 Etikettendrucker (QR aus der App)

**Anforderungen:** Mobil, Akku, kleine Etiketten, **Bluetooth**, **Android**, Druck **aus der Vico-App** (nicht nur Hersteller-App). Web/PWA allein reicht nicht zuverlässig → **native Schicht nötig**.

**Modellvorschläge (mit Android-SDK):** Zebra ZQ220/ZQ320 (Link-OS SDK), Brother RJ-2150 (Brother SDK), Bixolon SPP-R200III. **Consumer-Drucker** ohne SDK: ungeeignet.

**Integration:** **Option A (entschieden):** Capacitor + Plugin. Option B: Helper-App + Intent. Option C: Share an Hersteller-App (Workaround).

**Code:** `src/lib/etikettendrucker.ts` – `isEtikettendruckerAvailable()`, `printLabel(qrPayload)`.

**Etikettendesign (Planung, Detail in `docs/Noch-zu-erledigen.md`):** Ein **mandantenweites Layout** (wie Druckvorlagen), **Presets mini/mid/max** für Bixolon 2″ (ca. 50×25 / 50×30 / 58×40 mm; **Druckbreite ~48 mm** beachten), **separates Etiketten-Logo** neben dem allgemeinen Mandantenlogo, **Vorschau** vor Druck. **Render:** ein farbfähiges Layout; **Thermo** druckt **Graustufen**. **Später:** **A4-PDF** mit vielen QR (Objekt-Mehrfachauswahl in der Haupt-App); **Berechtigung:** Lizenz-Feature (z. B. `qr_batch_a4`) **plus** vom Admin definierte **erlaubte Rollen**; **kein** Etikettendruck im Kundenportal. **A4-Bogenmaße:** HERMA/Avery-Referenzartikel siehe `Noch-zu-erledigen.md` (A4-Referenzetiketten).

---

### 11.5 Domain-Bindung & Doppelnutzung-Erkennung

**Stand:** März 2025

1. **Domain-Bindung:** `tenants.allowed_domains` (jsonb). API prüft `Origin`/`Referer`; leer = keine Prüfung. Admin: „Domain-Bindung“ im Mandanten-Formular; `localhost:PORT` für Entwicklung; Wildcard `*.firma.de` möglich.
2. **Monitoring:** `limit_exceeded_log.reported_from` – Domain bei Grenzüberschreitung; Hinweis bei mehreren Domains pro Lizenz.
3. **Duplikat-Lizenz:** Admin prüft Lizenznummer beim Anlegen.

**Deploy:** `supabase-license-portal.sql` idempotent; Functions `license`, `limit-exceeded` deployen (siehe Datei für Befehle).

---

### 11.6 Arbeitszeiterfassung (Konzeptüberblick)

**Lizenz:** Feature `arbeitszeiterfassung`; Route `/arbeitszeit`; Offline/Outbox wie bestehendes Muster.

**ArbZG § 4 – Pausen (Orientierung):**

| Arbeitszeit | Mindestpause |
|-------------|--------------|
| ≤ 6 h | keine |
| 6–9 h | 30 Min |
| > 9 h | 45 Min |

**Datenmodell (Ist):** `time_entries`, `time_breaks`, Bearbeitungslog, Admin-RPC, Wochen-/Monatsansicht, Soll-Felder auf `profiles`.

**Fragen aus dem ursprünglichen KONZEPT** (größtenteils geklärt): Pausen als `time_breaks`, Lizenz + ggf. Component Settings, eigene Zeiten / Admin & Teamleiter, Outbox-Sync.

---

### 11.7 Ortung (GPS) bei der Zeiterfassung

**Kurzüberblick:**

| Thema | Inhalt |
|-------|--------|
| **Recht** | DSGVO, BDSG § 26, BetrVG § 87 Abs. 1 Nr. 6 |
| **Rechtsgrundlage** | Bei optionaler Ortung: **Einwilligung** (§ 26 Abs. 2 BDSG) typisch |
| **Betriebsrat** | Mitbestimmung – **Betriebsvereinbarung empfohlen** |
| **Information** | Art. 13 DSGVO vor Erhebung |
| **Einwilligung** | Freiwillig, widerrufbar; Zeiterfassung **ohne** Ortung muss möglich sein |
| **DSFA** | Bei systematischer Ortung in der Regel **erforderlich** |
| **Portal** | Anzeige des Standorts nur bei Einwilligung / technischer Erfassung |

**Ablauf (nutzergeführt):** Informationsblock → Checkbox + aktive Bestätigung → Speicherung Einwilligungszeitpunkt; Widerruf in Einstellungen.

---

### 11.8 Zeiterfassungsportal, IONOS, weitere AZ-Themen

- **Teamleiter, Soll Woche/Tag, Auftragszuordnung entfernt:** siehe **§11.1**.
- **Admin-Modul-Gliederung, Portal-Routen, Deploy:** operative Details in `docs/Zeiterfassung-Offene-Punkte-und-IONOS.md`, `docs/Arbeitszeit-Umstrukturierung-Portal.md`.
- **IONOS / Speicher automatisch:** verschoben; manuelle Pflege bis Umzug.
- **Feature-Listen / Soll-Urlaub / Compliance:** `docs/Arbeitszeit-Feature-Liste.md`, `docs/Arbeitszeit-Soll-Urlaub-Planung.md`, `docs/Arbeitszeit-Rechtliche-Compliance.md` (fachliche Vertiefung, in `docs/` belassen).

---

### 11.9 Standortabfrage (Arbeitszeitenportal)

**Zweck:** Admin/Teamleiter können **aktuelle** Standorte von Mitarbeitern anfordern (separates Feature von GPS beim **Stempeln** – siehe §11.7).

- **Route:** `/standort`; Feature `standortabfrage` in der Lizenz.
- **Teamleiter:** nur wenn `admin_config.standortabfrage_teamleiter_allowed` (Haupt-App Einstellungen).
- **Ablauf:** Einwilligung „Standortabfrage“ in Einstellungen → optional Web-Push → „Standort senden“ in der App → Portal „Standort anfordern“.
- **Fehlerbehebung:** Link fehlt → Lizenz-Feature, `.env` Portal, `VITE_LICENSE_NUMBER`. **Hintergrund-Standort:** Web/PWA nicht möglich; nativ nur mit Plugin (siehe `docs/Standort-Abfrage-Arbeitszeitenportal.md`).

---

### 11.10 Offene Modul-Vorschläge (Kurzüberblick)

| Kategorie | Anzahl (ca.) | Aufwand gesamt (ca.) |
|-----------|----------------|----------------------|
| Wartung & Auswertung | 5 | 26–36 T |
| UX & Produktivität | 4 | 6–9 T |
| Zeiterfassung | 6 | 8–15 T |
| Sicherheit & Betrieb | 4 | 5–9 T |
| Infrastruktur | 2 | 1–2 T |

Details zu J1–J10 u. a.: **Vico.md §7** (Roadmap) und `docs/Noch-zu-erledigen.md`. `docs/Offene-Module-Vorschlaege.md` ist nur noch ein Stub-Verweis.

---

### 11.11 Ehemalige Konzeptdateien → Verweis

| Frühere Datei | Inhalt jetzt |
|---------------|----------------|
| `docs/Entscheidungen-Offene-Punkte.md` | **§11.1** |
| `docs/PDF-Briefbogen-Konzept.md` | **§11.2** |
| `docs/Bug-Erfassungsmodul-Planung.md` | **§11.3** |
| `docs/Etikettendrucker-Planung.md` | **§11.4** |
| `docs/Domain-Bindung-Lizenz.md` | **§11.5** |
| `docs/KONZEPT-Arbeitszeiterfassung.md`, `docs/Arbeitszeiterfassung-Detailkonzept.md` | **§11.6** (+ Umsetzung in App) |
| `docs/Zeiterfassung-Ortung-GPS-Recht-und-Planung.md` | **§11.7** |
| `docs/Zeiterfassung-Offene-Punkte-und-IONOS.md`, `docs/Arbeitszeit-Umstrukturierung-Portal.md` | **§11.8** + weiterführend in `docs/` |
| `docs/Standort-Abfrage-Arbeitszeitenportal.md` | **§11.9** + Details in `docs/` |
| `docs/Offene-Module-Vorschlaege.md` | **§11.10** (Stub-Verweis) |

---

### 11.12 Dokumentation, die bewusst in `docs/` bleibt

- **Setup & Betrieb:** `Lizenzportal-Setup.md`, `Demokunde-Setup.md`, `Release-Checkliste.md`, `App-Updates-und-Versionierung.md`, `Supabase-Datenbank-Backup.md`
- **Technik/Performance:** `Optimierungsplan.md`
- **Migrationen / SQL-Hinweise:** wie in Repo dokumentiert (`supabase-*.sql`)
- **Vertiefung Arbeitszeit:** `Arbeitszeit-Feature-Liste.md`, `Arbeitszeit-Soll-Urlaub-Planung.md`, `Arbeitszeit-Rechtliche-Compliance.md`
- **Aufgabenliste:** `Noch-zu-erledigen.md`
- **Roadmap-Reihenfolge (Vorschlag):** `Roadmap-Abarbeitung-Vorschlag.md`

---

*Ende Abschnitt 11.*
