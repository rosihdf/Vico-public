# Vico – Türen & Tore

Wartungs- und Mängeldokumentation für Türen und Tore. Stand: März 2026.

---

## Inhaltsverzeichnis

1. [Quick Start](#1-quick-start)
2. [Architektur](#2-architektur)
3. [Features](#3-features)
4. [Datenbank](#4-datenbank)
5. [Deployment](#5-deployment)
6. [Projektstand](#6-projektstand)
7. [Roadmap](#7-roadmap) – Struktur: **7.1** Legende, **7.2** offene Arbeiten, **7.3** Archiv, **7.4** Backlog-Referenz, **7.5** Kontext, **7.6** konsolidierter Planungsstand (Phasen, Mandanten, Etikett-Referenzen)
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
- **Duplikat/Kopie (Kundenansicht):** Eine Tür/Tor kann innerhalb desselben Kunden dupliziert werden (**neue Datensatz-ID**). Stammdaten werden übernommen; die **Bezeichnung** erhält den Zusatz **` (Duplikat)`** (war der Name leer: **`Duplikat`**), die **interne ID** einen eindeutigen Suffix **`…-Duplikat-<Kurz-UUID>`**. Im Dialog wählt der Nutzer getrennt: **Profilfoto** (Standard: an), **Galerie-Fotos** (Standard: aus), **Dokumente** (Zeichnungen, Zertifikate, …; Standard: aus). Was angehakt ist, wird als **eigene Datei** im jeweiligen Bucket kopiert (keine gemeinsame Storage-Referenz). Details und offene Punkte: **Tür/Tor: Duplikat – Verhalten & Rückfragen** unten.
- **Profilfoto:** Optional pro Tür/Tor; in der **Kundenübersicht** nur das Bild, wenn gesetzt (kein Platzhalter). Im **Tür/Tor-Formular** oben rechts neben der Internen ID: immer **Vorschaubild oder Platzhalter** (Kamera-Symbol); **Klick** öffnet das Eingabepanel (Datei/Kamera/Entfernen). Aufnahme oder Datei, Komprimierung wie bei Objekt-Fotos. Schema: `objects.profile_photo_path` (Bucket `object-photos`).

#### Tür/Tor: Duplikat – Verhalten & Rückfragen

**In der App umgesetzt**

- **Stammdaten** der Quell-Tür werden auf den neuen Datensatz übertragen (wie Neuanlage, aber mit angepasster Bezeichnung und interner ID wie oben).
- **Drei Checkboxen** im Bestätigungsdialog:
  - **Profilfoto übernehmen** – wenn an der Quelle `profile_photo_path` gesetzt ist und die Option aktiv ist: Datei im Bucket **`object-photos`** unter der neuen Objekt-ID kopieren und zuordnen (Standard: **aktiviert**).
  - **Galerie-Fotos übernehmen** – Einträge in **`object_photos`** inkl. neuer Dateien im Foto-Bucket (Standard: **aus**).
  - **Dokumente übernehmen** – Einträge in **`object_documents`** inkl. Dateien im Bucket **`object-documents`** (Typ, Titel, Dateiname; Standard: **aus**).
- **Offline:** Duplikat inkl. Storage-Kopien nur **online** (wie bisher; Hinweis in der UI).

**Weitere Rückfragen / Klärung mit Auftraggeber oder Rollout**

- Soll das Profilfoto zusätzlich in **anderen Oberflächen** erscheinen (z. B. Suche, Auftrag, PDF, Kundenportal)?
- **Rollen:** Wer darf duplizieren bzw. Profilfotos pflegen (nur Admin/Mitarbeiter wie heute, oder auch Operator)?
- **Offline:** Reicht der aktuelle UI-Hinweis, oder ist ein **gesonderter Hilfetext** zum Duplizieren gewünscht?

### Aufträge & Monteursbericht

- **Tür/Tor-Auswahl:** Wenn zum Kunden (bzw. Objekt/BV) Türen existieren, ist **mindestens eine** Auswahl erforderlich; die **Zuweisung** („Zugewiesen an“) erscheint erst danach (bzw. sofort, wenn es keine Türen zur Auswahl gibt).
- **Tür/Tor aus Aufträge:** Link **„Tür/Tor“** öffnet **`/objekt/:id/bearbeiten?returnTo=/auftrag`** (volles Modal wie in Kunden, ohne die Kundenliste als Zwischenziel). Ohne Tür-ID am Auftrag Fallback weiterhin Deep-Link **`/kunden?…`**.
- **Auftrag abschließen:** Bestätigungsdialog; wenn Firmen-Einstellung **Kundenportal + Benachrichtigung** und das Objekt **portal-fähig** ist, erscheint eine **Checkbox**, ob der Bericht **diesmal** im Portal bereitgestellt werden soll (Standard: an).
- **Aktionen Monteursbericht:** Speichern, Parken, Abschließen, ggf. E-Mail/PDF in **einer horizontalen Zeile** (scrollbar auf schmalen Viewports).

#### Auftrag / Monteursbericht – Rückfragen (Produkt)

- **Auftrag ohne Tür:** Aktuell nicht möglich, sobald mindestens eine Tür existiert. Soll es weiterhin Sonderfälle geben (z. B. reine „Kunden-Aufträge“ ohne Objekt)?
- **Portal-Checkbox beim Abschließen:** Sie gilt nur, wenn Einstellung `portal_notify` **und** Objekt portal-berechtigt ist. Soll bei anderen Einstellungen (`email_auto` / `none`) zusätzlich ein **einmaliger** E-Mail- oder Portal-Override angeboten werden?
- **Zuweisung:** Weiterhin nur **Admin** im Anlage-Formular – sollen **Teamleiter** oder **Mitarbeiter** sich selbst oder andere zuweisen dürfen?
- **Objekt bearbeiten:** Route nutzt Komponentenschutz **„Kunden“** – soll der Eintrag auch mit nur **„Auftrag“**-Modul sichtbar sein (reine Lizenzfrage)?

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

**Pflege & Mandanten-Rollouts:** Modularer Aufbau, Delta-Workflow und gleichzeitiges Update aller Mandanten-DBs: **§9.19**; operativ **`docs/sql/Mandanten-DB-Workflow.md`** und `scripts/apply-mandanten-sql.mjs`.

---

## 5. Deployment (Ziel: Cloudflare Pages)

**Ziel-Hosting:** **Cloudflare Pages** – vier Projekte aus **einem** GitHub-Repo (Root `""`, `admin`, `portal`, `arbeitszeit-portal`), Build `npm run build` → `dist`, SPA-Fallback über **`public/_redirects`**. Schrittfolge: **`docs/Cloudflare-Umzug-Roadmap.md`** (Teil B Go-Live).

1. **Git:** Pro Pages-Projekt mit GitHub verbinden (Monorepo, jeweiliger **Root directory**).
2. **Build:** `npm ci && npm run build`, Output **`dist`**; **Node 20** (Build-Umgebungsvariable).
3. **Env:** `VITE_SUPABASE_*`, **`VITE_LICENSE_API_URL`** = `https://<lizenzportal-ref>.supabase.co/functions/v1` (ohne Slash am Ende), optional `VITE_LICENSE_API_KEY`, Portale optional `VITE_LICENSE_NUMBER`.
4. **Supabase (Mandanten-DB):** Site URL + Redirect URLs für die **Pages**-Hosts (`*.pages.dev` oder Custom Domains).
5. **Mandanten-Env automatisieren:** **`docs/Cloudflare-Mandanten-Env-Skript.md`** (`npm run cf:apply-env`).

**Lizenz-API:** **Supabase Edge Functions** (Variante B) – **`docs/Lizenzportal-Setup.md`**. **Host-Lookup mit `*.pages.dev`:** **`docs/Mandanten-Hostlookup-CF-Pages.md`**.

**Legacy / Rollback:** Netlify-Stand über Git-Tag **`last-stand-netlify`**; Doku **`docs/Netlify-README.md`**, **`docs/Netlify-Vier-Apps.md`**, **`docs/Netlify-Mandanten-Env-Skript.md`** (nur noch für eingefrorene Sites bis Abbau).

**Planung CF1:** **`docs/Cloudflare-Umzug-und-Supabase-Auslagerung.md`**.

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

### Mobile-Build (Android & iOS)

**Geplanter Weg:** Store-Pakete mit **PWABuilder** aus der deployten PWA erzeugen – siehe **`docs/Netlify-Deployment-Updates-und-Mobile-Apps.md` (Teil E)**.

**Optional im Repo:** Die Web-App kann auch in einer **Capacitor**-Hülle laufen – **Parallel zur PWA** – gleicher Web-Build (`dist`), native Projekte für Android/iOS.

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

**Schritt-für-Schritt (Android & iOS, Stores):** **`docs/Capacitor-Schritt-fuer-Schritt.md`**

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

Dieser Abschnitt ist die **einzige Arbeitsliste** für Prioritäten: **§7.2** = was noch offen ist, **§7.3** = erledigte Meilensteine (Archiv), **§7.4** = Backlog-Referenz mit Priorität/Aufwand, **§7.5** = Kontext (grosse Epics, Checklisten, Ist-Stand), **§7.6** = **konsolidierte Planung** (Phasen 0–7, Mandanten-Onboarding A–D, Entscheidungen Roadmap J, Etikett-Referenzmaße). Technische Detailentscheidungen: **§9** (Lizenzportal), **§10** (Hauptapp), **§11** (Konsolidiert).

### 7.1 Legende

| Symbol | Bedeutung |
|--------|-----------|
| 🔲 | Offen |
| ⚠️ | Teilweise / nächste Ausbaustufe |
| ✅ | Erledigt (siehe Archiv **§7.3**) |

**Aufwand:** „T“ = Arbeitstage, Schätzung für **1 Entwickler**.

---

### 7.2 Offene Arbeiten (priorisiert)

**Empfohlene Reihenfolge:** **J7**-Teilpakete nach Bedarf, **J6** (grosses Epic) wenn operativ klar; **T1** (DB-Migrations) bei nächstem grösseren Schema-Umbau oder dediziertem Infrastruktur-Slot; **CF1** (Cloudflare-Umzug + optional Supabase-API) bei Hosting-/Kosten-Entscheid oder vor Mandanten-Skalierung. **L4, J4-B, J1 (E-Mail-Digest), I2 (Preset/UI)** sind umgesetzt → **§7.3** / **§7.2.1** (Betrieb).

| ID | Stream | Thema | Status | Aufwand | Detail |
|----|--------|--------|--------|---------|--------|
| **J6** | Fachlich | **Umbau Wartung (MVP):** Freigabe-Workflow, Portal-Anbindung, ggf. DIN/ASR (Monteursbericht vorhanden) | ⚠️ | 15–20 T | **§7.5** |
| **J7** | Fachlich | Paket: **Mängel-Follow-up**, **iCal**, **Bulk-Operationen**, **Portal-Push** (Reihenfolge **§7.6.4**) | 🔲 | je 2–3 T | **§7.4** #9–11, #15 |
| **T1** | Technik / DB | **Supabase CLI-Migrations** (zeitlich geordnet) statt nur Monolith `supabase-complete.sql`; Baseline + künftige Deltas; **Lizenzportal** eigenes `supabase/`. Kein App-Runtime-Gewinn, aber klarere Reviews & Rollouts. Pragmatischer Einstieg (Inventar, Changelog, Multi-`psql`): **`docs/sql/Mandanten-DB-Workflow.md`**. Konzept Modularisierung & Massen-Rollout: **§9.19**. | 🔲 | 0,5–2 T | **`docs/sql/Supabase-Migrations-Strategie.md`** · **§9.19** |
| **CF1** | Infrastruktur | **Cloudflare-Umzug** (Netlify → **Pages**, vier Projekte / ein Account): **Lizenz-API = Supabase Edge**; Git-Build auf CF; Env-Skript wie Netlify; Netlify Reserve dann Abbau. **Umsetzung:** **`docs/Cloudflare-Umzug-Roadmap.md`** (Teil A Umprogrammierung, Teil B Go-Live). | 🔲 | Planung ✅; Umsetzung nach Roadmap | **`docs/Cloudflare-Umzug-und-Supabase-Auslagerung.md`** · **`docs/Cloudflare-Umzug-Roadmap.md`** · **`docs/github-issues/CF1.body.md`** |

**Hinweis:** **J2, J3, J4, J10** (MVP), **2FA**, **Arbeitszeiterfassung** (Modul), **Capacitor/APK** (**I1**) und die früheren Phasen **A–H** sind umgesetzt → **§7.3**. **Abarbeitungs-Vorschlag** Phasen 0–7: **§7.6.2**.

#### 7.2.1 Offene Entscheidungen (Betrieb / Feinschliff)

| Thema | Stand |
|-------|--------|
| **J1 – Cron** | Edge Function `send-maintenance-reminder-digest` regelmässig aufrufen (z. B. Supabase Scheduler, täglich 07:00). Auth: `Authorization: Bearer <SERVICE_ROLE_KEY>` oder Header `x-cron-secret` = Secret `MAINTENANCE_DIGEST_CRON_SECRET`. |
| **J1 – Secrets** | `RESEND_API_KEY`, `RESEND_FROM`, `APP_URL` (Link „Zur App“ in der E-Mail), optional `MAINTENANCE_DIGEST_CRON_SECRET`. |
| **J1 – DSGVO** | Checkbox in **Einstellungen** = Einwilligung; Verantwortlicher/Kontakt über bestehende Stammdaten/Lizenz-API; Text bei Bedarf im Kunden-Onboarding ergänzen. |
| **I2 – Hardware** | QR-Etikett: Preset + Maße in **Einstellungen** (`etikettPreset.ts`); Bluetooth-Druck weiterhin **natives Capacitor-Plugin** – Pairing/MAC bei konkretem Drucker (v. a. **Bixolon**, **§7.6.4**). |
| **L4 – Pixel-Limit** | **§9.4a** nennt 512 px Breite; **Implementierung** `uploadTenantLogo.ts`: max. **Kante 2048 px** (WebP). Bei Bedarf angleichen oder Tabelle in §9.4a aktualisieren. |

**GitHub:** Issues aus dieser Liste anlegen: **`docs/GitHub-Roadmap-7.2.md`** (inkl. **T1** · `docs/github-issues/T1.body.md`, **CF1** · `docs/github-issues/CF1.body.md`) · Skript **`scripts/gh-roadmap-issues.sh`** (nach `gh auth login`).

---

### 7.3 Erledigte Meilensteine (Archiv)

Übersicht der umgesetzten Pakete (ohne vollständige Issue-Liste). Details weiterhin in **§9**, **§10**, **§11**.

| Paket | Inhalt (kurz) |
|-------|----------------|
| **A** | Menü **Info**, Trennung Einstellungen ↔ Benutzerverwaltung |
| **B** | Lizenzportal: Grenzwarnungen, abgelaufene Lizenz + Schonfrist, Supabase-Projekt/Schema (operativ **B3** = **L1**) |
| **C** | Benutzer anlegen mit Rollen; Portalbenutzer + Objekt/BV-Whitelist |
| **D** | Auftrag, `order_completions`, `/auftrag/:id`, Dashboard-Verlinkung |
| **E** | Labels Tür/Tor/Objekt-BV, Schema Tür unter Kunde, Türen verschieben, Wartungsvertrag |
| **F** | `portal_user_object_visibility` + Portal-API |
| **G** | Historie Detail-RPC |
| **H** | Stammdaten-Import |
| **I1** | Capacitor, Android/iOS Scripts |
| **J5** | Erweiterte Filter Kundenliste |
| **J8** | Lizenzportal: Mandanten-Export bei Kündigung |
| **J9** | Ladezeiten-Dashboard (`Ladezeiten.tsx`) |
| **L2–L3** | Status Grenzüberschreitung in Mandantenliste; Export JSON |
| **J2** | **Wartungsstatistik (MVP):** `src/pages/Wartungsstatistik.tsx`, Route `/wartungsstatistik`, KPIs/Tabellen/CSV |
| **J3** | **Buchhaltungs-Export (MVP):** `src/pages/BuchhaltungExport.tsx`, `/buchhaltung-export`, `accountingExportService.ts`, Feature `buchhaltung_export` |
| **J4** | **Zuletzt bearbeitet (MVP):** `Startseite.tsx`, `fetchRecentEditsForDashboard`, Layout-Sync `profiles.dashboard_layout` |
| **J4-B** | **Favoriten / „nur meine“:** `dashboardLayoutPreferences.ts`, `dataService.fetchRecentEditsForDashboard` (Scope), `Startseite.tsx` |
| **J1** | **Wartungs-E-Mail-Digest:** `profiles.maintenance_reminder_email_*`, RPC `get_maintenance_reminders_for_user_digest`, Edge `send-maintenance-reminder-digest`, `Einstellungen.tsx` |
| **L4** | **Logo-Upload Lizenzportal:** Bucket `tenant_logos` (**supabase-license-portal.sql**), `uploadTenantLogo.ts`, `MandantForm.tsx` |
| **I2** | **Etikett-Preset (UI):** `etikettPreset.ts`, Anzeige in **Einstellungen**; natives Druck weiter **Capacitor-Plugin** – **§11.4** |
| **J10** | **Bug-Erfassung (MVP):** `Fehlerberichte.tsx`, `app_errors`, `shared/errorReportService`, Feature `fehlerberichte` |

---

### 7.4 Backlog: Features nach Priorität (Referenz)

Langfristige Feature-Liste mit **Priorität** und **Aufwand** – nicht alles ist zeitnah in **§7.2** eingeplant. Nummern entsprechen der früheren Übersicht.

| # | Feature | Priorität | Aufwand | Hinweis |
|---|---------|-----------|---------|---------|
| 1 | Wartungsplanung / Erinnerungen | Hoch | 3–5 T | ✅ In-App + **E-Mail-Digest** (**J1**) – Betrieb: **§7.2.1** |
| 2 | Wartungsstatistik / Auswertung | Hoch | 3–4 T | ✅ **J2** (MVP); Charts optional |
| 3 | Export für Buchhaltung | Hoch | 2–3 T | ✅ **J3** (MVP); SevDesk/API später |
| 4 | Schnellzugriff / Zuletzt bearbeitet | Hoch | 1–2 T | ✅ **J4** (MVP) + **J4-B** Favoriten / „nur meine“ |
| 5 | Erweiterte Filter Kundenliste | Hoch | 2 T | ✅ **J5** |
| 6 | Umbau Wartung (MVP) | Hoch | 15–20 T | ⚠️ **J6** |
| 7 | Arbeitszeiterfassung (Modul) | Mittel | 5–8 T | ✅ umgesetzt (**§7.5** AZK) |
| 8 | Wartungs-Checkliste pro Objekttyp | Mittel | 3–4 T | Backlog |
| 9 | Mängel-Follow-up | Mittel | 3 T | 🔲 **J7** |
| 10 | Kalender-Sync (iCal) | Mittel | 2–3 T | 🔲 **J7** |
| 11 | 2FA | Mittel | 2–3 T | ✅ umgesetzt |
| 12 | Offline-Erweiterungen | Mittel | 3–5 T | ✅ (Kern) |
| 13 | Dokumente/Anhänge pro Objekt | Niedrig | 4 T | ✅ |
| 14 | Bulk-Operationen | Niedrig | 3 T | 🔲 **J7** |
| 15 | Portal: Push-Benachrichtigungen | Niedrig | 2–3 T | 🔲 **J7** |
| 16 | Ladezeiten-Monitoring | – | – | ✅ **J9** |
| 17 | Bug-Erfassungsmodul | Niedrig | 1–2 T | ✅ **J10** (MVP) |
| 18 | DB-Schema: Supabase-Migrations statt Monolith | Mittel | 0,5–2 T | 🔲 **T1** – **docs/sql/Supabase-Migrations-Strategie.md** |
| 19 | Hosting: Netlify → Cloudflare + Supabase Edge (Lizenz-API) | Mittel | Umsetzung nach **docs/Cloudflare-Umzug-Roadmap.md** | 🔲 **CF1** – **docs/Cloudflare-Umzug-und-Supabase-Auslagerung.md**, **docs/Cloudflare-Umzug-Roadmap.md** |

---

### 7.5 Kontext: Epics, Checklisten, Ist-Stand

#### Umbau Wartung: Auftrag → Monteursbericht

**Ziel:** Detaillierte Aufträge, Abarbeitung durch Monteur, Monteursbericht (Zeiten, Material), Freigabe → Kundenportal + Buchhaltung.

**Auftragstypen:** Einbau, Reparatur, Wartung, Nachprüfung, Sonstiges. Bei Wartung: Wartungsprotokoll nach DIN 14677 / ASR A1.7.

**Phasen:** (1) Aufträge erweitern → (2) Monteursbericht → (3) Freigabe-Workflow → (4) Kundenportal → (5) Wartungsprotokoll DIN/ASR → (6) Buchhaltungs-Export → (7) Offline, Material-Stammdaten → (8) Erweiterungen.

**Stand:** Monteursbericht / Completions / Auftragsdetail vorhanden; **Freigabe**, **Portal-Flow** und weitere Phasen offen (**J6**).

#### Arbeitszeiterfassung (Modul)

**Aktivierung:** Lizenzmodul. **Technisch:** `time_entries`, `time_breaks`, Route `/arbeitszeit`, RLS.

**Phase 1 ✅:** Tagesansicht, Start/Pause/Ende, ArbZG, Wochen-Summe, Offline/Outbox. **Phase 2 ✅:** Bearbeiten mit Grund, Wochen-/Monatsansicht, Log-Tab, Soll/Ist-Konto. **§11.6**, **§11.7–11.9** (GPS, Standort, IONOS).

#### Lizenzportal-Supabase anlegen (B3 = L1)

Ein separates Supabase-Projekt für das **Lizenzportal**; Haupt-App bleibt eigenes Projekt. **Checkliste:**

| # | Aufgabe | Erledigt? |
|---|---------|------------|
| 1 | Neues Supabase-Projekt anlegen | |
| 2 | `supabase-license-portal.sql` ausführen | |
| 3 | Auth: Redirect-URLs, ggf. E-Mail-Bestätigung | |
| 4 | API Keys (anon + ggf. service_role für Lizenz-API) | |
| 5 | Admin-App `VITE_SUPABASE_*` = Lizenzportal-Projekt | |
| 6 | Optional: `SUPABASE_LICENSE_PORTAL_*` für Netlify Functions | |
| 7 | Test: Admin-Login, Mandanten/Lizenzen | |

#### Verifikation ausgewählter Epics (Code-/Betriebsstand)

| Thema | Ergebnis |
|-------|----------|
| **B3 / L1** | Nur manuell prüfbar (zweites Supabase-Projekt) |
| **I1** Capacitor | ✅ |
| **I2** Bluetooth-Drucker | ⚠️ Preset/UI ✅; natives Plugin / Hardware optional |
| **J1** Wartungsplanung | ✅ In-App + **E-Mail-Digest** (Betrieb **§7.2.1**) |
| **J2–J4** | ✅ MVP (**§7.3**) |
| **J5** Filter | ✅ |
| **J6** Umbau Wartung | ⚠️ Teilweise |
| **J7** | ❌ |
| **J8–J9** | ✅ |
| **J10** Bug-Erfassung | ✅ MVP (**§7.3**) |

---

### 7.6 Konsolidierter Planungsstand (März 2026)

Ehemals verteilt auf `docs/Roadmap-Abarbeitung-Vorschlag.md`, `docs/Roadmap-Weiterentwicklung-und-Mandanten.md` und Teile von `docs/Noch-zu-erledigen.md` – **eine Quelle:** dieser Abschnitt + **§11**. Vertiefung **Urlaub/VJ/Soll:** `docs/Arbeitszeit-Soll-Urlaub-Planung.md`, `docs/Arbeitszeit-Rechtliche-Compliance.md`.

#### 7.6.1 Roadmap-IDs: Ist-Stand (Kurz)

| ID | Stand | Kurzreferenz |
|----|--------|----------------|
| **J1** | ✅ Digest | In-App ✅; **E-Mail** via Edge + Cron (**§7.2.1**). |
| **J2** | ✅ MVP | `/wartungsstatistik`, KPIs, Tabellen, CSV; optional Charts. |
| **J3** | ✅ MVP | `/buchhaltung-export`, `accountingExportService.ts`; **SevDesk/API** später. |
| **J4** | ✅ MVP A | `Startseite`, `profiles.dashboard_layout`; **J4-B** ✅ Favoriten/nur meine. |
| **J5** | ✅ | Erweiterte Filter `Kunden.tsx`. |
| **J6** | ⚠️ | Monteursbericht vorhanden; Freigabe/Portal/DIN großes Paket. |
| **J7** | 🔲 | Priorität: (1) Mängel-Follow-up → (2) Bulk → (3) Portal-Push; **iCal** nicht in dieser Runde. |
| **J10** | ✅ MVP | `Fehlerberichte`, `app_errors`, `errorReportService`. |
| **I2** | ⚠️ UI | Preset/Maße **Einstellungen**; Hardware/Plugin – **§11.4**, **§7.2.1**. |
| **L4** | ✅ | Logo-Upload Lizenzportal – **§9.4a**, Bucket `tenant_logos`. |
| **T1** | 🔲 | Supabase CLI-Migrations (Baseline + Deltas) – **docs/sql/Supabase-Migrations-Strategie.md**. |
| **CF1** | 🔲 | Cloudflare-Umzug umsetzen – **docs/Cloudflare-Umzug-Roadmap.md**; Entscheidungen **docs/Cloudflare-Umzug-und-Supabase-Auslagerung.md**. |

#### 7.6.2 Empfohlene Abarbeitungsreihenfolge (Phasen 0–7)

**Kurzfassung einer Sprint-Reihenfolge:** *Fundament → Haupt-App (J1–J4, Bug parallel) → einheitliche PDFs/Briefbogen → Urlaub-Block (Arbeitszeit) → J7-Paket → J6 → Ortung/Standort/I2 → Hosting/Performance.*

| Phase | Inhalt | Stand (März 2026) |
|-------|--------|-------------------|
| **0** | Anleitung App-Updates, Grenzüberschreitungen-Checkliste, Build/TS | ✅ |
| **1** | J4, J1 In-App, J2, J3, Bug-Modul parallel | ✅ MVP-Kern |
| **2** | PDF/Briefbogen querschnittlich (`pdfLetterhead`, `briefbogenClient`, u. a. Wartungsprotokoll, Zoll-PDF, Urlaubsbescheinigung) | ✅ |
| **3** | Urlaub VJ, Zusatzurlaub, Pending (Schema, Portal-UI) | ✅ MVP |
| **4** | **J7** ohne iCal: Mängel-Follow-up → Bulk → Portal-Push | 🔲 |
| **5** | **J6** Umbau Wartung (15–20 T) | 🔲 |
| **6** | GPS-Debug nach Live, Standortabfrage-Checkliste, **I2**-Abstraktion (Preset ✅), A4-QR-Batch/Etikettendesign | teilweise |
| **7** | **CF1:** Umsetzung **docs/Cloudflare-Umzug-Roadmap.md**; ggf. IONOS/Deploy parallel klären; `Optimierungsplan.md`, AZK-Optionen (Teamleiter-Extras) | 🔲 / später |

**Bewusst zurückgestellt:** iCal vor stabilem J1–J4; **SevDesk** nach J3-Basis; **J6** nicht parallel zu unstabilem J1–J4.

#### 7.6.3 Mandanten-Onboarding & Deploy (Phasen A–D)

| Phase | Inhalt | Stand |
|-------|--------|--------|
| **A** | Deployment-Hilfe im Lizenzportal (Env-Blöcke, Checkliste pro Mandant) | ✅ |
| **B** | Lizenz-API „nach Host“ (Portale ohne `VITE_LICENSE_NUMBER`) | ✅ |
| **C** | Skript/CI: `scripts/netlify-apply-tenant-env.mjs`, Export im Mandanten-Formular | ✅ |
| **D** | IaC (Terraform/Pulumi) + Supabase-/DNS-APIs | optional |

**Manuell bleibend:** Mandanten-Supabase, Netlify-Sites, DNS, Secrets – siehe `docs/Netlify-README.md`, `docs/Netlify-Vier-Apps.md`.

#### 7.6.4 Entscheidungen Roadmap J (übernommen)

| Punkt | Entscheidung |
|-------|----------------|
| **J1** | In-App MVP ✅; **E-Mail-Digest** ✅ (Edge + Cron, **§7.2.1**). |
| **J2–J4, J5** | MVP wie umgesetzt; **J4-B** ✅ Favoriten / „nur meine“. |
| **J6** | Eigenes Thema nach übriger Roadmap. |
| **J7** | Reihenfolge Mängel-Follow-up → Bulk → Portal-Push; **kein iCal** in dieser Runde. |
| **I2** | Preset/Maße in **Einstellungen** ✅; **Bixolon**-Favorit; Pairing/MAC in Hardware-Phase. |
| **GPS / Standort / IONOS** | Wie in **§11.7–11.9** und früheren Beschlüssen. |

#### 7.6.5 Etiketten: Bixolon-Presets & A4-Referenz (HERMA/Avery)

*Bixolon 2″:* typisch **58 mm** Rolle, bedruckbar oft **~48 mm** Breite – Layout/QR darin kalibrieren.

| Preset | Vorschlag B×H | Nutzung |
|--------|----------------|--------|
| **mini** | 50 × 25 mm | Kompakt |
| **mid** | 50 × 30 mm | Standard |
| **max** | 58 × 40 mm | Max. auf 58-mm-Rolle |

**A4-Sammel-PDF (Farbe):** Zellgröße ähnlich Thermo-Presets; exakte Kalibrierung pro gekauftem Bogen.

| Preset (Mobil) | Ziel ca. | Beispiel HERMA (A4) | Alternativ Avery |
|----------------|----------|---------------------|------------------|
| **mini** (~50×25 mm) | klein, viele/Blatt | **48,3 × 25,4 mm:** z. B. **5051**, **4608**, **10726** | **L4736REV-25:** 45,7 × 21,2 mm, 48/Blatt |
| **mid** (~50×30 mm) | Standard-Zelle | **52,5 × 29,7 mm:** z. B. **4610**, **4461**; Folie **4684** | Zweckform gleiche Klasse |
| **max** (~58×40 mm) | größere Zelle | **63,5 × 38,1 mm:** z. B. **5029**, **4677**, **10301**, **10727**, **8632** | z. B. **L7163** |

**Thermo-Rollen:** Händler nach „58 mm, Thermodirekt, Höhe 25/30/40 mm, Kern 12 mm“; max. Rollendurchmesser beachten. **Batch-Berechtigung:** Lizenz-Feature `qr_batch_a4` + vom Admin freigegebene Rollen – siehe **§11.4**.

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
├── supabase-complete.sql   # Referenz-Schema Mandanten-App (§9.19: künftig ggf. aus Modulen gebaut)
├── supabase-license-portal.sql
├── docs/sql/         # Delta-Migrationen Mandanten-DB, Changelog, Strategie (§9.19)
├── Vico.md           # Diese Dokumentation
├── BENUTZERANLEITUNG.md
├── docs/             # Setup, Betrieb, Vertiefung (siehe Vico.md §10.11, §11.12)
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

### 9.4a Logo-Upload im Lizenzportal (umgesetzt – Roadmap **L4**)

**Ziel:** Mandanten-Logo nicht nur per freier URL, sondern **direkt im Lizenzportal hochladen**; Speicherung an einem definierten Ort; **Dateigröße** und **Pixelmaße** begrenzen; beim Upload **optimieren** (kurze Ladezeiten); ohne Logo **einheitlicher Platzhalter** in allen Apps.

#### Entscheidungen (Abstimmung, Stand festgehalten)

| # | Thema | Entscheidung |
|---|--------|----------------|
| – | **CDN** zusätzlich | **Nein** – ausreichend öffentliche Storage-URL des Lizenzportal-Supabase. |
| – | **SVG** | **Nein** – nur **PNG/JPEG** als Upload. |
| – | **Auslieferungsformat** | **WebP** nach Optimierung (siehe unten); Konvertierung im Browser vor Upload. |
| – | **Roh-Upload max.** | **2 MB** |
| – | **Zielgröße nach Optimierung** | **150–300 KB** |
| – | **Max. Breite (Pixel)** | **512 px** (Höhe proportional, `object-contain`) |
| – | **Live-Vorschau** im Lizenzportal | **Ja** (z. B. Header- und Login-ähnliche Rahmen) |
| – | **Logo entfernen** | **Ja** – zurück zu Platzhalter, Storage-Objekt löschen |
| – | **Rechtstext / Nutzungshinweis** | **Nein** – kein zusätzlicher Pflicht-Hinweis im UI |

#### Vorschläge (Repo / Architektur, wo keine explizite Nutzerwahl)

| Thema | Vorschlag |
|-------|-----------|
| **1 – Gesamtansatz** | **Supabase Storage** (Lizenzportal), Bucket mit öffentlichem Lesen; `tenants.logo_url` = öffentliche URL; Upload in **Admin** (`MandantForm`): wählen → skalieren/komprimieren → **WebP** → `upload` → URL in DB; optional **altes Objekt** beim Überschreiben **löschen**. |
| **4 – WebP** | Ein **WebP**-Objekt pro Logo reicht für moderne Clients; optional später **PNG-Fallback** nur wenn nötig (ältere Druck-/PDF-Pfade). |
| **8 – Seitenverhältnis** | **Weich:** Verhältnis **Breite:Höhe** zwischen **1:4 und 4:1** – innerhalb normal hochladen; **außerhalb** nur **Warnhinweis** („sehr breites/hohes Logo kann in der Kopfzeile klein wirken“), **kein** harter Block. Weiterhin CSS **`object-contain`** (`Logo.tsx` etc.). |
| **11 – Versionen** | **Ein aktuelles Logo**, neuer Upload **ersetzt** das vorherige; **keine Historie** im MVP (weniger Speicher, einfachere Policies). |
| **13 – Einheitliches Asset** | **Eine** `logo_url` für **alle** Oberflächen: Haupt-App, Kundenportal, Arbeitszeitportal, QR/Druck – alles über **`design.logo_url`** der Lizenz-API. Keine separaten „Report-“ vs. „Header-“-Logos in L4. |
| **Speicher-Kontingent Mandant** | Logo-Speicher **nicht** gegen **`max_storage_mb`** der Haupt-App rechnen; Kontingent liegt im **Lizenzportal** (Bucket + ggf. internes Limit pro Mandant). |

#### Technische Umsetzung (Kurz)

| Thema | Festlegung |
|-------|------------|
| **Speicherort** | **Supabase Storage** im **Lizenzportal-Projekt**, Bucket **`tenant_logos`**, Pfad **`{tenant_id}/logo.webp`** (überschreiben bei neuem Upload). |
| **Metadaten** | `tenants.logo_url` = öffentliche URL; manuelle URL-Eingabe optional **parallel** oder nach Upload nur noch Anzeige (UI-Entscheidung bei Implementierung). |
| **Upload** | Client: max. **2 MB** Roh, **PNG/JPEG** → Skalierung max. **512 px** Breite → Kompression auf **150–300 KB** Ziel → **WebP** → Upload. |
| **Server** | Optional: Storage-Policy + MIME-Check; Roh-Upload nur `image/png`, `image/jpeg`. |

#### Platzhalter

- Haupt-App: `public/logo_vico.png`, wenn `design.logo_url` leer (**bereits** `Logo.tsx`).
- Portale/Arbeitszeit: gleicher Fallback prüfen/anpassen bei Umsetzung L4.

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

### 9.18 App-Versionen & Anzeige (Lizenzportal)

**Globale Defaults:** Tabelle **`platform_config`**, Key **`default_app_versions`** (`jsonb`, Default `{}`). Gilt für alle Mandanten, sofern der Mandant keinen abweichenden Eintrag hat. **Pflege:** Admin-App → **Einstellungen** → Abschnitt **„Globale App-Versionen“**.

**Mandant:** Tabelle `tenants`, Spalte **`app_versions`** (`jsonb`, Default `{}`). Pro Frontend-App optionale Keys: `main`, `kundenportal`, `arbeitszeit_portal`, `admin` – jeweils Objekt mit optional `version`, `releaseNotes` (String-Array), `releaseLabel`.

**Merge:** Lizenz-API merged **global → Mandant** (Mandant überschreibt pro App/Feld; bei Release Notes gewinnt ein nicht-leeres Mandanten-Array, sonst global).

**Pflege Mandant:** Admin-App → Mandant bearbeiten → **„App-Versionen (optional, Mandant)“**.

**Lizenz-API:** GET `…/license?licenseNumber=…` liefert zusätzlich **`appVersions`** (camelCase, gleiche Keys). Implementierung: Supabase Edge Function `license` und parallel Netlify `admin/netlify/functions/license.ts`.

**Clients:** Haupt-App (`LicenseContext` + `Info`), Kundenportal und Arbeitszeitenportal (`DesignContext` + `AppInfoContent`) zeigen die Angaben unter **„Lizenzportal (Anzeige)“**, sobald Inhalt gepflegt ist. Die **Build-Version** (`__APP_VERSION__` / `version.json`) bleibt die technische Referenz.

**Update-Check („Auf Updates prüfen“):** Vergleicht **`version.json`** (Deployment) mit der **lokalen Build-Version** per **SemVer** (`Major.Minor.Patch` am Anfang der Zeichenkette), siehe `shared/versionUtils.ts` (`isNewerVersion`).

**SemVer: Build vs. Lizenzportal-Anzeige:** Wenn sowohl Build als auch die im Portal gepflegte **Anzeigeversion** als SemVer lesbar sind (`x.y.z`), zeigt die UI optional einen Hinweis (`SemVerPortalBuildHint`):
- **Portal vor Build:** dokumentierte Version im Portal ist höher als der aktuelle Client-Build → typisch vor Rollout oder wenn Mandant früher gepflegt hat.
- **Build vor Portal:** Client ist neuer als die Portal-Anzeige → Mandantenpflege im Lizenzportal nachziehen.

**Policy:** Kein automatischer Vergleich, sobald eine der Versionen **nicht** dem Muster `x.y.z` entspricht (z. B. reine Texte, „v1.2“ ohne Patch) – dann nur Anzeige der Texte, kein SemVer-Banner.

---

### 9.19 Mandanten-DB: `supabase-complete.sql` modular pflegen & alle Mandanten gleichzeitig aktualisieren

**Ausgangslage:** `supabase-complete.sql` ist ein **Monolith** (ca. 3000 Zeilen): für Leser gut als **Inventar** und für **neue** Supabase-Projekte (einmaliger SQL-Editor-Lauf), aber unhandlich für **Reviews**, **Merge-Konflikte** und die Frage „was gehört zu welchem Release?“. Zusätzlich existieren **viele Mandanten-Projekte** mit **gleichem** Zielschema – Schemaänderungen sollen **einheitlich** und **nachvollziehbar** ausgerollt werden.

**Ziele**

1. **Wartung:** Änderungen in **kleinen, benannten Dateien** (Domains: Profile, Stammdaten, RPC, Storage, …) statt dauerndem Editieren einer Riesendatei.
2. **Reproduzierbarkeit:** Die Datei `supabase-complete.sql` im Repo soll **generiert** oder **zusammengebaut** werden können („Single Artifact“ für Greenfield), nicht als manuell zusammenkopierter Drift-Endpunkt.
3. **Rollout:** Dieselbe SQL-Änderung soll **sequentiell oder gebündelt** gegen **alle** Mandanten-Datenbanken laufen können – mit Trockenlauf, Abbruch bei Fehler und Audit-Spur.

Die folgenden Abschnitte sind ein **Umsetzungsvorschlag**; er schließt an **Roadmap T1** und **`docs/sql/Mandanten-DB-Workflow.md`** an.

---

#### 9.19.1 Sinnvolle Aufteilung (Module entlang der bestehenden Gliederung)

Die **logische Reihenfolge** ist bereits im Kopf von `supabase-complete.sql` dokumentiert (Abhängigkeiten: Tabellen/Spalten vor RPCs, Storage nach Tabellen, Indizes/Realtime am Ende). Daraus lässt sich eine **Modulstruktur** ableiten, z. B. unter einem neuen Verzeichnis:

```text
docs/sql/schema-mandant/          # oder: supabase/mandant/schema/
  _header.sql                     # Kurzkommentar + ggf. SET search_path / Hinweise
  01_profiles_rls.sql             # §1 Profiles & Rollen, Helper-Funktionen, erste Policies
  02_stammdaten.sql               # §2 customers, bvs, objects, Fotos, Dokumente, Verträge
  03_wartungsprotokolle.sql       # §3
  04_auftraege_zeit_urlaub.sql    # §4 orders, time_*, leave_*, component_settings, audit, …
  05_rpcs.sql                     # §5 RPCs (ggf. in 05a–05c splitten: allgemein / Lizenz / Standort)
  05b_lizenz.sql                  # §5b license, get_license_status, …
  05c_standortabfrage.sql         # §5c
  06_kundenportal.sql             # §6
  07_storage.sql                  # §7 Buckets + Policies
  07b_urlaub_phase3.sql           # §7b
  08_indizes_realtime.sql         # §8
```

**Regeln**

- **Keine zyklischen Abhängigkeiten:** Reihenfolge der `\\i`- oder Concat-Liste ist fest; bei Unsicherheit im Team ein **`manifest.json`** (oder `order.txt`) mit sortierter Dateiliste versionieren.
- **Idempotenz beibehalten:** Weiterhin `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` + neu anlegen – wie heute, damit Greenfield- und Notfall-Läufe robust bleiben.
- **Lizenzportal getrennt:** `supabase-license-portal.sql` **eigenes** Modulset (weniger Zeilen), gleiches Prinzip: Fragmente + Build → eine Referenzdatei.

**Build-Schritt (Vorschlag)**

- Kleines Node-Skript z. B. `scripts/build-supabase-complete.mjs`: liest `manifest.json`, konkateniert mit klarer Trennkommentar-Zeile, schreibt **`supabase-complete.sql`** (überschreibend).
- **Workflow:** Schema nur in den Fragmenten ändern → Build ausführen → Diff im PR zeigt nur das betroffene Modul (wenn Git die Fragmente trackt) und die **generierte** Datei (optional im PR pflichtig oder nur in Release-Branches).
- **Alternative:** Statt Generator nur **`\i`-Bootstrap**: eine schlanke `supabase-complete.sql`, die per `\\include`/`\\i` andere Dateien lädt – **funktioniert im psql-CLI**, im **Supabase SQL Editor** oft **ohne** Include-Support; deshalb ist **Konkatenation zu einer Datei** für „Copy-Paste ins Dashboard“ meist praktischer.

---

#### 9.19.2 Bestehende Mandanten: Deltas statt komplettes Replay

Für **laufende** Produktiv-DBs gilt weiterhin (siehe **`docs/sql/Mandanten-DB-Workflow.md`**):

- **`supabase-complete.sql`** = Referenz für **neue** Projekte und für „was ist Soll-Zustand“.
- **Jede Schemaänderung** zusätzlich als **eigene Delta-Datei** unter `docs/sql/` (z. B. `mandanten-db-<thema>-<kurz>.sql`), Eintrag in **`docs/sql/CHANGELOG-Mandanten-DB.md`**.
- Produktiv **nur das Delta** ausführen, nicht die komplette Monolith-Datei erneut (Risiko: lange Laufzeit, unbeabsichtigte Nebenwirkungen bei historischen Abweichungen).

Nach Einführung der Module können **Deltas** auch **aus dem Diff zweier generierter Stände** abgeleitet werden (operativ trotzdem als kleine Migration pflegen).

---

#### 9.19.3 Alle Mandanten gleichzeitig aktualisieren (Skripte & Betrieb)

**Bereits vorhanden:** `scripts/apply-mandanten-sql.mjs`

- Nimmt **eine SQL-Datei** und eine **URL-Liste** (`configs/mandanten-db-urls.local.txt`, nicht im Repo; Vorlage `configs/mandanten-db-urls.example.txt`).
- Führt **`psql`** mit **`-v ON_ERROR_STOP=1`** **nacheinander** aus; bricht beim **ersten** Fehler ab (sicher für konsistenten Stand).
- **Trockenlauf:** `--dry-run` listet nur URLs (maskiert).

**Empfohlener Ablauf pro Änderung**

1. Delta-SQL schreiben + Changelog.
2. **Staging-Mandant** (falls vorhanden) manuell oder per Skript testen.
3. `apply-mandanten-sql.mjs … --dry-run` gegen Produktionsliste prüfen.
4. Echtlauf ohne `--dry-run`; bei Abbruch: Liste der **noch nicht** bearbeiteten Mandanten notieren und nach Fix **fortsetzen** (Skript startet von vorn – daher Reihenfolge in der Datei stabil halten oder bereits erfolgreiche Mandanten auskommentieren).

**Erweiterungen (optional, später)**

| Idee | Nutzen |
|------|--------|
| Flag **`--continue-on-error`** | Alle Mandanten anfahren, am Ende Report wer fehlgeschlagen ist (Achtung: dann ist der Bestand **heterogen**). |
| **Parallelität** (z. B. 2–3 Worker) | Kürzere Gesamtdauer; Risiko: Connection-Limits bei Supabase, schwerer zu debuggen. |
| **Protokoll** `logs/mandanten-sql-<datum>.log` | Audit: wer wann welche Datei gegen welche URL (ohne Passwort im Klartext). |
| **Inventar aus Lizenzportal** | Export `project_ref` / Metadaten → generiert **keine** Secrets, aber erinnert an **alle** Mandanten; URLs weiterhin lokal/secrets. |
| **Supabase CLI** `db execute` | Statt `psql`, wenn ihr einheitlich CLI nutzt; Voraussetzung: DB-URL oder verlinktes Projekt pro Mandant. |
| **GitHub Actions** | Secrets pro Staging/Prod oder eine **verschlüsselte** URL-Liste im Vault; Matrix-Job **sequentiell** für Prod. |

**Wichtig:** Vor dem Massen-Rollout prüfen, ob alle Mandanten **dieselbe Ausgangsbasis** haben (oder Deltas **defensiv** schreiben: `IF NOT EXISTS`, fehlende Objekte überspringen). Bei stark driftenden Alt-Mandanten ggf. **einmaliger** Abgleich mit generiertem Complete in Wartungsfenster oder manuelle Analyse.

---

#### 9.19.4 Langfristig: Migrations-Tabelle (optional)

Für höhere Sicherheit kann pro Mandanten-DB eine Tabelle **`public.schema_migrations`** (oder Nutzung der **Supabase-Migrations-Historie** bei CLI-gesteuerten Projekten) geführt werden: **Name/Hash der Migration**, **angewendet am**. Dann kann ein Skript **nur fehlende** Dateien anwenden. Das ist der Übergang zu **T1** „Supabase CLI-Migrations zeitlich geordnet“ (`docs/sql/Supabase-Migrations-Strategie.md`). Bis dahin reichen **CHANGELOG + Delta-Dateien + sequentielles psql**.

---

#### 9.19.5 Kurz-Entscheid: Einstellungen vs. „alles in eine Datei“

| Vorgehen | Wann sinnvoll |
|----------|----------------|
| **Modulare Fragmente + Build → `supabase-complete.sql`** | Hauptpfad für Entwicklung; eine generierte Datei fürs Dashboard und für Doku-Links. |
| **Nur Deltas in `docs/sql/` + `apply-mandanten-sql.mjs`** | Täglicher Betrieb für **bestehende** Mandanten (bereits etabliert). |
| **Vollständiges Replay von `supabase-complete.sql` auf Prod** | Nur für **neue** Projekte oder nach expliziter Freigabe / Notfall mit Backup. |

**Verweise:** `docs/sql/Mandanten-DB-Workflow.md`, `docs/sql/CHANGELOG-Mandanten-DB.md`, `docs/sql/Supabase-Migrations-Strategie.md`, `scripts/apply-mandanten-sql.mjs`, `configs/mandanten-db-urls.example.txt`, `configs/mandanten-registry.example.json`.

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
| Roadmap-Reihenfolge | **Vico.md §7.6.2** | Phasen 0–7 (konsolidiert) |
| DB-Backup (Live) | `docs/Supabase-Datenbank-Backup.md` | GitHub Action, pg_dump lokal, Dashboard – nicht in Git |
| App-Updates (Betrieb) | `docs/Anleitung-App-Updates-fuer-Betrieb.md` | Schritt-für-Schritt Releases je App |
| Grenzüberschreitungen (Checkliste) | `docs/Verifikation-Grenzueberschreitungen-Checkliste.md` | Live-Verifikation Lizenzkette |

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

**Umsetzung (MVP ✅):** `src/Fehlerberichte.tsx`, Feature `fehlerberichte` (`LicenseFeatureGuard`), Einbindung in `main.tsx` / `ErrorBoundary` u. a.; Feinschliff (Filter, Workflow) optional – **§7.3** (**J10**).

---

### 11.4 Etikettendrucker (QR aus der App)

**Anforderungen:** Mobil, Akku, kleine Etiketten, **Bluetooth**, **Android**, Druck **aus der Vico-App** (nicht nur Hersteller-App). Web/PWA allein reicht nicht zuverlässig → **native Schicht nötig**.

**Modellvorschläge (mit Android-SDK):** Zebra ZQ220/ZQ320 (Link-OS SDK), Brother RJ-2150 (Brother SDK), Bixolon SPP-R200III. **Consumer-Drucker** ohne SDK: ungeeignet.

**Integration:** **Option A (entschieden):** Capacitor + Plugin. Option B: Helper-App + Intent. Option C: Share an Hersteller-App (Workaround).

**Code:** `src/lib/etikettendrucker.ts` – `isEtikettendruckerAvailable()`, `printLabel(qrPayload)`.

**Etikettendesign (Planung):** Ein **mandantenweites Layout** (wie Druckvorlagen), **Presets mini/mid/max** für Bixolon 2″ (ca. 50×25 / 50×30 / 58×40 mm; **Druckbreite ~48 mm** beachten), **separates Etiketten-Logo** neben dem allgemeinen Mandantenlogo, **Vorschau** vor Druck. **Render:** ein farbfähiges Layout; **Thermo** druckt **Graustufen**. **A4-Sammel-PDF (Haupt-App):** Umgesetzt – `src/lib/generateQrBatchA4Pdf.ts`, Kundenansicht **Mehrfachauswahl** (Checkboxen), Lizenz-Feature **`qr_batch_a4`**, Rollen **admin / teamleiter / mitarbeiter / operator / demo** (Leser ausgeschlossen); **kein** Kundenportal. **A4-Bogenmaße / HERMA-Avery:** **§7.6.5**.

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

Details zu J1–J10 u. a.: **Vico.md §7** und **§7.6**. `docs/Noch-zu-erledigen.md` ist ein **Kurz-Verweis**; `docs/Offene-Module-Vorschlaege.md` nur Stub.

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
| `docs/Roadmap-Abarbeitung-Vorschlag.md` (entfernt) | **§7.6.2** |
| `docs/Roadmap-Weiterentwicklung-und-Mandanten.md` (entfernt) | **§7.6.3** |
| `docs/Noch-zu-erledigen.md` (Kurz-Stub) | **§7**, **§7.6**; Vertiefung in `docs/Arbeitszeit-*.md` |

---

### 11.12 Dokumentation, die bewusst in `docs/` bleibt

- **Roadmap & Mandanten-Strategie (Phasen A–D, Sprint-Reihenfolge):** **`Vico.md` §7.6** (einzige konsolidierte Planung)
- **Setup & Betrieb:** `Lizenzportal-Setup.md`, `Demokunde-Setup.md`, `Release-Checkliste.md`, `App-Updates-und-Versionierung.md`, `Supabase-Datenbank-Backup.md`, `Benutzer-loeschen-Supabase.md` (Auth-User löschen, FK-Migration)
- **Technik/Performance:** `Optimierungsplan.md`
- **Migrationen / SQL-Hinweise:** wie in Repo dokumentiert (`supabase-*.sql`)
- **Vertiefung Arbeitszeit:** `Arbeitszeit-Feature-Liste.md`, `Arbeitszeit-Soll-Urlaub-Planung.md`, `Arbeitszeit-Rechtliche-Compliance.md`
- **Kurz-Verweis ehem. Aufgabenliste:** `Noch-zu-erledigen.md` → zeigt auf **Vico.md §7**
- **App-Updates (Betrieb):** `Anleitung-App-Updates-fuer-Betrieb.md`
- **Grenzüberschreitungen (Checkliste):** `Verifikation-Grenzueberschreitungen-Checkliste.md`

---

*Ende Abschnitt 11.*
