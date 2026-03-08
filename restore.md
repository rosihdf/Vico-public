# Restore – Wiederherstellungsdokumentation

Stand: 16. Februar 2025

---

## Wiederherstellungsstand (16.02.2025)

Folgende Punkte wurden wiederhergestellt:

| Feature | Status |
|---------|--------|
| **versionUtils** | ✅ `src/lib/versionUtils.ts` mit `isNewerVersion()` |
| **UpdateBanner** | ✅ `src/UpdateBanner.tsx`, eingebunden in `Layout.tsx` |
| **objectUtils** | ✅ `src/lib/objectUtils.ts` mit `getObjectDisplayName()` |
| **Objekt-Anzeige** | ✅ Suche, AuftragAnlegen, Wartungsprotokolle, PDF, QR-Code, Startseite |
| **Rechte** | ✅ Objekt löschen nur Admin (`Objekte.tsx`), BV anlegen nur Admin (`Kunden.tsx`) |
| **Checkliste** | ✅ `checklistData.json`, `generateChecklistPdf.ts`, `scripts/generate-checklist-pdf.mjs`, `npm run generate-checklist`, Build-Integration |
| **Historie** | ⏳ Noch offen (Audit-Log) |
| **Adressuche** | ⏳ Bereits durch Photon/AddressLookupFields ersetzt |

---

## Aktueller Commit-Stand

| | |
|---|---|
| **Hash** | `f8a6f63` |
| **Vollständig** | `f8a6f6384b1d20997781ab970131ee6a43eac202` |
| **Autor** | Micha |
| **Datum** | 04.03.2026 |
| **Nachricht** | Fix: Offline-Anlegen mehrerer BVs/Objekte – alle werden angezeigt |

**Branch:** main (up to date with origin/main)  
**Arbeitsbaum:** clean

---

## Durchgeführte Aktion

Die App wurde mit `git restore .` und `git clean -fd` auf den letzten Commit zurückgesetzt. Alle lokalen Änderungen wurden verworfen.

---

## Entfernte neue, unversionierte Dateien

| Datei/Ordner | Beschreibung |
|--------------|--------------|
| **RESTORE-PLAN.md** | Plan zur Wiederherstellung uncommitteter Änderungen |
| **public/Vico-Test-Checkliste.pdf** | Statische Test-Checkliste als PDF |
| **scripts/** | Ordner mit Build-Skripten |
| ↳ **scripts/generate-checklist-pdf.mjs** | Skript zum Erzeugen der Checkliste-PDF |
| **src/Historie.tsx** | Admin-Seite für das Audit-Log |
| **src/UpdateBanner.tsx** | Hinweis auf verfügbare Updates |
| **src/components/AddressFields.tsx** | Adressfelder mit PLZ-/Straßen-Autovervollständigung |
| **src/lib/addressService.ts** | OpenPLZ-API für PLZ→Ort und Straßen |
| **src/lib/checklistData.json** | Daten für die Test-Checkliste |
| **src/lib/generateChecklistPdf.ts** | PDF-Generierung der Checkliste |
| **src/lib/objectUtils.ts** | Hilfsfunktionen (z. B. `getObjectDisplayName`) |
| **src/lib/versionUtils.ts** | Versionsvergleich (`isNewerVersion`) |
| **.cursor/rules** | Cursor-Regeln (z. B. Project Scope) |

---

## Wiederhergestellte geänderte Dateien (auf Commit-Stand zurückgesetzt)

| Datei | Beschreibung |
|-------|--------------|
| `.cursorrules` | Project Scope (nur Web-App) |
| `mobile/lib/dataService.ts` | – |
| `mobile/lib/syncService.ts` | – |
| `mobile/lib/types.ts` | – |
| `mobile/screens/BVsScreen.tsx` | – |
| `mobile/screens/KundenScreen.tsx` | – |
| `mobile/screens/StartseiteScreen.tsx` | – |
| `package.json` | – |
| `src/App.tsx` | – |
| `src/AuftragAnlegen.tsx` | – |
| `src/BVs.tsx` | – |
| `src/Benutzerverwaltung.tsx` | – |
| `src/Einstellungen.tsx` | – |
| `src/Kunden.tsx` | – |
| `src/Layout.tsx` | – |
| `src/ObjectQRCodeModal.tsx` | – |
| `src/Objekte.tsx` | – |
| `src/Profil.tsx` | – |
| `src/Startseite.tsx` | – |
| `src/Suche.tsx` | – |
| `src/Wartungsprotokolle.tsx` | – |
| `src/lib/dataService.ts` | – |
| `src/lib/generateMaintenancePdf.ts` | – |
| `src/lib/syncService.ts` | – |
| `src/types.ts` | – |
| `supabase-complete.sql` | – |

---

## Kontext: Was war vor dem Reset implementiert?

- **Historie:** Admin-Audit-Log mit `fetchAuditLog`, Route `/historie`
- **Update-Banner:** Hinweis bei neuer Version, Versionsvergleich mit `isNewerVersion`
- **Adressuche:** OpenPLZ API, `AddressFields`-Komponente, PLZ→Ort, Straßen-Vorschläge
- **Objekt-Name:** `getObjectDisplayName` in Suche, AuftragAnlegen, Wartungsprotokolle, PDF, QR-Code
- **Rechte:** Objekt löschen nur Admins, BV anlegen nur Admins
- **Checkliste:** PDF-Generierung, statische Datei, Build-Script
- **Formular-Reihenfolge:** PLZ + Ort zuerst in AddressFields
- **supabase-complete.sql:** Restrukturierung, Audit-Log, BV-Policy
