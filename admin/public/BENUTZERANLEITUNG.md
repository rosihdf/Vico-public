# Vico Web-App – Benutzeranleitung

Anleitung für die Nutzung der Vico Web-App zur Wartungs- und Mängeldokumentation von Türen und Toren.

---

## 1. Anmeldung

- Öffnen Sie die Vico Web-App im Browser.
- Geben Sie Ihre E-Mail-Adresse und Ihr Passwort ein.
- Klicken Sie auf **Anmelden**.
- Bei vergessenem Passwort: **Passwort vergessen** nutzen – Sie erhalten einen Link per E-Mail.

Ohne Anmeldung werden Sie automatisch zur Login-Seite weitergeleitet.

---

## 2. Startseite (Dashboard)

Nach dem Login sehen Sie die Startseite mit:

- **Kalender** – geplante Aufträge
- **Fällige Wartungen** – Objekte mit überfälliger Wartung
- Schnellzugriffe auf Kunden, Suche, Auftrag und Scan

---

## 3. Kunden

### Kundenliste

- Unter **Kunden** sehen Sie alle Kunden.
- Klicken Sie auf einen Kunden, um die zugehörigen BVs und Objekte anzuzeigen.
- **Suche** – Filtert nach Name, Adresse, PLZ, Ort, E-Mail, Kontakt etc.

### Neuer Kunde

- Klicken Sie auf **+ Neu** → **Neuer Kunde**.
- Füllen Sie die Pflichtfelder aus (Name, Adresse, PLZ, Ort, Straße, Hausnummer).
- Speichern Sie mit **Speichern**.

### Kunde bearbeiten / löschen

- **Bearbeiten** – öffnet das Formular.
- **Löschen** – nur für Admins möglich.

---

## 4. BVs (Betriebsstätten)

- BVs sind unter Kunden ausklappbar.
- Klicken Sie auf einen Kunden, um die BVs zu sehen.

### Neues BV

- Kunden ausklappen, dann **+ Neu** → **Neues BV**.
- Alternativ: **BV anlegen** im ausgeklappten BV-Bereich.

### BV bearbeiten / löschen

- **Bearbeiten** – öffnet das Formular.
- **Löschen** – nur für Admins möglich.

---

## 5. Objekte

- Objekte sind unter BVs ausklappbar.
- Klicken Sie auf einen Kunden und ein BV, um die Objekte zu sehen.

### Neues Objekt

- Kunden und BV ausklappen, dann **+ Neu** → **Neues Objekt**.

### Objekt bearbeiten

- **Bearbeiten** – öffnet ein Modal mit allen Objektfeldern.
- Felder: Name, interne ID, Tür Position, Etage, Raum, Art, Hersteller, Baujahr, Schließmittel, Feststellanlage, Rauchmelder, Fotos, Mängel, Bemerkungen, Wartungsintervall (Monate).

### Objekt löschen

- Nur für Admins möglich.

### QR-Code

- **QR-Code** – zeigt einen QR-Code für das Objekt.
- Kann per Bluetooth-Drucker gedruckt werden.
- **A4-Sammel-PDF** (wenn in der Lizenz aktiviert): In der Kundenliste **Türen/Tore ankreuzen**, Etikettgröße wählen und **PDF herunterladen** – mehrere QR-Etiketten auf A4 (HERMA-/Avery-nahe Rastergrößen).
- Beim Scannen wird direkt zur Objektansicht navigiert.

### Fotos

- Fotos können im Objekt-Formular hochgeladen werden.
- Klick auf ein Foto vergrößert es; erneuter Klick schließt die Ansicht.

---

## 6. Wartungsprotokolle

- Über **Wartung** bei einem Objekt gelangen Sie zu den Wartungsprotokollen.

### Neues Protokoll

1. Prüfgrund auswählen (z. B. „Jährliche Wartung“).
2. Herstellerwartung, Feststellanlage, Rauchmelder prüfen.
3. Mängel und Bemerkungen eintragen.
4. Fotos anlegen (optional).
5. Unterschrift erfassen.
6. Speichern.

### PDF-Export

- Protokoll als PDF exportieren.
- Optional per E-Mail versenden.

---

## 7. Suche

- Unter **Suche** können Sie nach Kunden, BVs und Objekten suchen.
- Mindestens 2 Zeichen eingeben.
- Ergebnis-Links führen zur jeweiligen Ansicht.

---

## 8. Auftrag

- **Auftrag** – neue Aufträge anlegen.
- **Kalender** – geplante Aufträge mit Datum und zugewiesener Person.

---

## 9. QR-Scan

- **Scan** – QR-Code scannen (Kamera oder Bilddatei).
- Gescannte Objekt-URLs führen direkt zur Kundenübersicht mit dem jeweiligen Objekt.

---

## 10. Einstellungen

- **Version** – aktuelle App-Version.
- **Rolle** – Ihre Benutzerrolle (Admin, Mitarbeiter, Operator, Leser).
- **Auf Updates prüfen** – prüft auf neue Versionen.
- **Synchronisation** – manuell synchronisieren oder Sync-Status testen.
- **Komponenten** (nur Admin) – Bereiche an- oder ausblenden.
- **Benutzerverwaltung** (nur Admin) – Benutzer und Rollen verwalten.

---

## 11. Profil

- **Profil** – eigene Daten anzeigen und bearbeiten.

---

## 12. Historie (nur Admin)

- **Historie** – Audit-Log aller Änderungen an Kunden, BVs, Objekten, Aufträgen, Wartungsprotokollen.

---

## 13. Rollen und Rechte

| Rolle      | Rechte                                                                 |
|-----------|-------------------------------------------------------------------------|
| **Admin** | Vollzugriff, Benutzerverwaltung, Historie, Löschen von Kunden/BVs/Objekten |
| **Mitarbeiter** | CRUD Stammdaten + Aufträge, kein Löschen von Kunden/BVs/Objekten, BV anlegen nur Admin |
| **Operator** | Nur Wartungsprotokolle schreiben, Stammdaten/Aufträge lesen |
| **Leser** | Nur lesen |
| **Demo** | Wie Mitarbeiter, aber nur eigene Demo-Daten; werden nach 24h gelöscht |

---

## 14. Offline & Sync

- Die App speichert Daten lokal für Offline-Nutzung.
- **Sync-Status:** Offline (rot), Bereit (grün), Synchronisiert (blau).
- **Jetzt synchronisieren** – in der App manuell synchronisieren.

---

## 15. Tipps

- **Menü** – über das Hamburger-Icon öffnen Sie die Navigation.
- **Update-Banner** – bei neuer Version erscheint ein Hinweis, die Seite neu zu laden.
- **Checklisten, Benutzeranleitung, Dokumentation** – im Lizenz-Admin unter Einstellungen verfügbar (Web-App-Test-Checkliste, Benutzeranleitung, Vico-Dokumentation PDF).
