# Mailversand Quickcheck (ca. 5 Minuten)

Ziel: Schnell prüfen, ob E-Mails für Mandanten **über Lizenzportal** bzw. bekannten Legacy-Pfaden funktionieren.

**Deployment und Mandanten-Setup (Admin):** [`Mailversand-Deployment-Checkliste.md`](./Mailversand-Deployment-Checkliste.md) · [`Mailversand-Neuer-Mandant-Checkliste.md`](./Mailversand-Neuer-Mandant-Checkliste.md)  
**Legacy / Fallback:** [`Mailversand-Legacy.md`](./Mailversand-Legacy.md)

---

## 1) Voraussetzungen (kurz)

- [ ] **LP Functions deployed:** mind. `send-tenant-email`, `send-tenant-email-server` (siehe Checkliste / `npm run lp:deploy:mail-stack`)
- [ ] **Mandanten Functions:** `notify-portal-on-report`, `send-maintenance-reminder-digest`; Legacy optional `send-maintenance-report`
- [ ] **Secrets LP:** `TENANT_SERVER_MAIL_SECRET` (min. 24 Zeichen) und nach Änderung `send-tenant-email-server` neu deployt
- [ ] **Secrets Mandant:** für Digest `LP_SUPABASE_URL`, `LP_TENANT_ID`, `LP_TENANT_SERVER_MAIL_SECRET`; für Fallback `RESEND_*`; Digest-Cron `MAINTENANCE_DIGEST_CRON_SECRET`
- [ ] **Haupt-App:** `VITE_LICENSE_API_URL` gesetzt → PDF bevorzugt über LP (`tenant_id` aus Lizenz-Cache)
- [ ] Test-E-Mail-Adresse verfügbar

---

## 2) PDF-Mail (Hauptapp)

### Schritte

- [ ] Wartungsprotokoll versenden (wie gewohnt)

### Erwartung

- [ ] Keine Fehlermeldung im UI
- [ ] E-Mail mit PDF-Anhang
- [ ] Browser-Konsole: `[PDF-Mail] path=license_portal` (ideal) oder dokumentierter Legacy-Pfad

### Bei Fehler

- [ ] `send-tenant-email`-Logs (LP) oder `send-maintenance-report` (Legacy)
- [ ] Domain (`allowed_domains`), LP-Mailkonfiguration, Session/JWT

---

## 3) Portal-Hinweis-Mail

- [ ] Portal-Zustellung für Kunde/BV aktiv; Portal-Nutzer mit E-Mail
- [ ] Neuen Bericht speichern → `notify-portal-on-report`
- [ ] E-Mail mit korrektem Portal-Link (`PORTAL_URL`)

---

## 4) Reminder-Digest (optional)

- [ ] Profil: Erinnerung aktiv + Einwilligung
- [ ] Überfällige/bald fällige Einträge vorhanden
- [ ] Function triggern (Cron oder manuell mit `x-cron-secret`; Zeitfenster beachten)
- [ ] Antwort JSON: `lp_sends` bzw. `legacy_resend_sends` sichtbar

---

## 5) LP-Protokoll

- [ ] Im Lizenzportal Tabelle **`tenant_mail_delivery_log`** zur erwarteten `tenant_id` und zum Kanal (z. B. `maintenance_pdf`, `maintenance_reminder`) prüfen

---

## 6) Kurzprotokoll

| Feld | Eintrag |
|------|---------|
| Datum/Uhrzeit | |
| Mandant | |
| PDF-Mail | PASS / FAIL (Pfad license_portal / legacy) |
| Portal-Mail | PASS / FAIL |
| Digest | PASS / FAIL / n/a |
| tenant_mail_delivery_log | PASS / FAIL |

Fehlerbild / Function + Zeitstempel:
