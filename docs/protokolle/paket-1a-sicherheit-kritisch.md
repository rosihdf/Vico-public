# Paket 1A – kritische Sicherheitsprüfung

## Status
Abgeschlossen

## Ziel
Kritische und hohe Sicherheitsrisiken bei öffentlich erreichbaren oder servernahen Functions reduzieren, insbesondere:
- anonyme Aufrufe
- zu schwache Autorisierung
- Service-Role-Missbrauch
- nur auf licenseNumber basierende Schreibzugriffe
- offene Missbrauchspfade

---

## Umgesetzte Functions

### 1. send-maintenance-report
- Status: gehärtet
- Maßnahmen:
  - JWT-Pflicht
  - nur POST
  - serverseitige Pfadprüfung für pdfStoragePath
  - Berechtigungsprüfung über User-Client / RLS
  - Service Role nur noch für Download/Versand nach erfolgreicher AuthZ
- Restannahmen:
  - RLS auf maintenance_reports / order_completions ist fachlich ausreichend eng

### 2. notify-portal-on-report
- Status: gehärtet
- Maßnahmen:
  - JWT-Pflicht
  - Rollenprüfung
  - report_id als UUID validiert
  - serverseitige Sichtbarkeitsprüfung über maintenance_reports -> objects
  - Kunde/BV mit User-Client gelesen
  - Service Role erst nach erfolgreicher AuthZ
- Restannahmen:
  - object_visible_to_user / Kunden-RLS bilden den gewünschten fachlichen Zugriff ausreichend ab

### 3. update-impressum
- Status: gehärtet
- Betroffene Pfade:
  - supabase-license-portal Edge Function
  - admin Netlify Function
- Maßnahmen:
  - JWT-Pflicht
  - Issuer-/Tenant-Bindung über tenants.supabase_url
  - Origin-/Referer-Prüfung bei gesetzten allowed_domains
  - zusätzlicher Mandanten-Anon-Key für Rollen-RPC
  - serverseitige Rollenprüfung über get_my_role
  - nur admin darf schreiben
- Restannahmen:
  - tenants.supabase_url korrekt gepflegt
  - get_my_role im Mandantenprojekt vorhanden und stabil

### 4. request-portal-magic-link
- Status: gehärtet
- Maßnahmen:
  - einheitliche 200-Antwort
  - In-Memory-Rate-Limit pro E-Mail und IP
  - Jitter/Verzögerung gegen Timing-Enumeration
  - POST only
  - strengere E-Mail-Validierung
  - sicherere Filter-Quotierung
- Restannahmen:
  - In-Memory-Limit reicht als erster Hardening-Schritt
  - verteiltes/globales Rate-Limit folgt ggf. später

### 5. cleanup-demo-data
- Status: gehärtet
- Maßnahmen:
  - keine anonyme Nutzung mehr
  - Secret-Pflicht
  - fail-closed ohne CLEANUP_DEMO_DATA_SECRET
  - POST only
- Restannahmen:
  - geplanter Aufrufer ist vertrauenswürdig
  - Secret wird sauber gesetzt und dokumentiert

### 6. infrastructure-ping
- Status: gehärtet
- Maßnahmen:
  - JWT-Pflicht
  - nur LP-Admin
  - POST only
  - URL-Validierung / Einschränkung auf sichere Ziele
  - localhost / RFC1918 / unsichere Ziele blockiert
  - Supabase-Ziele nur *.supabase.co
- Restannahmen:
  - IPv6-/Sonderfälle werden ggf. später weiter gehärtet

### 7. limit-exceeded
- Status: gehärtet
- Betroffene Pfade:
  - supabase-license-portal Edge Function
  - admin Netlify Function
- Maßnahmen:
  - JWT-Pflicht
  - Issuer-/Tenant-Bindung
  - Rollenprüfung über get_my_role
  - Leser/Kunde ausgeschlossen
  - Origin-Prüfung bei gesetzten allowed_domains
  - Haupt-App liefert Bearer + Mandanten-Anon-Key
- Restannahmen:
  - allowed_domains leer bleibt vorerst zulässig
  - Rollenmodell passt fachlich zum Meldeprozess

---

## Sicherheitsgewinn
Durch Paket 1A wurden insbesondere diese Risiken reduziert:
- anonyme schreibende oder mailversendende Endpunkte
- Service-Role-Nutzung ohne harte Aufruferprüfung
- Manipulation über bloße licenseNumber
- Missbrauch offener Infrastruktur-/Hilfsfunktionen
- einfache Enumeration/Spam bei Magic-Link-Anforderung

---

## Offene Folgepunkte für Paket 1B
- allowed_domains: Default-Deny vs. weiterhin leer zulässig
- Secrets / Env / Public-vs-Secret sauber dokumentieren
- Service-Role-Verwendung weiter minimieren
- Cron-/Secret-Trennung prüfen (z. B. send-maintenance-reminder-digest)
- produktiven URL-/Function-Kanon zwischen Edge und Netlify festlegen
- Parallelpfade weiter abbauen oder eindeutig als Referenz/Legacy markieren

---

## Offene Folgepunkte für SQL-/RLS-Review
- RLS-Schärfe bei maintenance_reports / order_completions
- Team-/Objektgrenzen bei send-standort-push
- invite-portal-user auf Mandanten-/Objektbindung prüfen
- Rollen-/RPC-Quellen wie get_my_role dokumentieren

---

## Teststatus
- Paket 1A funktional gehärtet
- Einzelne Testhinweise pro Function dokumentiert
- Gesamtvalidierung in Paket 1B / Testphase noch sinnvoll

---

## Ergebnis
Paket 1A erfolgreich abgeschlossen.
Die kritischsten öffentlich erreichbaren oder zu schwach geschützten Functions wurden gehärtet.
