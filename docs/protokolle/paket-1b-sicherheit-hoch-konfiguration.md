# Paket 1B – hohe Sicherheits- und Konfigurationsrisiken

## Status
Abgeschlossen

## Ziel
Hohe, aber nicht mehr akut kritische Sicherheits- und Betriebsrisiken reduzieren, insbesondere:
- zu breite Konfigurationspfade
- unsaubere Cron-/Secret-Trennung
- fehlende Objekt-/Mandantenbindung
- doppelte produktive API-Pfade
- Public-vs-Secret-Missverständnisse

---

## Umgesetzte / bearbeitete Punkte

### 1. Produktiver API-Kanon – Analyse
- Status: analysiert
- Ergebnis:
  - Kanonischer Zielpfad ist Supabase Edge:
    - /functions/v1/license
    - /functions/v1/limit-exceeded
    - /functions/v1/update-impressum
  - Netlify `/api/*` ist nur noch Legacy-/Übergangspfad
- Restoffen:
  - Entscheidung dokumentieren
  - Legacy-Abschaltkriterium festlegen
  - produktive Builds auf einen Pfad verpflichten

### 2. allowed_domains / Origin-Strategie – Analyse
- Status: analysiert
- Ergebnis:
  - aktuelles Modell `leer = erlaubt` ist für Produktivmandanten zu permissiv
  - besonders kritisch beim `licenseNumber`-Pfad von `GET /license`
- Restoffen:
  - Übergangsstrategie definieren
  - Bestandsmandanten inventarisieren
  - spätere technische Verschärfung umsetzen

### 3. send-maintenance-reminder-digest
- Status: gehärtet
- Maßnahmen:
  - kein `SUPABASE_SERVICE_ROLE_KEY` mehr als Trigger-Bearer
  - nur noch `x-cron-secret`
  - fail-closed ohne `MAINTENANCE_DIGEST_CRON_SECRET`
- Restannahmen:
  - alle produktiven Aufrufer setzen das neue Cron-Secret korrekt

### 4. invite-portal-user
- Status: gehärtet
- Maßnahmen:
  - zusätzliche serverseitige Sichtbarkeitsprüfung über `customer_visible_to_user(customer_id)`
  - Admin allein reicht nicht mehr
  - Service Role erst nach erfolgreicher Objekt-/Mandantenprüfung
- Restannahmen:
  - `customer_visible_to_user` ist in allen relevanten Projekten vorhanden und korrekt deployt

### 5. send-standort-push
- Status: gehärtet
- Maßnahmen:
  - zusätzliche Bindung an offene `location_requests`
  - Aufrufer muss selbst die passende offene Anfrage für `user_id` erzeugt haben
  - Service Role erst nach erfolgreicher fachlichen Prüfung
- Restannahmen:
  - `location_requests` inkl. Migration/RLS ist überall korrekt verfügbar
  - Clients nutzen weiter den vorgesehenen Ablauf über `request_employee_location`

---

## Sicherheitsgewinn
Durch Paket 1B wurden insbesondere diese Risiken reduziert:
- Service-Role-Missbrauch als Cron-Trigger
- zu breite Nutzung sensibler Service-Role-Funktionen ohne Domänenbindung
- IDOR-/Cross-Tenant-Risiken bei Portal-Einladungen
- Missbrauch von Push-Endpunkten über frei gesetzte Ziel-IDs
- fehlende Klarheit über produktive vs. Legacy-API-Pfade

---

## Offene Folgepunkte
### Architektur / Betrieb
- Supabase Edge als produktiven Kanon offiziell festhalten
- Netlify `/api/*` als Legacy markieren
- Abschaltkriterium für Legacy definieren
- produktive VITE_LICENSE_API_URL-Werte pro App/Build prüfen

### Domain-/Origin-Strategie
- `allowed_domains`-Inventur für Bestandsmandanten
- Übergangsmodell für Internet-Mandanten definieren
- spätere technische Verschärfung des `license`-Pfads

### Secrets / Doku
- Public-vs-Secret-Matrix erstellen
- Kommentare/Doku zu `VITE_LICENSE_API_KEY`, `x-mandant-anon-key`, `verify_jwt` etc. angleichen
- Runbooks für Cron-Secret und API-Kanon ergänzen

---

## Teststatus
- Einzelne sicherheitsrelevante Pfade wurden gezielt gehärtet
- Integrations-/Betriebstests für:
  - Cron-Trigger
  - Portal-Invite-Flow
  - Standortanfrage → Push
  - Legacy-vs-Edge-API-Pfade
  - produktive `VITE_LICENSE_API_URL`
  sind weiterhin sinnvoll

---

## Ergebnis
Paket 1B weitgehend erfolgreich abgeschlossen.
Die wichtigsten hohen Sicherheits- und Konfigurationsrisiken wurden analysiert oder gehärtet.
Verbleibende Themen sind vor allem Architektur-, Migrations- und Dokumentationsentscheidungen.
