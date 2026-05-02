# Mandanten-App: PDF-Mail über Lizenzportal

Wartungs-PDF per E-Mail soll primär über das Lizenzportal laufen:

**App** → `sendTenantEmailViaLicensePortal` → Edge Function **`send-tenant-email`**.

Ohne korrekte Konfiguration fällt die App auf die Mandanten-Edge Function **`send-maintenance-report`** zurück (Resend mit Secret **`RESEND_FROM`**).

## `VITE_LICENSE_API_URL` (Haupt-App / Cloudflare Pages)

- **Pflicht** für den Lizenzportal-Mailweg in Production: Basis-URL des Lizenzportal-Supabase mit Pfad **`/functions/v1`** (ohne Slash am Ende), z. B. `https://<ref>.supabase.co/functions/v1`.
- **Ohne** diese Variable ist `isLicenseApiConfigured()` falsch → PDF-Mail nutzt immer **`legacy_send_maintenance_report`**.
- In den Pages-**Umgebungsvariablen** setzen und **neu bereitstellen** (nur Setzen reicht nicht; es muss ein **neuer Build** die Variable einbacken).

### Referenz Lizenzportal (ArioVan Produktion)

```text
VITE_LICENSE_API_URL=https://ojryoosqwfbzlmdeywzs.supabase.co/functions/v1
```

**Prüfen nach Deploy:** In den DevTools bei PDF-Mail die Zeile `[PDF-Mail] vite_license_api_configured=true` erwarten. Steht dort `false`, ist die Variable im **Build** nicht angekommen (z. B. Cloudflare Pages → **Umgebungsvariablen** → Projekt der Haupt-App → **Erneut bereitstellen**).

## Lizenz-Cache und `tenant_id`

- Die App liest `tenant_id` aus der für die **aktuell gespeicherte Lizenznummer** gecachten Lizenz-API-Antwort (`getCachedLicenseTenantId`).
- Nach erfolgreichem Lizenzabruf schreibt `setCachedLicenseResponse`; fehlt `tenant_id`, erscheint eine **Browser-Konsole-Warnung** (`[Lizenz-Cache]`).
- PDF-Mail-Logs (`[PDF-Mail]` per **`console.warn`**, nicht `info`) zeigen `tenant_id_present=true|false` und den gewählten Pfad.

## Fallback: `RESEND_FROM` (Mandanten-Supabase)

Secrets für **`send-maintenance-report`**:

- **`RESEND_API_KEY`** – Resend-API-Key.
- **`RESEND_FROM`** – Absender; muss eine bei **Resend verifizierte** Domain nutzen.

Minimal für Betrieb (Beispiel):

```text
RESEND_FROM=ArioVan <noreply@mail.amrtech.de>
```

Die Apex-Adresse `…@amrtech.de` (ohne Subdomain) führt typischerweise zu Resend-Fehlern wie „domain not verified“. Die Function loggt in diesem Fall eine **Warnung** (ohne Secret-Werte).

## Tests nach Deploy

1. App neu bauen/bereitstellen mit gesetztem `VITE_LICENSE_API_URL`.
2. Lizenz neu laden / App neu starten (Cache mit `tenant_id`).
3. PDF-Mail senden; in den DevTools prüfen: `[PDF-Mail] path=license_portal`.
4. Im Lizenzportal prüfen: **`tenant_mail_delivery_log`** erhält einen Eintrag.
5. Kein Resend-Fehler mehr zur nicht verifizierten Root-Domain.
