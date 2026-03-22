# Roadmap – Vorschlag zur Abarbeitungsreihenfolge

**Stand:** März 2026  
**Grundlage:** `docs/Noch-zu-erledigen.md`, `Vico.md` §7, getroffene Entscheidungen (Roadmap J, Urlaub/VJ, Updates).

Ziel dieser Reihenfolge: **wenig Blockaden**, zuerst **Betrieb & Klarheit**, dann **schneller Nutzen** in der Haupt-App, danach **größere Blöcke** (Urlaub, Wartung MVP), zuletzt **Hosting/Performance** und **optionale** Themen.

---

## Phase 0 – Fundament ✅ (März 2026 abgeschlossen)

| # | Thema | Ergebnis |
|---|--------|----------|
| 0.1 | **Anleitung App-Updates** | ✅ `docs/Anleitung-App-Updates-fuer-Betrieb.md` |
| 0.2 | **Grenzüberschreitungen verifizieren** | ✅ Checkliste `docs/Verifikation-Grenzueberschreitungen-Checkliste.md` (Live-Abhaken vor Ort) |
| 0.3 | **Build/TS** | ✅ Lint, Tests, Build Haupt-App + portal + admin + arbeitszeit-portal lokal geprüft |

**Nächster Schritt:** **Phase 1 (J1–J4)** MVP im Kern erledigt; **Phase 3 (Urlaub)** MVP umgesetzt. **Weiter:** **J7** (Mängel-Follow-up → Bulk → Portal-Push) **oder** optionale Nachzieher (J1 E-Mail, J4-B, SevDesk, J2-Charts).

---

## Phase 1 – Schnelle Gewinne Haupt-App (Roadmap J, klein bis mittel) ✅ Kern erledigt (März 2026)

| # | Thema | Status | Realisiert / offen |
|---|--------|--------|-------------------|
| 1.1 | **J4 – Zuletzt bearbeitet** | ✅ **MVP** | `Startseite.tsx`, `fetchRecentEditsForDashboard`, Widget + **Layout-Sync** `profiles.dashboard_layout` (`useDashboardLayout`). |
| 1.1b | J4 **B** Favoriten / „nur meine“ | ⏳ **bewusst später** | Laut `Noch-zu-erledigen.md` nicht in MVP. |
| 1.2 | **J1 – Wartungserinnerungen** (In-App) | ✅ **MVP** | Dashboard: Filter **Alle / Überfällig / ≤7 / ≤30**, Karten mit Status-Badge; **Nav-Badge** Dashboard: rot bei Überfällig, sonst Bernstein, Zähler ≤7 inkl. Überfällig (`Layout.tsx`, `maintenanceReminderUtils.ts`, `Startseite.tsx`). |
| 1.2b | J1 **E-Mail**-Versand | ⏳ **offen** | Bewusst zweiter Schritt (Provider/DSGVO). |
| 1.3 | **J2 – Wartungsstatistik** | ✅ **MVP** | `/wartungsstatistik`, KPIs, Tabellen, CSV – siehe `Noch-zu-erledigen.md`. Optional später: Charts-Lib, Auslastung aus Reports. |
| 1.4 | **J3 – Export Buchhaltung** | ✅ **MVP** | `/buchhaltung-export`, CSV Semikolon; `accountingExportService.ts`. **SevDesk/API** ⏳ später. |

**Parallel – Bug-Erfassungsmodul** (`Vico.md` §11.3): ✅ **MVP vorhanden** – `shared/errorReportService`, `reportError` in `main.tsx` / `ErrorBoundary` / u. a. `Arbeitszeit.tsx`, Admin-Übersicht **`Fehlerberichte`** (`app_errors`). Feinschliff (Filter, Workflow, weitere Quellen) optional.

**Fazit Phase 1:** Alle vier Hauptpunkte **in der geplanten MVP-Form umgesetzt**; offen sind nur **bewusst zurückgestellte** Themen (J4-B, J1-E-Mail, J3-Schnittstellen) und **optionale** Ausbauten (J2-Charts, Bug-Modul).

---

## Phase 2 – Einheitliche PDFs / Briefbogen (querschnittlich) ✅

| # | Thema | Warum hier |
|---|--------|------------|
| 2.1 | **J10 – PDF mit Mandanten-Briefbogen** (Wartungsprotokolle, Zoll-Export o. Ä.) | ✅ **Umgesetzt:** `shared/pdfLetterhead.ts`, `shared/briefbogenClient.ts`; Haupt-App Wartungsprotokoll; Arbeitszeit-Portal **Zoll-PDF** + **Urlaubsbescheinigung** mit gleichem Briefbogen; Upload weiter in **Einstellungen** (Haupt-App). |
| 2.2 | **PDF-Briefbogen** Portal / Arbeitszeit-Portal | ✅ Arbeitszeit-Portal nutzt dieselbe Briefbogen-Logik. **Kundenportal:** lädt nur gespeicherte PDFs (Briefbogen bereits in der Datei aus der Haupt-App). |

**Technische Referenz:** Bucket `briefbogen`, `admin_config.briefbogen_storage_path`, Signed URLs für Bild + PDF-Hintergrund.

---

## Phase 3 – Arbeitszeit: Urlaub VJ, Zusatzurlaub, Pending (großer Block) ✅ MVP (März 2026)

| # | Thema | Hinweis |
|---|--------|---------|
| 3.1 | **Schema & Migrationen:** Mandantenfrist VJ, optional Profil-Override, Zusatzurlaubs-Posten, Acknowledgement | ✅ `supabase-complete.sql`: `leave_extra_entitlements`, `leave_vj_acknowledgments`, `approve_leave_request(…, date, date)`, Balance-RPC u. a. |
| 3.2 | **Logik:** Pending in Saldo, Teilgenehmigung, Snapshot inkl. VJ/Zusatz | ✅ `get_leave_balance_snapshot`; **kein** automatisches FIFO-Verbrauchen der Zusatzposten in der DB (Anzeige + Admin-Pflege; Hinweistext Verbrauchsreihenfolge). |
| 3.3 | **UI Arbeitszeit-Portal** | ✅ `Urlaub.tsx` (Saldo, VJ-Hinweis + Bestätigen, Teilgenehmigung, Zusatz-Admin); `Stammdaten.tsx` (Mandanten-Frist, Profil-Override Admin). **Haupt-App:** `leaveService` mit `approved_*`-Feldern. Texte extern rechtlich prüfen. |

**Begründung Reihenfolge:** Nach Phase 1–2 ist der **Kern-Wartungs-Alltag** verbessert; Urlaub ist **fachlich dicht** und lohnt sich als **fokussierter** Block ohne gleichzeitig J6.

---

## Phase 4 – J7-Sammelpaket (ohne iCal)

Reihenfolge laut Entscheidung: **(1) Mängel-Follow-up → (2) Bulk-Operationen → (3) Portal-Push.**

| # | Thema |
|---|--------|
| 4.1 | Mängel-Follow-up |
| 4.2 | Bulk-Operationen |
| 4.3 | Push-Benachrichtigungen Kundenportal |

---

## Phase 5 – Wartung MVP (J6) – bewusst groß

| # | Thema | Hinweis |
|---|--------|---------|
| 5.1 | **J6 – Umbau Wartung** (Freigabe → Portal, Rest des Konzepts) | 15–20 T; erst angehen, wenn J1–J4 und eure operativen Prioritälen klar sind (`Noch-zu-erledigen.md`: „nach Rest der Roadmap“). |

---

## Phase 6 – Ortung, Standort, Etikett, Mobile-Druck

| # | Thema | Hinweis |
|---|--------|---------|
| 6.1 | **GPS Stempel-Ortung** (§3): Debug **nach Live** / reproduzierbarer Testplan | Bereits als Beta gekennzeichnet. |
| 6.2 | **Standortabfrage** (§3a): interne Checkliste; produktiv nur mit Lizenz-Flag + rechtlicher Freigabe | Kein Hintergrund-Tracking auf Web ohne Konzept. |
| 6.3 | **I2 – Etikettendrucker** Abstraktion (ohne fertige Hardware zuerst) | Entscheidung Bixolon-Preset-Pfad. |
| 6.4 | **A4-QR-Batch / Etikettendesign** | Nach Thermo-Basis; Lizenz-Feature + Rollen. |

---

## Phase 7 – Hosting, Performance, Aufräumen

| # | Thema |
|---|--------|
| 7.1 | **IONOS / Deploy** (§7) – wenn strategisch fällig |
| 7.2 | **Projektüberarbeitung / Optimierungsplan** (`docs/Optimierungsplan.md`) |
| 7.3 | **Zeiterfassung optional** (§2): Teamleiter, Soll Woche/Tag, Freie-Tage-Ereignisse – nach Bedarf |

---

## Was ich bewusst nach hinten stellen würde

- **iCal / Kalender-Sync** – laut Entscheidung aktuell **nicht** in J7-Runde.
- **J6** vor stabilisiertem J1–J4 – zu viel Parallelität und Kontextwechsel.
- **Externe Buchhaltungs-API (SevDesk)** – eigener Schritt nach J3-Basisexport.

---

## Kurz: eine mögliche „Sprint-Reihenfolge“ in einem Satz

**0 → J4 → J1 → J2 → J3 → (Bug-Modul parallel) → J10/Briefbogen → Urlaub VJ+Zusatz (Block) → J7 (1–2–3) → J6 → Ortung/Standort/I2 → IONOS/Performance.**

---

**Pflege:** Bei größeren Entscheidungen (z. B. Go-Live-Datum, neuer Kundenwunsch) diese Datei und **`docs/Noch-zu-erledigen.md`** gemeinsam anpassen.
