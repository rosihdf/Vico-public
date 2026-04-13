# Mailversand Quickcheck (5 Minuten)

Ziel: Schnell pruefen, ob E-Mails aus Vico technisch und fachlich korrekt versendet werden.

## 1) Voraussetzungen (1 Minute)

- [ ] Supabase Edge Functions deployed:
  - `send-maintenance-report`
  - `notify-portal-on-report`
  - `send-maintenance-reminder-digest` (falls Digest genutzt)
- [ ] Secrets gesetzt:
  - `RESEND_API_KEY`
  - `RESEND_FROM`
  - `PORTAL_URL` (fuer Portal-Benachrichtigungen)
- [ ] Testmandant + Testkunde + Testobjekt + Testbericht vorhanden
- [ ] Gueltige Test-E-Mail-Adresse verfuegbar

## 2) Wartungsprotokoll-PDF-Mail testen (2 Minuten)

### In der Hauptapp
- [ ] Auftrag/Monteurbericht oeffnen
- [ ] Zustellmodus auf E-Mail setzen (`email_auto` oder manuell senden)
- [ ] Abschluss/Senden ausloesen

### Erwartetes Ergebnis
- [ ] Keine Fehlermeldung im UI
- [ ] E-Mail mit PDF-Anhang kommt an
- [ ] Betreff/Dateiname plausibel
- [ ] PDF-Anhang oeffnet korrekt

### Bei Fehler
- [ ] Funktion-Logs in Supabase pruefen (`send-maintenance-report`)
- [ ] Typische Ursachen:
  - `RESEND_API_KEY` fehlt/ungueltig
  - `RESEND_FROM` nicht erlaubt
  - PDF-Storage-Pfad nicht lesbar

## 3) Portal-Benachrichtigung testen (1 Minute)

### Voraussetzungen je Kunde/BV
- [ ] Portal-Zustellung fuer Kunde/BV aktiv
- [ ] Mind. ein `customer_portal_users`-Eintrag mit E-Mail vorhanden

### Test
- [ ] Neuen Wartungsbericht speichern
- [ ] Trigger fuer `notify-portal-on-report` wird ausgeloest

### Erwartetes Ergebnis
- [ ] E-Mail mit Link zum Kundenportal kommt an
- [ ] Link nutzt korrekte `PORTAL_URL`

### Bei Fehler
- [ ] Funktion-Logs `notify-portal-on-report`
- [ ] Pruefen, ob `PORTAL_URL` Secret gesetzt ist (ohne trailing slash)

## 4) Digest testen (optional, 1 Minute)

- [ ] In Profil: Wartungserinnerung per E-Mail aktiv + Einwilligung vorhanden
- [ ] Faellige/ueberfaellige Wartungen vorhanden
- [ ] `send-maintenance-reminder-digest` manuell triggern (oder Cron-Fenster abwarten)
- [ ] Sammelmail kommt an

## 5) Kurzprotokoll

- Datum/Uhrzeit:
- Mandant:
- Getestete Flows:
  - [ ] PDF-Mail
  - [ ] Portal-Benachrichtigung
  - [ ] Digest
- Ergebnis: PASS / FAIL
- Fehlerbild (falls FAIL):
- Log-Hinweis (Function + Timestamp):
