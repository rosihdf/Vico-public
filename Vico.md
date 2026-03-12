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
| Vico-Dokumentation als PDF | `npm run generate-vico-pdf` |

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

### Demo-Account (24h-Löschung)

Rolle "demo", RPC `cleanup_demo_customers_older_than_24h()`, GitHub Actions täglich 4:00 UTC.

---

## 6. Projektstand

### Implementiert

- versionUtils, UpdateBanner, objectUtils
- Objekt-Anzeige (Suche, Auftrag, Wartung, PDF, QR, Wartungsstatus-Ampel)
- Rechte (Admin, Demo-Rolle, BV nur Admin)
- UX: Dunkelmodus, LoadingSpinner, Toast, Touch-Targets
- Web-App-Test-Checkliste, Historie (Audit-Log)
- Adressuche (OpenPLZ), Fehlerbehandlung (ToastContext)
- Types, Indizes, Code-Splitting
- Unit-Tests, ESLint, CI/CD, PWA

---

## 7. Roadmap

### Roadmap: Geplante Features (mit Aufwand)

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

**Aufwand:** T = Tage (geschätzt, 1 Entwickler)

### Umbau Wartung: Auftrag → Monteursbericht (Detail)

**Ziel:** Detaillierte Aufträge, Abarbeitung durch Monteur, Monteursbericht (Zeiten, Material), Freigabe → Kundenportal + Buchhaltung.

**Auftragstypen:** Einbau, Reparatur, Wartung, Nachprüfung, Sonstiges. Bei Wartung: Wartungsprotokoll nach DIN 14677 (Feststellanlagen) und ASR A1.7 (Türen/Tore).

**Phasen:** (1) Aufträge erweitern → (2) Monteursbericht (Tabellen, CRUD) → (3) Freigabe-Workflow → (4) Kundenportal → (5) Wartungsprotokoll DIN/ASR → (6) Buchhaltungs-Export → (7) Offline, Material-Stammdaten → (8) Erweiterungen (Mehrfachbesuche, Vorlagen).

### Arbeitszeiterfassung (Modul)

**Aktivierung:** Lizenzmodul über admin/. **Ablauf:** Start/Ende Arbeitszeit, Pausen (manuell oder automatisch nach ArbZG § 4). **Technisch:** Tabelle `time_entries`, Feature-Flag, Route `/arbeitszeit`, RLS.

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
└── BENUTZERANLEITUNG.md
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
→ **Offen, auf später verschoben.** Rechtlich unbedenkliche Alternativen recherchiert: Objektio, Portaio, Baseio. Änderung bei späterer Entscheidung gering (app_name kommt aus API; technisch: package.json, Manifest).

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

**Vorschlag 1 – Lizenz-Caching:** Lizenz nach Aktivierung lokal speichern; optional periodische Prüfung (z.B. täglich) ob Lizenz noch gültig ist.

**Vorschlag 2 – Lizenz-Trial:** Optional: Mandant erhält 14 Tage Trial mit allen Modulen; danach Einschränkung ohne Verlängerung.

**Vorschlag 3 – Mandanten-Self-Service:** Sollen Mandanten selbst ihre Lizenz verlängern oder Stammdaten ändern können, oder nur über das Lizenzportal durch den Betreiber?

**Vorschlag 4 – Daten-Export:** Bei Mandantenkündigung: Export aller Daten als CSV/JSON; optional automatische Löschung nach Frist.

**Frage 21:** Welche dieser Vorschläge sind relevant oder sollen berücksichtigt werden?

→ **Entscheidung:** **Umsetzen:** Vorschlag 1 (Lizenz-Caching, bereits in Frage 9) und Vorschlag 4 (Daten-Export bei Kündigung). **Später:** Vorschlag 2 (Trial), Vorschlag 3 (Self-Service). Zunächst nur über Lizenzportal durch Betreiber.

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

**Auf später verschoben (nicht blockierend):**
- **Frage 1:** Projektname (Objektio, Portaio, Baseio oder eigener Vorschlag)
- **Vorschlag 2:** Lizenz-Trial (14 Tage)
- **Vorschlag 3:** Mandanten-Self-Service

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
