# Domain-Bindung & Doppelnutzung-Erkennung

**Stand:** März 2025

## Übersicht

Zwei Maßnahmen gegen doppelte Lizenznutzung:

1. **Domain-Bindung** – Lizenz nur von konfigurierten Domains nutzbar
2. **Monitoring** – Hinweis bei mehreren unterschiedlichen Domains pro Lizenz

---

## 1. Domain-Bindung

### Schema

- `tenants.allowed_domains` (jsonb, default `[]`) – Liste erlaubter Domains
- Leer = keine Prüfung (Rückwärtskompatibilität)

### Konfiguration (Admin)

Im Mandanten-Formular unter **„Domain-Bindung (erlaubte Domains)“**:

- Eine Domain pro Zeile (oder kommagetrennt)
- Beispiele: `app.firma.de`, `localhost:5173`
- Wildcard: `*.firma.de` (alle Subdomains)

### Ablauf

1. App ruft Lizenz-API mit `licenseNumber` auf
2. API prüft `Origin`- bzw. `Referer`-Header
3. Wenn `allowed_domains` nicht leer: Host muss in der Liste sein
4. Sonst: HTTP 403 „Domain nicht für diese Lizenz freigegeben“

### Lokale Entwicklung

`localhost:5173` (oder jeweiligen Port) in `allowed_domains` eintragen.

---

## 2. Doppelnutzung-Monitoring

### Schema

- `limit_exceeded_log.reported_from` (text) – Domain/Origin der Meldung

### Ablauf

- Bei Grenzüberschreitung sendet die App `window.location.origin` mit
- Admin zeigt in **Grenzüberschreitungen** die Domain pro Eintrag
- Wenn für dieselbe Lizenz mehrere unterschiedliche Domains melden: Hinweis „Mögliche Doppelnutzung“

---

## 3. Duplikat-Prüfung (Admin)

Beim Anlegen einer neuen Lizenz wird geprüft, ob die Lizenznummer bereits existiert. Bei Duplikat: Fehlermeldung statt DB-Fehler.

---

## Migration (bestehendes Lizenzportal)

Schema-Änderungen sind in `supabase-license-portal.sql` idempotent. Einfach das Skript erneut ausführen – die `do $$`-Blöcke fügen die Spalten hinzu, falls sie fehlen.

**Edge Functions deployen:**

```bash
cd supabase-license-portal
supabase functions deploy license
supabase functions deploy limit-exceeded
```
