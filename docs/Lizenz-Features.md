# Lizenz: Module (Features) & Kontingente

Zentrale Key-Liste: **`shared/licenseFeatures.ts`** (`LICENSE_FEATURE_KEYS`, `LICENSE_FEATURE_LABELS`, `emptyLicenseFeatures`, `normalizeLicenseFeatures`).

## Modul-Schalter (JSON `licenses.features`)

| Key | Bedeutung | Durchsetzung (Stand) |
|-----|-----------|------------------------|
| `kundenportal` | Kundenportal-App | Haupt-App: Rolle „Kunde“; **Kundenportal**: Zugang blockiert ohne Feature |
| `historie` | System → Historie | Route `/system/historie` |
| `arbeitszeiterfassung` | Arbeitszeit in Haupt-App | Navigation, Seite Arbeitszeit |
| `standortabfrage` | Standort / GPS-Einwilligung | Einstellungen, Arbeitszeit, AZ-Portal Standort |
| `wartungsprotokolle` | Wartungsprotokolle, Wartungsstatistik | Routen `…/wartung`, `/wartungsstatistik` |
| `buchhaltung_export` | Seite Buchhaltungs-Export | Route `/buchhaltung-export` |
| `urlaub` | Urlaub im Arbeitszeit-Portal | Navigation + Route `/urlaub` |
| `fehlerberichte` | System → Fehlerberichte | Route `/system/fehlerberichte` |
| `ladezeiten` | System → Ladezeiten (Diagnose) | Route `/system/ladezeiten` |

### Manuell / keine Tier-Auto-Module

- **Haupt-App:** `hasFeature()` ist **nur** `true`, wenn in `license.features` der Key **explizit** `true` ist (kein Tier-Fallback).
- **Lizenz-API (Edge Function):** `features = { …license_models.features, …licenses.features }` – **ohne** automatische Tier-Defaults. Fehlende Keys = in der App **nicht** aktiv.
- **Lizenzmodelle** und **Lizenzen** im Admin müssen Module bewusst setzen (Checkboxen). Seeds in `supabase-license-portal.sql` liefern nur **Default-Vorlagen** für neue Installationen.

### Info-Seite

Die Anzeige „Module“ nutzt **`normalizeLicenseFeatures(license.features)`** (bekannte Keys, fehlende → `false`) – entspricht der sichtbaren Buchung, **ohne** Tier-Erfindung.

## Kontingente (Zahlen)

| Feld | Quelle |
|------|--------|
| `max_users` / `max_customers` | Lizenz-API / RPC |
| `max_storage_mb` | Lizenz-API; **Offline:** zusätzlich aus letztem **Lizenz-API-Cache** (`localStorage`), siehe `mergeLicenseApiCacheIntoStatus` in `src/lib/licenseService.ts` |

So bleibt das Speicher-Kontingent nutzbar, wenn die Mandanten-RPC offline oder ohne `max_storage_mb` antwortet, der **Lizenz-API-Cache** aber noch einen Wert vom letzten Online-Check enthält.

## Praktischer Rat

1. Neue Module: Key in `shared/licenseFeatures.ts` + Admin (importiert dieselbe Liste) + Route/UI + Edge-Response (keine Tier-Magie).
2. Kritische Regeln zusätzlich in **RPC/RLS** der Mandanten-DB absichern.

## Deployment

- Edge Function **`license`** nach Änderungen neu deployen.
- Bestehende Mandanten: fehlende Keys in `features` bleiben **inaktiv**, bis im Lizenz-Admin gesetzt.
