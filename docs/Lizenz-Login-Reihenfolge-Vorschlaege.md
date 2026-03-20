# Lizenz-Login-Reihenfolge: Vorschläge für nutzerfreundlicheren Ablauf

**Problem:** Auf einem neuen Gerät muss der Nutzer die Lizenznummer eingeben, bevor er sich einloggen kann. Das ist nicht nutzerfreundlich – der Admin aktiviert die Lizenz und legt Nutzer an, diese sollen sich ohne Lizenznummer-Eingabe einloggen können.

**Zielablauf:** Admin aktiviert Lizenz einmal → legt Nutzer an → Nutzer loggen sich nur mit E-Mail/Passwort ein.

---

**✅ Option A implementiert (März 2025):** Lizenznummer wird in Mandanten-DB gespeichert. Login zuerst, Lizenz aus DB nach Auth. Auto-Format bei Eingabe (VIC-XXXX-XXXX).

---

## Option A: Lizenznummer in Mandanten-DB speichern (empfohlen)

**Idee:** Die Lizenznummer wird einmalig vom Admin in der Mandanten-DB gespeichert. Alle Nutzer (inkl. neue Geräte) holen sie automatisch nach dem Login aus der DB.

### Ablauf

1. **Erstmalige Aktivierung (Admin):**
   - Admin öffnet App → sieht Login (keine Lizenz nötig)
   - Admin loggt sich ein
   - Wenn noch keine Lizenz in DB: Hinweis „Lizenz aktivieren“ (nur für Admin sichtbar)
   - Admin gibt Lizenznummer ein → wird in Mandanten-DB gespeichert

2. **Normale Nutzer (neu oder neues Gerät):**
   - Nutzer öffnet App → sieht Login
   - Nutzer loggt sich mit E-Mail/Passwort ein
   - App holt Lizenznummer aus Mandanten-DB (RPC)
   - Lizenz wird geladen, App nutzbar – **keine manuelle Eingabe**

### Technische Änderungen

| Bereich | Änderung |
|---------|----------|
| **DB** | Spalte `license_number` in `public.license` ergänzen |
| **RPC** | `get_license_number()` – gibt Lizenznummer für authentifizierte Nutzer zurück |
| **RPC** | `set_license_number(p_number text)` – Admin-only, speichert Lizenznummer |
| **LicenseGate** | Reihenfolge umkehren: Ohne Lizenz zuerst Login anzeigen (nicht AktivierungsScreen) |
| **LicenseGate** | Nach Login: Lizenznummer aus DB holen, falls nicht in localStorage |
| **AktivierungsScreen** | Nur für Admin nach Login; speichert in DB (nicht nur localStorage) |
| **Fallback** | Wenn kein Admin und keine Lizenz in DB: „Bitte Administrator kontaktieren“ |

### Vorteile

- Nutzer müssen Lizenznummer nie kennen
- Einmalige Einrichtung durch Admin
- Funktioniert auf allen Geräten
- Keine Änderung am Lizenzportal nötig

### Aufwand

Ca. 1–2 Tage (DB-Migration, RPCs, LicenseGate-Logik, AktivierungsScreen anpassen).

---

## Option B: Lizenznummer per Einladungslink

**Idee:** Beim Anlegen eines Nutzers wird ein Einladungslink mit Lizenznummer als Query-Parameter erzeugt. Der Nutzer klickt den Link → Lizenz wird automatisch gesetzt.

### Ablauf

1. Admin legt Nutzer an und sendet Einladung (E-Mail mit Link)
2. Link z.B. `https://app.example.com/login?license=VIC-XXXX-XXXX`
3. App liest `license` aus URL, speichert in localStorage, entfernt Parameter
4. Nutzer gibt nur Passwort ein (E-Mail ist im Link/Token)

### Technische Änderungen

- Einladungs-E-Mail mit parametrisiertem Link
- Login-Seite: URL-Parameter auslesen, Lizenz setzen
- Optional: Lizenz in DB speichern (wie Option A) für spätere Logins

### Vorteile

- Lizenznummer wird nie manuell eingegeben
- Einladung enthält alles Nötige

### Nachteile

- Nutzer muss den exakten Link nutzen
- Bei neuem Gerät später: wieder Lizenz nötig (außer mit Option A kombiniert)

---

## Option C: Domain-Bindung + automatische Lizenzzuordnung

**Idee:** Jede Domain ist einer Lizenz zugeordnet. Beim Aufruf von `app.mandant.de` kennt die App die Lizenz über die Domain.

### Ablauf

1. Admin konfiguriert im Lizenzportal: Domain `app.mandant.de` → Lizenz VIC-XXXX-XXXX
2. App wird unter dieser Domain deployed
3. Beim Laden prüft die App: `window.location.hostname` → Lookup welche Lizenz dazu gehört
4. Neuer API-Endpoint: `GET /license-by-domain?domain=app.mandant.de` → Lizenznummer

### Technische Änderungen

- Lizenzportal: Domain-zu-Lizenz-Mapping
- API: Endpoint für Domain-Lookup
- App: Beim Start Domain prüfen, Lizenz abrufen

### Vorteile

- Keine Eingabe, keine DB-Änderung in Mandanten-DB
- Pro Mandant eigene Domain (z.B. Subdomain)

### Nachteile

- Jeder Mandant braucht eigene Domain/Subdomain
- Mehr Infrastruktur (DNS, Deployment pro Mandant oder Routing)

---

## Option D: Hybrid – Login zuerst, Lizenz aus DB (Minimalvariante von A)

**Idee:** Wie Option A, aber mit minimalen Änderungen.

### Konkrete Schritte

1. **`public.license`** – Spalte `license_number text` hinzufügen
2. **RPC `get_license_number()`** – `SELECT license_number FROM license LIMIT 1` (nur für authenticated)
3. **RPC `set_license_number(p text)`** – `UPDATE license SET license_number = p` (nur Admin)
4. **LicenseGate** – Wenn keine Lizenz in localStorage:
   - Pfade `/login`, `/reset-password` erlauben (statt AktivierungsScreen)
   - Bei anderen Pfaden → Redirect zu `/login`
5. **LicenseGate** – Wenn authentifiziert und keine Lizenz in localStorage:
   - `get_license_number()` aufrufen
   - Wenn gefunden: in localStorage speichern, Lizenz laden, fertig
   - Wenn nicht gefunden und Admin: AktivierungsScreen zeigen (speichert in DB)
   - Wenn nicht gefunden und kein Admin: „Bitte Administrator kontaktieren“
6. **AktivierungsScreen** – Beim Speichern: `set_license_number()` aufrufen (wenn Admin)

### Reihenfolge im UI

```
Ohne Lizenz in localStorage:
  → Login anzeigen (nicht AktivierungsScreen)

Nach Login:
  → Lizenz aus DB holen
  → Wenn vorhanden: App nutzbar
  → Wenn nicht + Admin: AktivierungsScreen (einmalig)
  → Wenn nicht + kein Admin: Fehlermeldung
```

---

## Empfehlung

**Option A / D** (Lizenznummer in Mandanten-DB) ist am pragmatischsten:

- Geringer Aufwand
- Keine Änderung an Lizenzportal oder Deployment
- Nutzerfreundlich: Admin richtet einmal ein, alle anderen loggen sich normal ein

**Option B** kann als Ergänzung sinnvoll sein (Einladungslink mit Lizenz), ersetzt aber nicht die DB-Speicherung für spätere Logins.

**Option C** ist eher für Multi-Tenant-SaaS mit eigener Domain pro Mandant geeignet.
