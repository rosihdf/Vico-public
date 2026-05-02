# Mandanten-DB-Rollout – Test-Checkliste (Lizenzportal Phase 3)

Kurze Anleitung für **Administratoren** nach dem technischen Setup (SQL, Edge-Functions, GitHub-Secrets).  
Technische Details: [`docs/sql/Mandanten-DB-Workflow.md`](./sql/Mandanten-DB-Workflow.md).

**Wichtig:** Tests nur in **Staging** ausführen. Keine riskanten oder nicht-idempotenten SQL-Pakete zu Testzwecken.

---

## Voraussetzungen (einmalig prüfen)

| Was | Wo |
|-----|-----|
| Tabellen Runs/Targets | SQL `docs/sql/LP-mandanten-db-rollout-v3.sql` im **Lizenzportal** ausgeführt |
| Functions deployt | `trigger-mandanten-db-rollout`, `update-mandanten-db-rollout-status` |
| Secret (Portal) | `MANDANTEN_DB_ROLLOUT_CALLBACK_SECRET` |
| Secrets (GitHub-Repo) | `LP_ROLLOUT_CALLBACK_URL` (volle URL der Callback-Function), `LP_ROLLOUT_CALLBACK_SECRET` **identisch** zum Portal-Secret oben |
| DB-Listen | `MANDANTEN_DB_URLS_STAGING` (eine Postgres-URI pro Zeile) |

**Typischer Fehler:** Callback-Secret auf GitHub und im Portal **nicht gleich** → Historie bleibt bei „läuft“, keine Target-Zeilen, oder Workflow bricht bei der Secret-Prüfung ab.

---

## Checkliste A – Trockenlauf (Dry-Run)

Pfad im Admin: **Mandanten aktualisieren → Datenbank**, Ziel **Staging**, Modus **Trockenlauf**.

1. Paket auswählen → **Rollout starten** (oder gleichwertige Aktion).
2. **Historie**-Tab öffnen und Liste **aktualisieren**.
3. **Prüfen:** neuer Eintrag erscheint.
4. **Prüfen:** Gesamtstatus wird **Erfolg** (Rollout ohne SQL-Ausführung gegen Mandanten ist beabsichtigt „grün“).
5. Zeile öffnen (**Details**): **Targets** je URL-Zeile, Status **Übersprungen (Dry-Run)**; Hinweistext ohne echte Passwörter.
6. **Prüfen:** Link **GitHub öffnen** führt zur passenden Workflow-Übersicht/Run (wenn gesetzt).

**Was Sie nicht erwarten sollten:** Klartext-Passwörter oder vollständige Verbindungs-URIs mit Passwort — nur **maskierte** Hosts.

---

## Checkliste B – Echtlauf mit Erfolg (nur sichere Staging-DB)

Nur wenn Staging-Verbindungen stabil sind und ein **bewusst kleines/idempotentes** Paket gewählt wurde.

1. Ziel **Staging**, Modus **Echtlauf**, gleiches oder harmlosestes Paket.
2. Nach Abschluss: **Historie** → letzter Run **Erfolg**.
3. **Details:** alle Targets **Erfolg** (sofern alle Mandanten erreichbar).
4. GitHub-Link wie bei A prüfen.

---

## Checkliste C – Teilerfolg / ein Mandant fehlgeschlagen (Staging)

Zum Vertrauen in die **Partial**-Logik (optional, nur mit Abstimmung mit Technik).

1. In der **Staging**-URL-Liste bewusst eine **ungültige** oder nicht erreichbare Zeile einfügen (nur in Staging-Secret).
2. Echtlauf starten.
3. **Erwartung:** mindestens ein Target **Fehler**, andere **Erfolg** → Gesamtstatus **Teilerfolg**.
4. **Details:** Fehlerauszug lesbar; **keine** vollständige URL mit Passwort.

Anschließend Secret wieder bereinigen.

---

## Checkliste D – Ampel (Übersicht)

Auf **Mandanten aktualisieren → Übersicht** die Statuszeilen prüfen (vereinfacht):

| Letzter Rollout (Historie) | Ampel „Letzter Rollout“ |
|----------------------------|-------------------------|
| Erfolg | grün |
| Teilerfolg oder noch wartend/laufend | gelb |
| Fehler | rot |
| Noch kein Eintrag | grau / neutral |

---

## Typische Fehlerbilder (ohne Panik)

| Symptom | Häufige Ursache |
|---------|-----------------|
| Workflow startet nicht | GitHub-Token `GITHUB_DISPATCH_TOKEN` im Portal; Repo-Name/Branch |
| Job bricht sofort ab | `run_id` gesetzt, aber `LP_ROLLOUT_CALLBACK_URL` oder Secret fehlt/falsch |
| Historie bleibt „Läuft“ | Callback erreicht Portal nicht (URL, Netzwerk); oder Run in GitHub fehlgeschlagen vor Script-Ende |
| Alle Targets Fehler | IPv6/DNS auf GitHub-Runner; falsche Pooler-URL; Secret-Datei leer |
| Keine Targets in Details | Alter Lauf ohne Phase 3; oder Callback nie `targets_replace` |

**Logs:** GitHub → **Actions** → betroffener Run (Schritte und `apply-mandanten-sql` Ausgabe). Im Portal: Supabase **Edge Functions** → Logs (keine Secrets in Support-Tickets kopieren).

---

## Verwandte Dateien

- Rollout-Ablauf: [`docs/sql/Mandanten-DB-Workflow.md`](./sql/Mandanten-DB-Workflow.md)
- Lizenzportal README (Deploy): `supabase-license-portal/README.md`
