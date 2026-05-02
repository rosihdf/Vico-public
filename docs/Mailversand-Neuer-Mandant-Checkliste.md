# Mail-System – Setup für einen neuen Mandanten

Ziel: Ein Administrator ohne Codekenntnisse kann prüfen und abhaken, was für **sicheren, zentralen Mailversand** (Lizenzportal) und optionale Features (Digest, Legacy, Portal-Mail) nötig ist.

**Verwandte Dokumente**

- Rollout technisch: [`Mailversand-Deployment-Checkliste.md`](./Mailversand-Deployment-Checkliste.md)
- Kurztests: [`Mailversand-Quickcheck.md`](./Mailversand-Quickcheck.md)
- Legacy/Fallback: [`Mailversand-Legacy.md`](./Mailversand-Legacy.md)
- Host-Freigaben (`allowed_domains`): [`Mandanten-Hostlookup-CF-Pages.md`](./Mandanten-Hostlookup-CF-Pages.md)

---

## Schritt-für-Schritt Anleitung

### Phase A – Lizenzportal (einmalig oder bei neuem LP-Projekt)

1. **Datenbank:** LP-SQL ausrollen (mind. Tabellen `tenants`, `licenses`, `tenant_mail_secrets`, `tenant_mail_templates`, Funktionen für Mail-Logging). Globale Vorlagen werden per Seed angelegt, soweit noch keine Zeilen existieren ([`Mailversand-Deployment-Checkliste.md`](./Mailversand-Deployment-Checkliste.md) Abschnitt Template-UPDATE bei Altbestand).
2. **Edge Functions deployen:** mind. `license`, `send-tenant-email`; für Admin-Tests `admin-send-test-email`, `admin-preview-mail-template`; für Wartungs-Digest zentral **`send-tenant-email-server`**. Befehle: `npm run lp:deploy:mail-stack`, `npm run lp:deploy:mandanten-update` (Repo-Root, nach `supabase link` unter `supabase-license-portal/`).
3. **LP Secret für Digest-Serverweg:** `TENANT_SERVER_MAIL_SECRET` setzen (mind. 24 Zeichen), danach **`send-tenant-email-server`** neu deployen.
4. **Lizenzadmin:** Mandanten-Stammdatensatz anlegen oder bearbeiten (Phase B).

### Phase B – Mandant im Lizenzadmin (Pflicht für Mail über LP)

1. **Mandant speichern** mit Name und allen für die App relevanten Domains (siehe „Pflicht vs Optional“).
2. **Technische Verbindung:** **`Supabase-URL des Mandantenprojekts`** (`tenants.supabase_url`) eintragen – exakt die Projekt-API-URL (ohne Slash am Ende). Ohne diesen Wert lehnt **`send-tenant-email`** die sichere Anbindung ab.
3. **`allowed_domains`:** Alle produktiven Hosts der Haupt-App (und ggf. Preview-Pattern), unter denen die App die Lizenz-API und `send-tenant-email` aufruft – **ohne** `https://`, eine Zeile oder Komma getrennt ([`Mandanten-Hostlookup-CF-Pages.md`](./Mandanten-Hostlookup-CF-Pages.md)).
4. **Mail-Anbieter wählen:**
   - **Resend:** Anzeigename + Absender-E-Mail (verifizierte Domain bei Resend); im Bereich Mandanten-Geheimnisse den **Resend-API-Key** hinterlegen (nicht im Klartext im Formularfeld für das Repo gedacht – Pflege über Admin-RPC wie vorgesehen).
   - **SMTP:** Host, Port, TLS-Option, Benutzername + Passwort (Geheimnis), Absender wie oben.
5. **Monatslimit** sinnvoll setzen (Standard oft 3000 – Feintuning nach Bedarf).
6. **Lizenz anlegen/verknüpfen:** Zu diesem Mandanten gehört eine **Lizenz** mit Lizenznummer, die die Haupt-App bei Aktivierung nutzt. Die Lizenz-API liefert u. a. **`tenant_id`** – das ist **dieselbe UUID** wie der Mandant im LP und wird für `send-tenant-email` benötigt.

### Phase C – Mandanten-Supabase (je Mandanten-Projekt)

1. **Secrets setzen** (Dashboard oder CLI): siehe „Secrets Übersicht“. Minimum für zentralen PDF-/Portal-Pfad aus der App: oft nur App-/Portal-URLs; für **Digest über LP** zusätzlich `LP_*` und gemeinsames Secret.
2. **Functions deployen:** `notify-portal-on-report`, bei Bedarf `send-maintenance-reminder-digest`; Legacy optional `send-maintenance-report`. Script: `npm run mandant:deploy:mail-functions -- --project-ref <MANDANT_REF>`.
3. **`PORTAL_URL` / `APP_URL`:** Öffentliche Basis-URLs ohne trailing slash (Portal-Mail und Links im Digest).

### Phase D – Haupt-App / Portal (Build & Hosting)

1. **`VITE_LICENSE_API_URL`** = `https://<LIZENZ_REF>.supabase.co/functions/v1` (ohne Slash am Ende).
2. **`VITE_SUPABASE_URL`** und **`VITE_SUPABASE_ANON_KEY`** des **Mandanten-Supabase** (nicht LP).
3. Optional **`VITE_LICENSE_API_KEY`** nur wenn das LP so konfiguriert ist.

Nach Deploy: In der Browser-Konsole beim PDF-Versand soll `[PDF-Mail] path=license_portal` erscheinen, wenn `tenant_id` im Lizenz-Cache und API-URL gesetzt sind.

### Phase E – Vorlagen

1. Globale Standardvorlagen kommen aus der LP-Datenbank (Seed). Mandanten-Overrides nur bei Bedarf unter **Mailvorlagen** am Mandanten oder unter **Mailvorlagen global**.
2. Digest nutzt **`maintenance_reminder_digest`** – bei Altbestand ggf. SQL-UPDATE wie in der Deployment-Checkliste.

### Phase F – Tests

Siehe Abschnitt „Tests“ unten.

---

## Pflicht vs Optional

### Minimal-Setup (PDF & Portal-Mail über LP aus der App)

| Bereich | Pflicht |
|---------|---------|
| LP DB | Mandantenzeile, Lizenz mit `tenant_id`, Mail-Spalten + Geheimnisse (Resend **oder** SMTP) |
| LP Admin | `supabase_url`, sinnvolle `allowed_domains`, Absender, Provider-Konfiguration |
| LP Deploy | `license`, `send-tenant-email` |
| Mandant Deploy | `notify-portal-on-report` (Portal-Mail), sonst je nach Produktnutzung |
| Mandant Secrets | `PORTAL_URL`, `APP_URL` wo Functions Links brauchen |
| Haupt-App Env | `VITE_LICENSE_API_URL`, Mandanten-Supabase-Keys |
| LP Secret Digest | **Nein** |

Ohne `VITE_LICENSE_API_URL` oder ohne `tenant_id` in der Lizenzantwort fällt die App auf **Legacy** `send-maintenance-report` zurück (Resend direkt auf Mandanten-Supabase).

### Vollständiges Setup (inkl. Digest über LP, Admin-Vorschau, Legacy-Absicherung)

| Zusätzlich | Zweck |
|------------|--------|
| LP: `TENANT_SERVER_MAIL_SECRET` + Deploy `send-tenant-email-server` | Digest ohne User-JWT |
| Mandant: `LP_SUPABASE_URL`, `LP_TENANT_ID`, `LP_TENANT_SERVER_MAIL_SECRET` | Digest ruft LP auf |
| Mandant: `MAINTENANCE_DIGEST_CRON_SECRET` | Cron nur mit Header |
| Mandant: `RESEND_API_KEY`, `RESEND_FROM` | Fallback PDF/Digest wenn LP ausfällt oder Minimal-Legacy |
| LP Deploy | `admin-send-test-email`, `admin-preview-mail-template` |
| Optional `LP_SERVICE_ROLE_KEY` | Nutzungs-Spiegel Legacy → LP (bestehendes Muster) |

---

## Secrets Übersicht

### Lizenzportal (Edge Function Secrets, Projekt LP)

| Secret | Minimal | Vollständig |
|--------|---------|-------------|
| Standard Supabase Function Vars (`SUPABASE_URL`, …) | ✓ | ✓ |
| `TENANT_SERVER_MAIL_SECRET` | – | ✓ (Digest über LP) |

### Mandanten-Supabase (Edge Function Secrets)

| Secret | Minimal | Vollständig |
|--------|---------|-------------|
| `PORTAL_URL`, `APP_URL` | ✓ (wenn Portal/Digest-Links) | ✓ |
| `LP_SUPABASE_URL`, `LP_TENANT_ID`, `LP_TENANT_SERVER_MAIL_SECRET` | – | ✓ Digest über LP |
| `MAINTENANCE_DIGEST_CRON_SECRET` | – | ✓ wenn Cron aktiv |
| `RESEND_API_KEY`, `RESEND_FROM` | Nur bei Legacy-Pfad empfohlen | ✓ Fallback (`RESEND_FROM` z. B. `ArioVan <noreply@mail.amrtech.de>`) |
| `LP_SERVICE_ROLE_KEY` | – | optional (Mirror) |

Keine Secret-Werte ins Repo; Vorlagen: [`configs/mandanten-edge-secrets.example.env`](../configs/mandanten-edge-secrets.example.env), [`configs/license-portal-edge-secrets.example.env`](../configs/license-portal-edge-secrets.example.env).

### Globale Build-Umgebung (Cloudflare Pages o. Ä.)

| Variable | Wo | Pflicht für LP-Mail aus App |
|--------|-----|----------------------------|
| `VITE_LICENSE_API_URL` | Haupt-App (und ggf. andere Clients der Lizenz-API) | ✓ |
| `VITE_SUPABASE_*` | Haupt-App | ✓ (Mandantenprojekt) |

---

## Deployment

| Komponente | Funktionen |
|------------|------------|
| Lizenzportal | `license`, `send-tenant-email`, optional `send-tenant-email-server`, `admin-send-test-email`, `admin-preview-mail-template` |
| Mandanten-Supabase | `notify-portal-on-report`, optional `send-maintenance-reminder-digest`, optional Legacy `send-maintenance-report` |

Konkrete npm-Befehle: [`Mailversand-Deployment-Checkliste.md`](./Mailversand-Deployment-Checkliste.md).

---

## Tests

| # | Testfall | Erwartung |
|---|----------|-----------|
| 1 | **Testmail** im Lizenzadmin (Mandant gespeichert, Empfänger eingetragen) | Zustellung ok oder klare Fehlermeldung (z. B. fehlender API-Key) |
| 2 | **Vorlagen-Vorschau** global oder pro Mandant | HTML ohne Fehler |
| 3 | **PDF-Mail** aus Hauptapp | Konsole: `path=license_portal`; Mail mit Anhang |
| 4 | **Portal-Hinweis** bei neuem Bericht | Mail mit Link; LP-Log `portal_report_notification` |
| 5 | **Digest** (Cron/Testcall mit Secret) | JSON: `lp_sends` oder dokumentierter Fallback |
| 6 | **`tenant_mail_delivery_log`** (LP) | Neue Zeilen zum Mandanten |

Detail: [`Mailversand-Quickcheck.md`](./Mailversand-Quickcheck.md).

---

## Fehlerquellen

| Symptom | Typische Ursache |
|---------|------------------|
| „Domain nicht freigegeben“ / 403 bei Mail | `allowed_domains` im LP nicht oder falsch (Hostname ohne `https://`) |
| „Token gehört nicht zu diesem Mandanten“ | `supabase_url` im LP-Mandanten ≠ echte Mandanten-Supabase-URL |
| „Mandanten-Supabase-URL fehlt“ | `tenants.supabase_url` leer |
| PDF immer Legacy | `VITE_LICENSE_API_URL` fehlt oder Lizenz liefert kein `tenant_id` |
| Digest nur Resend | `LP_*` oder LP-Secret fehlt / falsch; oder `send-tenant-email-server` nicht deployt |
| Resend „Domain not verified“ | Absender-Domain bei Resend nicht verifiziert; falsches `RESEND_FROM` |
| SMTP TLS/Port | Falsche Kombination Port 465 vs 587 und `smtp_implicit_tls` |
| Testmail ok, App-Mail fehlgeschlagen | Session/JWT abgelaufen; anderer Origin als in `allowed_domains` |
| Digest kommt nicht | Cron-Zeitfenster / `MAINTENANCE_DIGEST_CRON_SECRET`; keine fälligen Einträge |

---

## Verbesserungsvorschläge

### Automatisierung (teilweise möglich)

- **CI/CD:** `npm run lp:deploy:mail-stack` und `mandant:deploy:mail-functions` mit `--project-ref` aus Registry ([`configs/mandanten-registry.example.json`](../configs/mandanten-registry.example.json)).
- **Secrets:** `supabase secrets set --env-file …` mit lokalen, nicht committeten `.env`-Dateien pro Projekt.
- **Nicht trivial automatisch:** Resend-Domain-Verifikation, SMTP-Zugangsdaten-Validierung, korrekte `allowed_domains` ohne menschliche Hostliste.

### Wizard im Lizenzadmin (sinnvoll)

Ein geführter **„Mail-Einrichtung“**-Assistent könnte:

- Pflichtfelder (`supabase_url`, `allowed_domains`, Provider, Absender) mit Kurzerklärung und Links zu dieser Checkliste abfragen;
- nach Speichern **Testmail** und Link zu **Globale Mailvorlagen** anbieten;
- Optional Schritt „Digest“: Kopierfeld für `LP_TENANT_ID`, Hinweis auf gleiches Secret auf beiden Seiten, Deploy-Hinweis.

Das reduziert Fehlkonfigurationen, ersetzt aber keine Resend-/SMTP-Kontoverifikation und kein externes DNS.

---

## Lizenzadmin – Felder im Überblick (Mail-relevant)

| Feld / Bereich | Für LP-Mail aus App | Hinweis |
|----------------|---------------------|---------|
| Name, Domains (`app_domain`, …) | indirekt | Design/Lookup |
| **`supabase_url`** | **Pflicht** | JWT-Issuer-Abgleich für `send-tenant-email` |
| **`allowed_domains`** | **Empfohlen/produktiv meist Pflicht** | Leer = weniger strikt; Produktion soll Hosts eintragen |
| `mail_provider`, `mail_from_*`, `mail_reply_to`, SMTP-Spalten | **Pflicht für Versand** | Ohne Provider-Daten + Geheimnis kein Versand |
| Mandanten-Geheimnisse (Resend/SMTP) | **Pflicht** | Über Admin-Flow (`upsert_tenant_mail_secrets`), nicht ins Repo |
| `mail_monthly_limit` | Nutzungsgrenze | Standard 3000 |
| Lizenz zum Mandanten | **Pflicht** | Liefert `tenant_id` an die App |

Globale Vorlagen: Menü **Mailvorlagen global**; Overrides: Mandantenformular **Mailvorlagen**.
