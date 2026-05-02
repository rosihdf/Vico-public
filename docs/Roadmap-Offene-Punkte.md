# Roadmap: Offene Punkte

**Stand:** April 2026 (Abgleich Code ↔ Tabelle: **2026-04-04**)  
**Maßgeblich:** [`Vico.md`](../Vico.md) §7 (Roadmap), **§11.17**–**§11.20** (Protokoll-Mängel, Degraded-Netz, Portal Auftragsflow, **LP Release-Verwaltung / Incoming**).  
Diese Datei **strukturiert die Abarbeitung in kleine Arbeitspakete**; fachliche Tiefe und Archiv bleiben in `Vico.md`.

### Was ist (noch) wirklich offen?

Ein Befehl wie „alles offene abarbeiten“ trifft **mehrere Epics** (Wochen/Monate). **Im Kern umgesetzt** (siehe ✅ in Teil B unten): **WP-MANG-01–05**, **WP-NET-01–05**, **WP-NET-10**, **WP-PORTAL-01–03**, **WP-ORD-02**, **WP-REL-00**–**04** (siehe Zeilen unten). **Weiterhin groß und offen (🔲):** **WP-REL-03** (optional Ausbau), **WP-J6-***, **WP-J7-***, **WP-T1**, **WP-CF1**/**CF1b**, dazu **Teil C**/**D** wie unten. **Rollout / manuell:** **WP-MANG-00** (Stammdaten-Mängel Phase 1/2), **WP-ORD-01** (Alt-Duplikate pro Tür in bestehenden Mandanten).

---

## Legende

| Symbol | Bedeutung |
|--------|-----------|
| 🔲 | Nicht begonnen |
| ⚠️ | Teilweise / nächste Stufe offen / manueller Rest |
| ✅ | **Kern** im Code umgesetzt; Feinschliff, Betrieb oder Optionales steht in der Spalte **Hinweis** |
| **T** | Arbeitstage (Schätzung, 1 Entwickler) |
| **WP-** | Arbeitspaket-ID (Referenz in Issues/Tickets) |

---

## Teil A – Empfohlene Gesamtreihenfolge

Kurzüberblick, **ohne** jedes Paket zu wiederholen (Detail = **Teil B**):

1. **Vorbereitung:** **WP-MANG-00** (Alt-Daten / Stammdaten-Mängel-Rollout) vor Entfernen der Stammdaten-UI.
2. **Produkt Hauptapp:** **WP-MANG-01–05** und **WP-NET-01–05**/**10** sind **Kern ✅**; **WP-REL-00**–**04** **Kern ✅** → Fokus auf **WP-REL-03**, **J6/J7**, **T1**, **CF1** oder Feinschliff in den Hinweisspalten.
3. **J7-Slices:** **WP-J7-01–03** nach Kapazität (Reihenfolge wie in §7.6.4: Follow-up → Bulk → Push).
4. **J6-Slices:** **WP-J6-01** ff. wenn fachlich Go (Portal E2E zuerst).
5. **Infrastruktur:** **WP-T1**, **WP-CF1** bei Schema- bzw. Hosting-Entscheid.
6. **Laufend:** **Teil C** (Betrieb, I2, Doku).

---

## Teil B – Arbeitspakete (Feinschnitt)

### B.0 Neu dokumentiert, noch nicht umgesetzt

| ID | Thema | Status | Abhängigkeit / Hinweis |
|----|--------|--------|-------------------------|
| **WP-MANG-00** | **Klärung Migration / Prozess:** Stammdaten-Mängel → **eine** Quelle Protokoll; Neumandanten/Test vs. produktiv mit Export vor UI-Entfernung; Schema Phase 1/2 | ⚠️ | **§11.17** Zeile **5b** (fachlich beschlossen); **technische** Abschaltung UI / Spalten-Drop = Rollout-Tickets |
| **WP-MANG-01** | **Aggregation:** offene Protokoll-Mängel pro `object_id` aus maßgeblichem Completion-Stand (letzter **erledigter** Prüfungsauftrag + Regeln §11.17#4); Performance/Cache | ✅ | `protocolOpenMangels.ts`, `fetchProtocolOpenMangelsForListCounters`; optional Performance bei sehr großen Mandanten |
| **WP-MANG-02** | **UI Tür/Tor:** Sektion „Offene Mängel“ (ein Liste, Labels Tür/Feststell); ausblenden wenn 0; Inhalt §11.17#5; **Entwurf laufender Auftrag** §11.17#4 | ✅ | **`ObjectFormModal`** (rose maßgeblich + sky Entwurf), `fetchProtocolOpenMangelsDraftForObject`; Protokoll-Mängel-Fotos bewusst nur online |
| **WP-MANG-03** | **Kundenliste:** Badge Anzahl nur wenn &gt; 0; ohne Tür öffnen sichtbar | ✅ | **`Kunden.tsx`** Kunde + Tür-Zeilen; rose Badge |
| **WP-MANG-04** | **Offline:** Zähler/Sektion aus gleichen Cache-Quellen wie Objektliste; Konsistenz mit `dataService` | ✅ | **`order_completions`** minimal im `localStorage` + Pull/Merge; Fotos Protokoll-Mängel weiter online |
| **WP-MANG-05** | **Edge cases:** Bypass-Abschluss (`wartung_checkliste_abschluss_bypass`), mehrere Türen, fehlende Completions – fachlich festnageln + Tests | ✅ | **`buildAuthoritativeChecklistSnapshotsByObjectId`**, Vitest `protocolOpenMangels.test.ts` |
| **WP-NET-01** | **Zustand „degraded“:** zentraler Kontext/Hook; Eintritt bei Request-Fehlern (**§11.18#1 B**); Austritt bei Erfolg (**#2 A**) | ✅ | **Store + Supabase-`fetch`-Wrap + Banner** (`shared/mandantDegradedStore.ts`, `MandantDegradedBanner`); Admin/LP ohne Tracking; React-Context optional |
| **WP-NET-02** | **Optional Ping:** Einstellung default aus; Endpoint/Intervall festlegen; **§11.18** offene Punkte | ✅ | **`shared/mandantReachabilityPing.ts`**, **Einstellungen** (Diagnose), **`MandantPingScheduler`** in **Layout**; kein LP-Host |
| **WP-NET-03** | **Lesen:** kurzer Timeout → Cache (**§11.18#3**); nur Mandanten-Pfad | ✅ | **3 s** Abort im Mandanten-`fetch`; weiteres Cache-Fallback in `dataService` bei Bedarf |
| **WP-NET-04** | **Schreiben:** Retries → Outbox (**§11.18#4, #7**); Supabase-Pfade | ✅ | **4 Versuche / 500 ms** Tabellen-Schreiben; Outbox weiter App-Logik |
| **WP-NET-05** | **Banner** (**§11.18#5**); Trennung Lizenz vs. Mandant (**#6**) | ✅ | **`MandantDegradedBanner`**, **`LicensePortalStaleBanner`**, `licensePortalStale`; UX-Feinschliff optional |
| **WP-NET-10** | **Realtime:** zählt mit für Mandanten-Degraded, entprellt (**§11.18#10**) | ✅ | `shared/mandantRealtimeDegraded.ts`; an **orders** / **profiles** / **component_settings** Realtime |
| **WP-PORTAL-01** | **Einstellungen:** globale Schalter Sichtbarkeit Phasen / Termin im Portal (**§11.19**) | ✅ | **`monteur_report_settings`**, **`Einstellungen.tsx`**, `dataService`; optional Lizenz-Gating |
| **WP-PORTAL-02** | **Zeitleiste** im Portal (angelegt → in Bearbeitung → abgeschlossen); **keine Mängel** vor `erledigt` | ✅ | RPC **`get_portal_order_timeline`**, **`portal/Berichte.tsx`**, `portalOrderTimeline.ts`; RLS/RF5 bei Bedarf nachziehen |
| **WP-PORTAL-03** | **Platzierung UI** (Banner + Detail Berichte, **§11.19** Entscheid **C**) | ✅ | **`portal/Layout.tsx`**, `buildOrderActivityBannerFingerprint`, Berichte „Ihre Aufträge“ |
| **WP-ORD-01** | **Regel max. 1** Auftrag `offen`/`in_bearbeitung` **pro object_id**; Bereinigung Alt-Daten | ⚠️ | **Kern ✅:** Trigger + App (`supabase-complete.sql`, `dataService`); **offen:** Mandanten mit historischen Alt-Duplikaten **manuell** bereinigen |
| **WP-ORD-02** | **Auftrag anlegen:** bestehende Hinweise erweitern; Dialog „bestehenden öffnen“ vs. harte Sperre (fein nach Produkt) | ✅ | **AuftragAnlegen.tsx**, QR-Flow über `createOrder`/`updateOrder`; optional weiterer Dialog nach Produkt |
| **WP-REL-00** | **Lizenzportal-SQL + LP-UI:** Releases/Entwürfe, Kanäle `main`/`portal`/`arbeitszeit-portal`, Incoming- vs Update-Freigabe, Mandanten-Gruppen | ✅ | **`supabase-license-portal.sql`** §7, **`admin`** `/app-releases`, **`MandantForm`**; Rollout SQL auf LP-DB |
| **WP-REL-01** | **Lizenz-API:** ausliefern „aktive Release“, „Incoming“, `release_type`, Modul-Tags, gestaffeltes Go-Live pro Mandant | ✅ | **`supabase-license-portal/supabase/functions/license`** (`mandantenReleases`, Kanal per Host); `admin/netlify/functions/license.ts` nur Referenz |
| **WP-REL-02** | **Haupt-App (+ ggf. Portale):** Version-Check, Incoming-Banner, Update-Prompt angebunden an API (**§11.20**) | ✅ | **Info**/`appVersions`, **Incoming-Banner**, **`MandantenReleaseHardReloadGate`** bei `active.forceHardReload` (Haupt-App: PWA-Bridge + `PwaUpdatePrompt`; Portale: `location.reload`); Incoming-Hinweis bei `forceHardReload` in Pilot-Liste |
| **WP-REL-03** | **Ausbau:** strukturierte Notes pro Modul oder CI-Tag-Vorschläge (**§11.20** Tabelle Ausbau) | 🔲 | optional |
| **WP-REL-04** | **Rollback / Update-Signal:** Mandanten-API liefert Zuweisungs-Zeitstempel, CCV-Bump für alle Lizenzen des Mandanten nach Zuweisung/Rollback, sanfter Reload-Banner in Apps | ✅ | **`license.ts`** `releaseAssignmentUpdatedAt`; **`bumpClientConfigVersionsForTenantLicenses`**; **`MandantenReleaseRolloutRefreshBanner`**; `min_version` bewusst nicht (Semver-Risiko) |

### B.1 Track J7 (bestehende Roadmap, zerlegt)

| ID | Thema | Vico.md | Status |
|----|--------|---------|--------|
| **WP-J7-01** | Mängel-Follow-up (Prozess + UI/Daten) | §7.4 #9 | 🔲; mit **§11.17** abstimmen |
| **WP-J7-02** | Bulk-Operationen (Umfang mit Auftraggeber) | §7.4 #14 | 🔲 |
| **WP-J7-03** | Portal Push-Benachrichtigungen | §7.4 #15 | 🔲 |
| **WP-J7-04** | iCal / Kalender-Sync | §7.4 #10 | 🔲 später (§7.6.4) |

### B.2 Track J6 – Umbau Wartung (scheibchenweise)

| ID | Thema | Status | Hinweis |
|----|--------|--------|---------|
| **WP-J6-01** | **Berichte → Kundenportal** End-to-End (PDF, Metadaten, RLS, UX nach Abschluss) | 🔲 | **§7.2** explizit offen |
| **WP-J6-02** | Freigabe-Workflow (Monteursbericht → freigegeben) | 🔲 | Produkt festlegen |
| **WP-J6-03** | Wartungsprotokoll DIN/ASR (Tiefgang) | 🔲 | nach J6-Basis |
| **WP-J6-04** | Salvage **P7** restlicher Offline-Ausbau (Completions/Feststell online-pflichtig bewusst) | 🔲 | §7.5 Tabelle P7 |
| **WP-J6-05** | Salvage **P8** / Backlog-Punkte einzeln | 🔲 | mit Branch-Doku abgleichen |

**Hinweis „P0“:** In Tabellen ist **P0** oft **Portal E2E**, nicht technische Phase P0 Prüfprotokoll – **§7.5**.

### B.3 Track T1 – Datenbank

| ID | Thema | Aufwand | Referenz |
|----|--------|---------|----------|
| **WP-T1** | Supabase CLI-Migrations, Baseline, Deltas; LP eigenes `supabase/` | 0,5–2 T | `docs/sql/Supabase-Migrations-Strategie.md`, **§9.19** |

### B.4 Track CF1 – Hosting

| ID | Thema | Status | Referenz |
|----|--------|--------|----------|
| **WP-CF1** | Netlify → Cloudflare Pages (4 Apps), Build/Env, SPA-Fallback | 🔲 Planung ✅ | `docs/Cloudflare-Umzug-Roadmap.md` |
| **WP-CF1b** | Lizenz-API über Supabase Edge (wie konzipiert) | 🔲 | **§5**, **§9** |

---

## Teil C – Laufend / Betrieb / Hardware / Phase 6

Aus **§7.2.1** und **Roadmap Phase 6** – kein klassisches „Release“, aber **abhaken vor Produktiv**:

| Paket | Inhalt (kurz) |
|--------|----------------|
| **C-J1** | Cron `send-maintenance-reminder-digest`, Secrets `RESEND_*`, `APP_URL`, optional `MAINTENANCE_DIGEST_CRON_SECRET` |
| **C-J1-D** | DSGVO: Einwilligung Einstellungen, Texte |
| **C-I2** | Bluetooth/Capacitor-Druck: Pairing/MAC (v. a. Bixolon) |
| **C-L4** | Logo max. Kante 2048 px – Doku = Code |
| **C-P6** | GPS-Debug, Standort-Checkliste AZK, A4-QR-Batch Feinschliff (**§7.6.5** `qr_batch_a4`) |

---

## Teil D – Backlog & Doku (mittelfristig)

| # / Thema | Priorität | Hinweis |
|-----------|-----------|---------|
| **#8** Wartungs-Checkliste pro Objekttyp | Mittel | Eigenes Paket |
| Wartungsstatistik Charts | optional | J2 MVP ✅ |
| SevDesk/API | optional | J3 MVP ✅ |
| **D-PDF** | gering | `Vico.md` §4 Tabellen ↔ `supabase-complete.sql`; §1 Hosting-Zeile CF vs. Netlify; §7.6.3 `cf:apply-env` erwähnen |

---

## Teil E – GitHub / Issues

Vorlagen: **`docs/GitHub-Roadmap-7.2.md`**, **`scripts/gh-roadmap-issues.sh`** (nach `gh auth login`).  
Neue Tickets für die Serien **WP-MANG-…** und **WP-NET-…** bei Bedarf mit Verweis auf **§11.17 / §11.18** und diese Datei anlegen.

---

## Änderungshistorie (Kurz)

- **2026-04:** Neuaufbau in **Arbeitspaketen**; Aufnahme **§11.17**–**§11.20**; **WP-REL-…**; Verweis **§7.2.2** in `Vico.md`. **WP-PORTAL-01–03** und **WP-MANG-00** an **§11.17** / **§11.19** + Ist-Code angeglichen. **WP-PORTAL-03:** Banner-Dismiss mit Timeline-Fingerprint.
- **2026-04-04:** Status **✅** für **WP-MANG-01–05**, **WP-NET-01–05**, **WP-NET-10**, **WP-PORTAL-01–03**, **WP-ORD-02** (Kern im Repo); Klarstellung „was wirklich noch offen ist“ (REL, J6, J7, T1, CF1, Teil C/D, MANG-00, ORD-01 Altbestand).
- **2026-04-30:** `Vico.md` ergänzt: **§3** *Altbericht-Import* (inkl. Raster-Feinschliff Apr. 2026), Lizenzportal-Bullet **Mandant bearbeiten – Bereichsnavigation**; **§7.3** Archiv-Einträge **ALT-RASTER**, **LP-MAND-NAV**; **§11.27** mit Erledigt-/Teilweise-Tabelle; **§7.2.2** Kurzverweis. Keine neuen **WP-IDs** (Feinschliff außerhalb Roadmap-Paketliste).
- **2026-03:** Vorversion: monolithischer Überblick ohne WP-IDs.
