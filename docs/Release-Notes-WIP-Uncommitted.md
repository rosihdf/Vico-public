# WIP: Zusammenfassung nicht committeter Änderungen

**Lizenzportal-Rollout dieses Bundles:** siehe **`docs/Lizenzportal-Update-Rollout.md`** und SQL **`docs/sql/license-portal-app-releases-2026-04-10-bundle.sql`**.

Stand: Arbeitsbaum gegen `origin/main` (lokal, vor Commit).  
Statistik: **42 Dateien**, ca. **+2813 / −552** Zeilen.

---

## 1. Kurzüberblick nach Themen

| Thema | Inhalt (kurz) |
|--------|----------------|
| **Prüfprotokoll-PDF** | Layout, Nummerierung, Fußzeile, Abschluss-Box, Prüfobjekt, laufende Nr., QR unten rechts am Blatt |
| **Monteursbericht-PDF** | Briefbogen-Ränder/Folgeseite, Tür-Zusammenfassungen, Prüfprotokoll-Hinweis |
| **Briefbogen / PDF-Layout** | Gemeinsames Modul `pdfBriefbogenLayout.ts`, Erweiterungen `briefbogenClient` / `briefbogenService` |
| **Checklisten** | Hinweis ohne Mangel (`advisory`), Kataloge, Panels, PDF-Mangel/Hinweis-Blöcke |
| **Datenbank Mandant** | `pruefprotokoll_laufnummer`, ggf. `related_order_id`, Header/Doku in SQL |
| **Lizenzportal** | `kundenportal_url` am Tenant, SQL-Doku, Lizenz-API, Beta-Feedback (Tabelle/Edge) |
| **Lizenz / App** | Feature `teamfunktion`, `design.kundenportal_url`, `VITE_KUNDENPORTAL_URL` |
| **Aufträge / UI** | `Auftragsdetail`, `AuftragAnlegen`, QR-Auftrag, Kunden, Einstellungen, Benutzerverwaltung, … |
| **Portal / AZ-Portal** | Berichte, Export-Compliance (Briefbogen-Margins) |
| **Admin** | Mandantenformular (`kundenportal_url`), `tenantService` |
| **Doku** | `Vico.md` (Terminologie Prüfungsauftrag), Roadmap, Konzept `QR-Auftrag-BV-Zusammenfuehrung-Konzept.md` |

---

## 2. Release Notes (für Nutzer:innen & Betrieb)

### Haupt-App

- **Prüfprotokoll (PDF):** Nummerierung der Punkte wie in der App; Abschnitt **Prüfobjekt** (statt Tür-/Tor-Zuordnung); **laufende Prüfprotokoll-Nummer** (`PP-000042`) in Fußzeile und im Titel; bei fehlender DB-Nummer Entwurfs-Kennung `PP-ENTW-…`.
- **Prüfprotokoll (PDF):** Ergebnis **Prüfung / Mängel gesamt** deutlich hervorgehoben; Seitenumbrüche mit Fortsetzungskopf für Checklisten.
- **Prüfprotokoll (PDF):** **QR-Code** unten rechts auf dem **Blatt** (nicht nur Textfeld), Beschriftung „Portal-Link“, wenn Kundenportal-URL und Report-ID vorliegen.
- **Checklisten Tür / Feststell:** **Hinweis / empfohlene Maßnahme** ohne Mangelbefund (parallel zu Mangel möglich); Speicherung in `completion_extra`; PDF berücksichtigt Hinweise.
- **Lizenz / Design:** optionale **`kundenportal_url`** aus der Lizenz-API (u. a. für Portal-QR im PDF); Fallback-Umgebungsvariable **`VITE_KUNDENPORTAL_URL`**.
- **Lizenz:** neues Feature-Flag **`teamfunktion`** (Teamverwaltung in Benutzerverwaltung, je Lizenzmodell).
- **Aufträge:** u. a. **`related_order_id`** (fachlich verknüpfter Auftrag); Anpassungen in Auftragsdetail, Anlegen, aus QR, offene Mängel, Kundenliste, Objekt-Modal, Wartungsprotokolle, Logo, Kamera-Modal, Kalender.
- **Terminologie:** in Doku/UI stärker **Prüfungsauftrag** statt „Wartungsauftrag“, wo gemeint (siehe `Vico.md`).

### Kundenportal

- Anpassungen **Berichte** (u. a. Prüfprotokoll-Kontext).

### Arbeitszeitenportal

- **Zoll-/Compliance-PDF-Export:** nutzt Briefbogen-Textlayout (Ränder, Folgeseite) konsistent zur Haupt-App.

### Admin (Lizenzportal-UI)

- Pro Mandant: **Kundenportal-URL (vollständig)** pflegbar (`kundenportal_url`), Hinweis auf Lizenz-API / QR-Deep-Links.

### Datenbank / Rollout

- **Mandanten-DB (`supabase-complete.sql`):** u. a.  
  - `maintenance_reports.pruefprotokoll_laufnummer` + Sequenz + Backfill + Unique-Index  
  - `orders.related_order_id` (soweit im Diff enthalten)  
  - erweiterte **Header-/Pflege-Doku** (Zuständigkeit LP vs. Mandant-DB).
- **Lizenzportal-DB (`supabase-license-portal.sql`):** u. a. `tenants.kundenportal_url`, Doku-Header, **Beta-Feedback**-Schema/RLS (soweit im Branch).
- **Edge:** `license`-Function ggf. um ausgelieferte Felder/Features erweitert.

### Ops / Migration

1. **Zuerst** Lizenzportal-SQL deployen (Spalte `kundenportal_url`, ggf. Beta-Feedback), **danach** Mandanten-DB gemäß Workflow (`supabase-complete.sql` bzw. Sammel-Rollout).
2. Ohne Migration `pruefprotokoll_laufnummer` zeigt das PDF die **Entwurfs-Kennung** bis die Spalte existiert und Zeilen befüllt sind.

---

## 3. Technische Dateiliste (gruppiert)

### PDF & Briefbogen

- `shared/pdfBriefbogenLayout.ts` **(neu)**
- `shared/briefbogenClient.ts`, `src/lib/briefbogenService.ts`
- `src/lib/generatePruefprotokollPdf.ts`
- `src/lib/generateMonteurBerichtPdf.ts`
- `src/lib/generateMaintenancePdf.ts`

### Checklisten & Typen

- `src/lib/doorMaintenanceChecklistCatalog.ts`, `src/lib/feststellChecklistCatalog.ts`
- `src/components/WartungOrderChecklistPanel.tsx`, `FeststellOrderChecklistPanel.tsx`
- `src/types/orderCompletionExtra.ts`, `order.ts`, `maintenance.ts`

### Daten & API

- `src/lib/dataService.ts`, `dataColumns.ts`, `protocolOpenMangels.ts`, `accountingExportService.ts`, `licensePortalApi.ts`

### UI Haupt-App

- `src/Auftragsdetail.tsx`, `AuftragAnlegen.tsx`, `AuftragAusQr.tsx`, `OffeneMaengel.tsx`
- `src/Einstellungen.tsx`, `Kunden.tsx`, `Benutzerverwaltung.tsx`, `Wartungsprotokolle.tsx`
- `src/ObjectQRCodeModal.tsx`, `Logo.tsx`, `LicenseContext.tsx`
- `src/components/ObjectFormModal.tsx`, `OrderCalendar.tsx`, `CameraCaptureModal.tsx`

### Portal / Arbeitszeit / Admin / Lizenz

- `portal/src/pages/Berichte.tsx`
- `arbeitszeit-portal/src/lib/exportCompliance.ts`
- `admin/src/pages/MandantForm.tsx`, `admin/src/lib/tenantService.ts`
- `shared/licenseFeatures.ts`
- `supabase-license-portal/supabase/functions/license/index.ts`

### SQL & Doku

- `supabase-complete.sql`, `supabase-license-portal.sql`
- `Vico.md`, `docs/Roadmap-Offene-Punkte.md`
- `docs/QR-Auftrag-BV-Zusammenfuehrung-Konzept.md` **(neu)**
- `src/vite-env.d.ts`

---

## 4. Bekannte Punkte vor Merge

- **`tsc`:** `src/components/OrderCalendar.tsx` – `useMemo` nicht importiert / nicht im Scope (Build bricht mit aktuellem Stand ggf. ab). Vor Release beheben.
- Umfangreicher Branch: **manuelles Testen** (Wartung abschließen, PDFs, Portal, Admin-Mandant, AZ-Export) empfohlen.

---

## 5. Vorschlag Commit-Message (eine Zeile)

```
feat: Prüfprotokoll-PDF (Nr., QR, Layout), Checklisten-Hinweis, Briefbogen-PDFs, LP kundenportal_url, related_order_id, Lizenz teamfunktion, SQL-Migrationen
```

Optional in mehrere Commits splitten: (1) SQL + Typen, (2) PDF/Briefbogen, (3) Checklisten/UI, (4) Lizenz/Portal/Admin.
