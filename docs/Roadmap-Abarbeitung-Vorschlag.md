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

**Nächster Schritt:** Phase 1 (z. B. J4 Zuletzt bearbeitet).

---

## Phase 1 – Schnelle Gewinne Haupt-App (Roadmap J, klein bis mittel)

| # | Thema | Aufwand (ca.) | Hinweis |
|---|--------|---------------|---------|
| 1.1 | **J4 – Zuletzt bearbeitet** auf der Startseite | 1–2 T | Hoher UX-Nutzen, wenig Abhängigkeiten. |
| 1.2 | **J1 – Wartungserinnerungen** ausbauen (In-App zuerst; **E-Mail** bewusst als zweiter Schritt laut Entscheidung) | 3–5 T (+ E-Mail später) | Schließt an bestehende Erinnerungslogik an. |
| 1.3 | **J2 – Wartungsstatistik / Auswertung** | 3–4 T | Nutzt vorhandene Wartungsdaten. |
| 1.4 | **J3 – Export Buchhaltung** | 2–3 T | Entscheidung „SevDesk später“ beachten: erst einfachen CSV/Excel-Export, Schnittstellen später. |

**Parallel möglich:** **Bug-Erfassungsmodul** (`Vico.md` §11.3, ~1–2 T) – verbessert Stabilität während J1–J3.

---

## Phase 2 – Einheitliche PDFs / Briefbogen (querschnittlich)

| # | Thema | Warum hier |
|---|--------|------------|
| 2.1 | **J10 – PDF mit Mandanten-Briefbogen** (Wartungsprotokolle, Zoll-Export o. Ä.) | 1–2 T geschätzt; baut auf §11.2 / Entscheidung „einheitliche Briefbogen-Logik“ auf. |
| 2.2 | **PDF-Briefbogen** schrittweise auf Portal / Arbeitszeit-Portal angleichen (laut Entscheidungstabelle) | Nach J10 oder in kleinen Inkrementen, damit nicht drei getrennte PDF-Stile wachsen. |

---

## Phase 3 – Arbeitszeit: Urlaub VJ, Zusatzurlaub, Pending (großer Block)

| # | Thema | Hinweis |
|---|--------|---------|
| 3.1 | **Schema & Migrationen:** Mandantenfrist VJ, optional Profil-Override, Zusatzurlaubs-Posten, ggf. Acknowledgement-Tabelle | Expand-only bevorzugen (`App-Updates-und-Versionierung.md`). |
| 3.2 | **Logik:** Automatik 01.01. `days_carried_over`, Pending zieht Tage, Ablehnung/Teilablehnung, Verbrauchsreihenfolge | Entscheidungen in `Noch-zu-erledigen.md` (Urlaub). |
| 3.3 | **UI Arbeitszeit-Portal** (`Urlaub.tsx` u. a.): getrennte Anzeige VJ / Jahr / Zusatz, Hinweis „verstanden“ | Texte extern rechtlich prüfen. |

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
