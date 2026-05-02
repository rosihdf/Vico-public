# Mailversand – Deployment-Checkliste und Betrieb

Ziel: Nach Umstellung auf den **zentralen LP-Mailweg** sind Deployments, Secrets und Vorlagenstände nachvollziehbar – **ohne** echte Secrets im Repo.

Verwandte Dokumente:

- **Neuer Mandant (Mail-Setup, Admin-Sicht):** [`Mailversand-Neuer-Mandant-Checkliste.md`](./Mailversand-Neuer-Mandant-Checkliste.md)
- Kurztest Nutzer-Sicht: [`Mailversand-Quickcheck.md`](./Mailversand-Quickcheck.md)
- Legacy-Pfade und Fallbacks: [`Mailversand-Legacy.md`](./Mailversand-Legacy.md)

---

## 1. Zu deployende Edge Functions (inhaltlich prüfen / ausrollen)

### Lizenzportal (`supabase-license-portal/`)

| Function | Rolle |
|----------|--------|
| `send-tenant-email` | Hauptweg PDF-/Template-Mail mit Mandanten-JWT |
| `send-tenant-email-server` | Cron/Digest mit Shared Secret (`maintenance_reminder_digest`) |
| `admin-send-test-email` | Testmail aus Lizenzadmin |
| `admin-preview-mail-template` | Vorlagen-Vorschau im Admin |
| `license` | Lizenz-API (kein Mail – oft gleicher Rollout-Zyklus) |

**npm (Repo-Root):**

```bash
cd supabase-license-portal && supabase link --project-ref <LIZENZ_REF>

npm run lp:deploy:mail-stack
npm run lp:deploy:mandanten-update
```

Einzeldeploys bei Bedarf:

- `npm run lp:deploy:send-tenant-email`
- `npm run lp:deploy:send-tenant-email-server`
- `npm run lp:deploy:admin-mail`

**Hinweis:** Ob eine Function auf dem Projekt wirklich „live“ ist, sieht man im Supabase-Dashboard unter Edge Functions oder über einen gezielten Aufruf/Test.

### Mandanten-Supabase (`supabase/functions/` im Repo-Root)

| Function | Rolle |
|----------|--------|
| `notify-portal-on-report` | Portal-Hinweis → ruft LP `send-tenant-email` auf |
| `send-maintenance-reminder-digest` | Digest → primär LP `send-tenant-email-server`, optional Resend-Fallback |
| `send-maintenance-report` | **Legacy** direkter PDF-Versand per Resend |

**npm:**

```bash
npm run mandant:deploy:mail-functions -- --project-ref <MANDANT_REF>
```

Ohne `supabase/config.toml` im Root ist `--project-ref` typischerweise nötig (siehe [`Cloudflare-Go-Live-Abarbeitung.md`](./Cloudflare-Go-Live-Abarbeitung.md)).

---

## 2. Secrets – wo welcher Name

### Lizenzportal (Edge Function Secrets)

| Secret | Pflicht | Hinweis |
|--------|---------|---------|
| `TENANT_SERVER_MAIL_SECRET` | Für Digest-Serverweg | Mindestens **24** Zeichen; gleicher Wert wie `LP_TENANT_SERVER_MAIL_SECRET` auf dem Mandanten. Nach Setzen **`send-tenant-email-server`** neu deployen. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, … | Ja | Wie von Supabase für Functions vorgegeben |

Keine echten Werte committen. Vorlage ohne Werte: [`configs/license-portal-edge-secrets.example.env`](../configs/license-portal-edge-secrets.example.env).

### Mandanten-Supabase (Edge Function Secrets)

| Secret | Hinweis |
|--------|---------|
| `LP_SUPABASE_URL` | Basis-URL Lizenzportal, z. B. `https://<ref>.supabase.co` |
| `LP_TENANT_ID` | UUID des Mandanten in `tenants` (LP) |
| `LP_TENANT_SERVER_MAIL_SECRET` | Identisch zu `TENANT_SERVER_MAIL_SECRET` (LP) |
| `RESEND_API_KEY` | Nur für **Legacy-Fallback** (PDF direkt, Digest-Fallback) |
| `RESEND_FROM` | Legacy-Absender; empfohlen: **`ArioVan <noreply@mail.amrtech.de>`** (verifizierte Resend-Domain) |
| `MAINTENANCE_DIGEST_CRON_SECRET` | Aufrufschutz Digest-Function |
| `LP_SERVICE_ROLE_KEY` | Optional: Nutzungs-Spiegelung Legacy → LP RPC (bestehendes Muster) |

Vorlage: [`configs/mandanten-edge-secrets.example.env`](../configs/mandanten-edge-secrets.example.env).

### Haupt-App Build (Cloudflare Pages / Vite)

| Variable | Prüfung |
|----------|---------|
| `VITE_LICENSE_API_URL` | Basis **`…/functions/v1`** ohne Slash am Ende – nötig für PDF-Mail über LP |

`tenant_id` kommt aus der **Lizenz-API** (Cache), nicht aus einem VITE-Secret.

---

## 3. Diagnose (schnell)

### PDF-Mail nutzt Lizenzportal?

In der **Browser-Konsole** beim Senden erscheint eine Warnzeile vom Typ:

`[PDF-Mail] path=license_portal …` **oder** `path=legacy_send_maintenance_report …`.

- **`license_portal`:** `VITE_LICENSE_API_URL` gesetzt **und** `tenant_id` im Lizenz-Cache vorhanden.
- **`legacy_send_maintenance_report`:** entweder Lizenz-API nicht konfiguriert oder `tenant_id` fehlt → Aufruf von **`send-maintenance-report`** (Mandanten-Function).

### Reminder-Digest nutzt LP?

In der **JSON-Antwort** der Function nach Cron/Test:

- `lp_configured: true` und `lp_sends` > 0 → Versand über **`send-tenant-email-server`**.
- `legacy_resend_sends` > 0 → mindestens ein Fallback über Resend (Logs prüfen: `[LEGACY]`).

Voraussetzung LP: `LP_SUPABASE_URL`, `LP_TENANT_ID`, `LP_TENANT_SERVER_MAIL_SECRET` gesetzt; LP kennt `TENANT_SERVER_MAIL_SECRET`.

### Fallback aktiv?

- PDF: s.o. `path=legacy_send_maintenance_report`.
- Digest: `lp_configured: false` oder Warnungen zur LP-Anfrage + Resend-Versand.

### tenant_id vorhanden?

Lizenz-API erfolgreich geladen + Mandant in LP korrekt verknüpft (UUID in Antwort/Cache). Ohne `tenant_id` kein LP-PDF-Mailweg.

### `VITE_LICENSE_API_URL` gesetzt?

Build-/Runtime-Konfiguration der Haupt-App prüfen (Pages-Umgebungsvariablen). Ohne Wert: PDF-Mail nur Legacy.

---

## 4. Globale Vorlage `maintenance_reminder_digest` aktualisieren

Das SQL-Seed im Repo legt die Zeile nur an, wenn **noch keine** globale Zeile existiert (`where not exists`). Bestehende Installationen müssen die Vorlage **manuell** oder per **`UPDATE`** anpassen.

**SQL (Lizenzportal-DB, z. B. SQL-Editor)** – Platzhalter wie im aktuellen Seed; nur ausführen, wenn die globale Zeile für `de` existiert:

```sql
update public.tenant_mail_templates
set
  name = 'Wartungs-Erinnerungen',
  subject_template = 'Wartungserinnerung: {{digest.anzahl}} Objekt(e) — {{datum}} ({{mandant.name}})',
  html_template =
    '<p>Guten Tag,</p><p>folgende Wartungen sind <strong>überfällig</strong> oder stehen in den <strong>nächsten 30 Tagen</strong> an ({{datum}}, {{app.name}}):</p>{{digest.tabellen_html}}<p><a href="{{portal.link}}">Zur App</a></p><p style="color:#64748b;font-size:12px;">Sie erhalten diese Nachricht, weil Sie E-Mail-Erinnerungen zur Wartungsplanung aktiviert haben.</p>',
  text_template = '',
  enabled = true,
  updated_at = now()
where tenant_id is null
  and template_key = 'maintenance_reminder_digest'
  and locale = 'de';
```

**Alternative:** Lizenzadmin → **Mailvorlagen global** → Digest auswählen → speichern (gleicher Inhalt wie oben editierbar).

---

## 5. Smoke-Tests (kurz)

1. **Testmail Lizenzadmin:** Mandant auswählen → Testmail / Vorlagen-Test wie gewohnt.
2. **PDF-Mail Hauptapp:** Bericht per E-Mail senden; Konsole: `path=license_portal` erwünscht; E-Mail mit Anhang.
3. **Portal-Hinweis:** Neuer Bericht mit aktivem Portal-Kanal → E-Mail mit Portal-Link (Logs `notify-portal-on-report`).
4. **Reminder-Digest:** Function mit gültigem `x-cron-secret` triggern (und Versandfenster beachten); Response `lp_sends` / `legacy_resend_sends` prüfen.
5. **Protokoll LP:** Tabelle **`tenant_mail_delivery_log`** (Lizenzportal) auf neue Zeilen zum Mandanten und Kanal prüfen (`maintenance_pdf`, `maintenance_reminder`, `portal_report_notification`, …).

---

## Restrisiken

- Deploy-Stand je Projekt muss im Dashboard verifiziert werden (Skripte ersetzen keine Projektliste).
- **`mail_monthly_limit`:** Zähler/Logs existieren; harte Sperre vor Versand ist nicht Teil dieser Checkliste.
