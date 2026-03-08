# Vico – Türen & Tore

Wartungs- und Mängeldokumentation für Türen und Tore. Stand: Februar 2025.

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

---

## 4. Datenbank (Supabase)

### Tabellen

- profiles, customers, bvs, objects
- object_photos, maintenance_reports, maintenance_report_photos, maintenance_report_smoke_detectors
- orders, component_settings, audit_log

### Indizes

- bvs(customer_id), objects(bv_id)
- maintenance_reports(object_id), maintenance_reports(object_id, maintenance_date)
- orders(order_date, assigned_to, customer_id, bv_id)
- component_settings(sort_order), audit_log(created_at)

### Schema

`supabase-complete.sql` im Supabase SQL Editor ausführen (idempotent). Enthält Rollen (admin, mitarbeiter, operator, leser), RLS, RPCs, Audit-Trigger.

---

## 5. Deployment (Netlify)

1. **Git:** Repo mit GitHub verbinden
2. **Netlify:** Add site → Deploy with GitHub
3. **Build:** `npm run build`, Publish: `dist`
4. **Env:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. **Supabase:** Site URL + Redirect URLs (`/reset-password`)

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

- DSGVO, Lizenzmodell
- Kundenportal für Wartungsberichte

### Geplante Verbesserungen

1. ~~**Kundenübersicht/Objekte – Wartungsstatus anzeigen**~~ ✅ (Ampelfarben: rot=überfällig, gelb=bald fällig, grün=ok)

2. ~~**Erweiterte Vico Web App Test-Checkliste erstellen**~~ ✅

3. ~~**Objekte-ID im Formular**~~ ✅

4. ~~**Rauchmelder Jahresauswahl**~~ ✅

5. ~~**Objekt-Feldnamen in der Kundenübersicht**~~ ✅

6. ~~**Demo-Account mit 24h-Löschung**~~ ✅ (Rolle "demo", RLS, RPC cleanup_demo_customers_older_than_24h, GitHub Actions)

7. ~~**Benutzeranleitung erstellen**~~ ✅ (BENUTZERANLEITUNG.md)

8. ~~**Supabase-Inaktivierung vermeiden**~~ ✅ (GitHub Actions Keep-Alive: `.github/workflows/supabase-keepalive.yml`)

---

## 8. Projektstruktur

```
Vico/
├── src/
│   ├── components/     # AddressLookupFields, OrderCalendar, ObjectFormModal
│   ├── lib/            # dataService, offlineStorage, Utils, PDF-Generierung
│   ├── types/          # TypeScript-Typen (customer, bv, object, order, maintenance)
│   └── *.tsx           # Seiten, Layout, Auth, Context
├── public/             # Favicon, Logo, Checkliste-PDF, version.json (Dev-Fallback)
├── scripts/            # generate-checklist-webapp-pdf.mjs
├── supabase/           # Edge Functions (send-maintenance-report)
├── supabase-complete.sql
├── Vico.md
├── BENUTZERANLEITUNG.md
├── netlify.toml
├── .github/workflows/ci.yml
├── .npmrc
└── eslint.config.js
```
