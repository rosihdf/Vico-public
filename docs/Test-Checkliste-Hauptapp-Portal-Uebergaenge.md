# Test-Checkliste: Hauptapp, Portale und Uebergaenge

Ziel: Ein kompletter manueller Funktionstest ueber Haupt-App, Kundenportal, Arbeitszeit-Portal und relevante Uebergaenge.

Basis-Dokumente:
- `docs/Komponenten-und-Funktionen.md`
- `docs/Release-Checkliste.md`
- `docs/Beta-Feedback-Smoke-Test-und-Mapping.md`
- `docs/Diagnose-App-Version-Rollout.md`

## 1) Testvorbereitung

- [ ] Testmandant mit gueltiger Lizenz vorhanden
- [ ] Rollen vorhanden: Admin, Mitarbeiter, Teamleiter, Portal-Benutzer
- [ ] Lizenz-Features fuer Test bewusst gesetzt (inkl. deaktivierte Faelle)
- [ ] `allowed_domains`/Host-Lookup fuer Hauptapp, Kundenportal, Arbeitszeit-Portal korrekt
- [ ] Testdaten vorhanden: mindestens 1 Kunde, 1 Objekt/BV, 1 Tuer/Tor, 1 Auftrag, 1 Wartungsprotokoll
- [ ] Browser-Cache/SW einmal hart neu laden (sauberer Start)

## 2) Hauptapp - Kernfunktionen

### 2.1 Auth, Start, Navigation
- [ ] Login/Logout funktioniert
- [ ] Startseite laedt ohne Fehler
- [ ] Menue zeigt nur erlaubte Module gemaess Lizenz/Rolle

### 2.2 Kunden/BV/Objekte/Tuer-Tor
- [ ] Kunden CRUD funktioniert
- [ ] BV/Objekt CRUD funktioniert
- [ ] Tuer/Tor anlegen/bearbeiten funktioniert
- [ ] Auswahllisten Hersteller/Schliessmittel funktionieren
- [ ] Freitext-Umschaltung bei Hersteller/Schliessmittel funktioniert
- [ ] Profilfoto/Galerie hochladen/anzeigen/entfernen funktioniert

### 2.3 Wartungsprotokolle
- [ ] Protokoll anlegen/bearbeiten/speichern
- [ ] Maengel, Fotos, Unterschriften funktionieren
- [ ] PDF-Export funktioniert

### 2.4 Auftrag/Monteurbericht
- [ ] Auftrag anlegen (inkl. Tuer-Auswahl) funktioniert
- [ ] Auftragsdetail oeffnet korrekt
- [ ] Abschluss inkl. Unterschriften funktioniert

### 2.5 Suche/Scan
- [ ] Suche liefert erwartete Treffer
- [ ] QR-Scan oeffnet korrektes Objekt

### 2.6 Einstellungen/Info/Lizenz
- [ ] Komponentenliste sichtbar und speicherbar
- [ ] Stammdaten/Impressum vorbefuellt, speicherbar, Erfolgsmeldung sichtbar
- [ ] Info/Lizenz zeigt gewuenschte Features (ohne die ausgeblendeten System/Beta-Eintraege)

## 3) System-Module in Hauptapp (falls lizenziert)

- [ ] Historie (`/historie`) laedt und filtert
- [ ] Fehlerberichte (`/fehlerberichte`) laedt
- [ ] Ladezeiten (`/ladezeiten`) laedt

## 4) Kundenportal

- [ ] Login (Magic-Link) funktioniert
- [ ] Berichte-Liste sichtbar fuer berechtigte Objekte/Kunden
- [ ] PDF-Download aus Bericht funktioniert
- [ ] Impressum/Datenschutz zeigen Mandantenwerte

## 5) Arbeitszeit-Portal

- [ ] Login funktioniert
- [ ] Uebersicht laedt (Soll/Ist)
- [ ] Alle Zeiten-Ansicht inkl. Filter funktioniert
- [ ] Urlaub (stellen/genehmigen je Rolle) funktioniert
- [ ] Log-Ansicht laedt
- [ ] Stammdaten/Soll-Minuten (Admin) speicherbar
- [ ] Standort-Funktionen je Einwilligung/Rolle korrekt

## 6) Uebergaenge Hauptapp <-> Portale

- [ ] Link/Button zum Arbeitszeit-Portal aus Hauptapp funktioniert
- [ ] Portal-/App-URLs in Lizenz/Design stimmen
- [ ] Rollenrechte bleiben beim Wechsel konsistent
- [ ] Oeffentliche Seiten (`/impressum`, `/datenschutz`) in allen Apps korrekt

## 7) Rollout-/Lizenzportal-relevante Uebergaenge

- [ ] Release in LP freigegeben -> Mandanten-Apps erhalten `mandantenReleases`
- [ ] Incoming-Banner erscheint nur fuer Pilot/Testmandanten wie erwartet
- [ ] Rollout-Hinweis/Banner (Aktualisieren/Spaeter) reagiert bei Zuweisungswechsel
- [ ] Hard-Reload-Gate greift nur bei entsprechendem Release-Flag

## 8) Beta-Feedback (falls Feature aktiv)

- [ ] Widget sichtbar in Hauptapp/Kundenportal/AZ-Portal nur wenn eingeloggt + Feature aktiv
- [ ] Submit funktioniert in allen drei Apps
- [ ] Quelle (`main`, `kundenportal`, `arbeitszeit_portal`) wird korrekt gespeichert
- [ ] Eintrag im LP unter `/beta-feedback` sichtbar und bearbeitbar

## 9) Negativtests (wichtig)

- [ ] Ohne Lizenz-Feature sind Module sauber ausgeblendet/gesperrt
- [ ] Ohne Online-Verbindung: erwartetes Offline-Verhalten (lesen aus Cache, schreiben Outbox)
- [ ] Ungueltige Eingaben zeigen verwertbare Fehlermeldungen
- [ ] Keine 401/403/500 bei Standard-Workflows

## 10) Abschluss

- [ ] Kurze Ergebnisliste erstellt (OK / NOK / Blocker)
- [ ] Reproduzierbare Bugs mit Route, Rolle, Mandant, Uhrzeit dokumentiert
- [ ] Wenn Rollout geprueft wurde: Audit in LP (`/release-audit`) kontrolliert

---

## Kurzprotokoll pro Testlauf

- Datum:
- Umgebung (lokal/staging/prod):
- Mandant:
- Tester:
- Ergebnis gesamt: PASS / PASS mit Einschraenkungen / FAIL
- Kritische Findings:
- Nacharbeit:
