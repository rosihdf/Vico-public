# Beta-Feedback – Smoke-Test & Feld-Mapping

Kurzreferenz zur Umsetzung; fachlicher Überblick in **Vico.md** (Abschnitt Lizenzportal, Beta-Feedback).

---

## 1. Smoke-Test-Checkliste

### Voraussetzungen

- [ ] **SQL:** Tabelle `beta_feedback` + RLS auf Lizenzportal-DB (s. `supabase-license-portal.sql` oder `docs/sql/license-portal-beta-feedback.sql`).
- [ ] **Edge Function** `submit-beta-feedback` deployed, in `config.toml` `verify_jwt = false`.
- [ ] **Mandant:** `tenants.supabase_url` gesetzt (für JWKS-Prüfung des Mandanten-JWT).
- [ ] **Domains:** `allowed_domains` (o. ä.) enthält die **öffentlichen Hosts** der drei Apps (ohne `https://`), analog Lizenz-API.
- [ ] **Lizenz / Lizenzmodell:** Feature **`beta_feedback`** = an für den Testmandanten.

### Haupt-App

- [ ] Eingeloggt, Lizenz-API konfiguriert (`VITE_LICENSE_API_URL`), Feature aktiv → **β-Button** sichtbar (unten rechts).
- [ ] Ohne Login / auf Login-Seite → **kein** Button.
- [ ] Feature aus → **kein** Button.
- [ ] Dialog öffnen, Pfad/Query stimmen mit aktueller URL überein.
- [ ] Absenden → **200**, Eintrag in LP unter **`/beta-feedback`**, Mandant gefiltert korrekt.
- [ ] **11.** Absenden am selben Tag → bis Limit **10** ok, danach **429** mit verständlicher Meldung.

### Kundenportal & Arbeitszeit-Portal

- [ ] `VITE_LICENSE_API_URL` im Build gesetzt, Feature aktiv → Button sichtbar (eingeloggt).
- [ ] Submit ok, in der Liste **Quelle** = Kundenportal bzw. Arbeitszeit.
- [ ] Ohne `VITE_LICENSE_API_URL` → kein Widget (erwartetes Verhalten).

### Lizenzportal-Admin

- [ ] **`/beta-feedback`**: Liste lädt, Filter **Alle Mandanten** / **ein Mandant** sinnvoll.
- [ ] **Status** und **Priorität** ändern → speichert ohne Fehler (RLS nur Admin).
- [ ] **Interne Notiz** nach Blur gespeichert.

### Negativfälle (stichprobenartig)

- [ ] Falsche/fehlende Origin bei strikten `allowed_domains` → **403** am Edge.
- [ ] Abgelaufenes Mandanten-JWT → **401**.
- [ ] Feature `beta_feedback` aus → **403** mit Hinweis „nicht aktiv“.

---

## 2. Feld-Mapping (Auswertung / Umsetzung)

### `source_app`

| Wert                 | Bedeutung           | Hinweis für Tickets                          |
|----------------------|---------------------|-----------------------------------------------|
| `main`               | Haupt-App           | Monteurs-/Büro-Workflows, Navigation mobil   |
| `kundenportal`       | Kundenportal        | Endkunden, Lesemodus, Berichte               |
| `arbeitszeit_portal` | Arbeitszeit-Portal  | Zeiterfassung, AZ-spezifische Screens        |

### `category` (technischer Key → inhaltlich)

| Key               | Anzeige (Widget)                    | Typische Umsetzung                          |
|-------------------|-------------------------------------|---------------------------------------------|
| `ui_layout`       | Darstellung / Layout                | UI/CSS, Komponenten, responsive Breakpoints |
| `flow_logic`      | Ablauf / Logik                      | Schritte, Validierung, Reihenfolge          |
| `missing_feature` | Funktion fehlt                      | Backlog-Feature, ggf. Spezifikation nachtragen |
| `remove_feature`  | Funktion überflüssig / kann weg     | Vereinfachen, Flag/Modul, Roadmap „entfernen“ |
| `bug`             | Fehler / Bug                        | Defect, Repro mit Route + ggf. Build-Version |
| `other`           | Sonstiges                           | manuell klassifizieren                      |

### `severity`

| Key        | Anzeige                          | Priorisierung (Vorschlag)      |
|------------|----------------------------------|--------------------------------|
| `blocker`  | Kann nicht sinnvoll arbeiten     | eher **P0/P1**                 |
| `annoyance`| Stört / erschwert die Arbeit     | eher **P1/P2**                 |
| `wish`     | Verbesserungswunsch              | eher **P2/P3**                 |
| *(leer)*   | Keine Angabe                     | nach Text/Kategorie einordnen  |

### Admin-Felder (LP)

| Feld            | Nutzen                                      |
|-----------------|---------------------------------------------|
| `status`        | Workflow: neu → Prüfung → geplant → erledigt / abgelehnt / Duplikat |
| `priority`      | P0–P3 für Sprint/Release-Planung            |
| `internal_note` | Abstimmung, Duplikat-Referenz, Kundenkontext |

### Automatisch mitgeliefert

| Feld            | Nutzen                                        |
|-----------------|-----------------------------------------------|
| `route_path` + `route_query` | Repro: exakte Ansicht                    |
| `app_version`   | Build-Zuordnung bei Beta-Rollouts             |
| `release_label` | Release-/Kanal-Kontext aus Lizenz-API         |
| `mandant_user_id` | Nachfragen über Mandanten-Profil (kein PII in Tabelle) |

---

## 3. Verweis

- Schema & Edge: Repo-Root **`supabase-license-portal.sql`**, Function **`submit-beta-feedback`**.
- UI-Widget: **`shared/BetaFeedbackWidget.tsx`**.
