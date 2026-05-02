# Mailversand – Legacy-Pfade und Lizenzportal

Die produktive Mandanten-Mail (Konfiguration Resend/SMTP im Lizenzportal, Logging, Nutzungszähler) läuft über die Edge Function **`send-tenant-email`** (Browser/JWT) bzw. **`send-tenant-email-server`** (Cron, nur ausgewählte Vorlagen, Shared Secret).

## Aktive Legacy-Pfade (bewusst nicht entfernt)

| Pfad | Ort | Hinweis |
|------|-----|---------|
| **`send-maintenance-report`** | Mandanten-Supabase Edge Function | Direkter Resend-Versand PDF. Bei jedem erfolgreichen Aufruf: Warnlog `[LEGACY]`. Empfehlung: Mandanten-App mit Lizenzportal-Pfad (`send-tenant-email`). |
| **Wartungs-Digest Fallback** | `send-maintenance-reminder-digest` | Primär: LP `send-tenant-email-server`, Vorlage `maintenance_reminder_digest`. Wenn LP nicht konfiguriert oder Versand fehlschlägt: direkter Resend mit Warnlog `[LEGACY]`. |

### Secrets und Absender

- **`RESEND_FROM`**: eine Adresse aus einer bei **Resend verifizierten Domain** verwenden, z. B. `ArioVan <noreply@mail.amrtech.de>`. Die reine Apex-Domain `@amrtech.de` löst optional zusätzliche Warnlogs aus.
- Keine Secrets in Logs ausgeben.

### Cron-Digest → Lizenzportal

In der **Mandanten-Supabase** setzen (gleicher Wert wie **`TENANT_SERVER_MAIL_SECRET`** im Lizenzportal):

- `LP_SUPABASE_URL` – Basis-URL des Lizenzportal-Projekts (`https://<ref>.supabase.co`)
- `LP_TENANT_ID` – UUID des Mandanten im Lizenzportal
- `LP_TENANT_SERVER_MAIL_SECRET` – mindestens 24 Zeichen; Header `x-tenant-server-mail-secret`

Die Mandanten-URL wird über **`x-mandant-supabase-url`** an das Lizenzportal gebunden (Abgleich mit `tenants.supabase_url`). Es gibt **kein** generisches Mail-Relay ohne diese Bindung.

### Deploy-Hinweis Lizenzportal

- Gesamter Mail-Stack (vier Functions): **`npm run lp:deploy:mail-stack`** (Repo-Root), nach `supabase link` unter `supabase-license-portal/`.
- Einzeln: `npm run lp:deploy:send-tenant-email-server`, `npm run lp:deploy:admin-mail`, …
- Details und Mandanten-Deploy: **[`Mailversand-Deployment-Checkliste.md`](./Mailversand-Deployment-Checkliste.md)** · **[`Mailversand-Neuer-Mandant-Checkliste.md`](./Mailversand-Neuer-Mandant-Checkliste.md)**

Nach Secret-Änderung **`TENANT_SERVER_MAIL_SECRET`** die Function **`send-tenant-email-server`** neu deployen.
