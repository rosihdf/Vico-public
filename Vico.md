# 📱 App: Vico Türen & Tore

## 🛠 Tech Stack

- **Web-App:** Vite + React + TypeScript (TailwindCSS)  
- **Mobile-App:** Expo + React Native (in `/mobile`)  
- **Backend / DB:** Supabase (Auth, Database, Storage)  
- **Hosting Web:** Netlify  
- **Plattformen:** iOS, Android, Browser (WebApp)

### Zwei Build-Ziele

1. **Web (Vite):** `npm run dev` – Entwicklungs-Server für Browser  
2. **Mobile (Expo):** `npm run mobile` – Expo-Dev-Server für iOS/Android/Web  
   - `npm run mobile:web` – Im Browser testen  
   - `npm run mobile:ios` – iOS-Simulator  
   - `npm run mobile:android` – Android-Emulator  
   - `npm run mobile:url` – Dev-URL anzeigen (wenn QR-Code im Terminal nicht erscheint)

**QR-Code nicht sichtbar?** `npm run mobile` zeigt die Dev-URL automatisch. Zusätzlich: `npm run mobile:url` – dann URL bei https://qr.expo.dev einfügen oder in Expo Go unter „Enter URL manually“ eingeben.  

---

# 🌐 Netlify Deployment – Schritt für Schritt

## Schritt 1: Git-Repository vorbereiten

1. Terminal im Projektordner öffnen.
2. Falls noch kein Git-Repo existiert:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
3. Neues Repository auf GitHub erstellen (https://github.com/new).
4. Lokales Repo verbinden und pushen:
   ```bash
   git remote add origin https://github.com/DEIN-USERNAME/vico-public.git
   git branch -M main
   git push -u origin main
   ```

---

## Schritt 2: Netlify-Account und Site erstellen

1. Zu **https://app.netlify.com** gehen.
2. Mit GitHub einloggen (falls noch nicht geschehen).
3. Auf **„Add new site“** → **„Import an existing project“** klicken.
4. **„Deploy with GitHub“** wählen.
5. GitHub-Zugriff autorisieren, falls gefragt.
6. Das **Vico-Repository** aus der Liste auswählen.
7. Auf **„Configure Netlify“** klicken.

---

## Schritt 3: Build-Einstellungen prüfen

Die Werte aus `netlify.toml` werden automatisch übernommen. Prüfen:

- **Branch to deploy:** `main` (oder dein Standard-Branch)
- **Build command:** `npm run build`
- **Publish directory:** `dist`

Falls abweichend: manuell anpassen. Dann **„Deploy site“** klicken.

---

## Schritt 4: Umgebungsvariablen setzen

1. Deine Site in Netlify öffnen (Dashboard → Site auswählen).
2. In der linken Seitenleiste: **„Site configuration“** oder **„Project configuration“** anklicken.
3. Darunter **„Environment variables“** wählen.
4. **„Add a variable“** oder **„Add environment variables“** → **„Add a single variable“** klicken.

   **Alternative Wege:** Oben in der Site: **„Site settings“** → **„Environment variables“** – oder im Tab **„Build & deploy“** → **„Environment“** → **„Environment variables“**.

5. Folgende Variablen hinzufügen:

   | Name | Wert |
   |------|------|
   | `VITE_SUPABASE_URL` | Deine Supabase-URL (z. B. aus `.env` oder Supabase Dashboard → Settings → API) |
   | `VITE_SUPABASE_ANON_KEY` | Dein Supabase Anon Key (Supabase Dashboard → Settings → API) |

6. **„Save“** speichern.
7. **„Trigger deploy“** → **„Deploy site“** ausführen, damit der Build mit den neuen Variablen neu läuft.

---

## Schritt 5: Supabase für die Netlify-URL konfigurieren

1. Netlify-Site-URL notieren (z. B. `https://vico-xyz.netlify.app`).
2. **Supabase Dashboard** öffnen → **Authentication** → **URL Configuration**.
3. Eintragen:
   - **Site URL:** `https://deine-site.netlify.app`
   - **Redirect URLs:** `https://deine-site.netlify.app/reset-password` hinzufügen (für Passwort vergessen).
4. **Save** klicken.

---

## Schritt 6: Testen

1. Netlify-Site im Browser öffnen.
2. Login testen.
3. „Passwort vergessen“ testen (Redirect-URL muss in Supabase hinterlegt sein).

---

## ✅ Deployment-Checkliste

| Aufgabe | Status |
|---------|--------|
| `netlify.toml` (Build, Redirects, Node 20) | ✅ Konfiguriert |
| Umgebungsvariablen in Netlify setzen | ✅ Erledigt |
| Supabase: Site URL + Redirect URLs | ✅ Erledigt |
| `.env` nicht committen | ✅ In `.gitignore` |

---

## 📋 Netlify: Was noch zu tun ist

### 1. Site mit GitHub verbinden ✅
- **Netlify** → Add new site → Import an existing project → Deploy with GitHub
- **Repository:** `rosihdf/Vico-public` auswählen
- **Deploy site** klicken

### 2. Umgebungsvariablen in Netlify eintragen ✅
- **Site configuration** → **Environment variables** → **Add a variable** → **Add a single variable**
- **Werte aus deiner lokalen `.env`** (nicht committen):

  | Key | Wert |
  |-----|------|
  | `VITE_SUPABASE_URL` | Deine Supabase-URL (aus `.env`) |
  | `VITE_SUPABASE_ANON_KEY` | Dein Anon Key (aus `.env`) |

- **Save** → **Trigger deploy** → **Deploy site** (damit der Build mit den Variablen neu läuft)

### 3. Supabase konfigurieren ✅
- **Netlify-URL** notieren (z. B. `https://vico-xyz.netlify.app`)
- **Supabase Dashboard** → **Authentication** → **URL Configuration**:
  - **Site URL:** z. B. `https://vico-xyz.netlify.app`
  - **Redirect URLs:** `https://vico-xyz.netlify.app/reset-password` hinzufügen
- **Save** klicken

### 4. Testen ✅
- Netlify-Site öffnen → Login → „Passwort vergessen“ testen

---

## 📱 Mobile-Version auf Netlify (zweite Site)

Die Mobile-App (Expo Web) kann als **separate Netlify-Site** aus demselben Repo deployed werden:

1. **Netlify** → **Add new site** → **Import an existing project** → **Deploy with GitHub**
2. **Repository:** `rosihdf/Vico-public` (dasselbe wie die Web-App)
3. **Build-Einstellungen anpassen:**
   - **Base directory:** `mobile`
   - **Build command:** `npm install && npm run build:web` (wird aus `mobile/netlify.toml` gelesen)
   - **Publish directory:** `dist`
4. **Umgebungsvariablen** (wie bei der Web-Site):
   - `EXPO_PUBLIC_SUPABASE_URL` = deine Supabase-URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = dein Anon Key
5. **Deploy site** klicken
6. **Supabase:** Die neue Mobile-URL in **Redirect URLs** hinzufügen (z. B. `https://vico-mobile-xyz.netlify.app/reset-password`)

---

## Spätere Updates

Bei jedem Push auf `main` baut Netlify automatisch neu:

```bash
git add .
git commit -m "Deine Änderung"
git push
```

### Release-Notes & Update-System

- **release-notes.json** im Projektroot: pro Version eine Liste von Änderungen
- **version.json** wird beim Build erzeugt (Web + Mobile) und enthält `version`, `buildTime`, `releaseNotes`
- **Web:** Update-Banner erscheint automatisch bei neuer Version; in Einstellungen „Auf Updates prüfen“ mit Release Notes
- **Mobile:** In Einstellungen „Auf Updates prüfen“ mit Release Notes
- Bei neuem Release: `package.json` (Web) und `mobile/package.json` + `mobile/app.json` Version erhöhen, `release-notes.json` ergänzen

---

# 🎯 Ziel der App

- Kunden, BV und Objekte verwalten  
- Wartungs- & Mängeldokumentation inkl. Fotos  
- QR-Code pro Objekt (Erstellen + Drucken via Bluetooth)  
- Offline arbeiten  
- Automatische Synchronisation bei Internet  
- Sync-Status Anzeige:
  - 🔴 Rot = Offline
  - 🟢 Grün = Ready
  - 🔵 Blau = Synchronisiert

---

# 👥 Rollen & Rechte

## Rollen

- **Admin**
- **Mitarbeiter**
- **Leser** (nur lesen)

## Rechte

### Admin
- Benutzerverwaltung
- Rechtevergabe
- Datenimport
- Vollzugriff auf alle Daten

### Mitarbeiter
- Kunden / BV / Objekte bearbeiten
- Wartungen & Fotos erfassen
- Aufträge bearbeiten
- Kein Benutzer-Management

### Leser
- Alle Daten lesen (Kunden, BV, Objekte, Aufträge, Wartungsprotokolle)
- Kein Anlegen, Bearbeiten oder Löschen

---

# 🧭 Navigation

## 🍔 Seitenmenü (Hamburger)

- Dashboard
- Kunden
- Suche
- Einstellungen
- Ausloggen

## 📌 Bottom Menü

- Start
- Scan (QR)
- (Optional z. B. Aufträge / Neu)
- Login / Logout
- Mein Profil

## Global sichtbar

- Logo im Header
- Sync-Status-Indikator

---

# 🔐 Login

- Benutzer (E-Mail oder Username)
- Passwort
- Optional: Passwort vergessen

---

# ⚙️ Einstellungen

- Benutzerverwaltung (nur Admin)
- App-Version
- Sync-Einstellungen (optional)

---

# 👤 Benutzerverwaltung (Admin)

- Neuen Benutzer anlegen
- Benutzer verwalten
- Benutzerrechte:
  - Admin
  - Mitarbeiter

---

# 🏢 Kundenverwaltung

## Funktionen

- Kundenliste
- Suche
- Kunde neu anlegen

## Kunde anlegen

- Name
- Straße
- PLZ
- Ort
- E-Mail
- Telefon
- Ansprechpartner
  - Name
  - E-Mail
  - Telefon
- Wartungsbericht per E-Mail (Toggle Ja/Nein)
- Wartungsbericht E-Mail-Adresse

---

# 🏬 BV-Verwaltung (pro Kunde)

## Funktionen

- BV-Liste
- Suche
- BV neu anlegen

## BV anlegen

- Name
- Straße
- PLZ
- Ort
- E-Mail
- Telefon
- Ansprechpartner
  - Name
  - E-Mail
  - Telefon
- Wartungsbericht per E-Mail (Toggle)
- Wartungsbericht E-Mail-Adresse
- Daten aus Kundenverwaltung übernehmen (Toggle)

---

# 🚪 Objekt (pro BV)

## Stammdaten

- Interne ID (nicht änderbar)
- Tür Position
- Interne Türnummer
- Etage
- Raum

## Art

- Tür (Checkbox)
- Sektionaltor (Checkbox)
- Schiebetor (Checkbox)
- Freitext

## Technische Daten

- Flügelanzahl
- Hersteller
- Baujahr

## Schließmittel

- Hersteller
- Typ

## Feststellanlage (Toggle Ja/Nein)

Wenn **Ja**:

- Hersteller
- Typ
- Zulassungsnummer
- Abnahme am

## Rauchmelder

- Anzahl
- Dynamische Felder:
  - RM1 Baujahr
  - RM2 Baujahr
  - RM3 Baujahr
  - usw.

## Weitere Angaben

- Panikfunktion
- Weiteres Zubehör
- Wartung nach Herstellerangaben durchgeführt (Toggle)
- Feststellanlage Wartung nach Herstellerangaben (nur sichtbar wenn vorhanden)

## Dokumentation

- Vorhandene Mängel (Textfeld)
- Checkliste Mängel
- Fotos hochladen
- Bemerkungen

---

# 🔍 QR-Code Funktion

## Scan

- QR-Code scannen
- Objekt direkt öffnen

## QR-Code erstellen

- QR-Code generieren
- Layout mit:
  - Logo
  - Kunde
  - BV
  - Objekt
  - Interne ID
- Druck via Bluetooth

---

# 🌐 Offline & Auto-Sync

## Offline

- Daten lokal speichern
- Änderungen in Outbox speichern
- Objekt-Fotos: Cache + Upload-Outbox (Base64), Sync beim nächsten Online
- Wartungs-Erinnerungen: Cache (RPC-Ergebnis)
- Status = 🔴 Rot

## Online

- Outbox an Server senden
- Änderungen vom Server abrufen
- Konfliktlösung: "Last Write Wins"
- Status:
  - 🟢 Grün = Keine offenen Änderungen
  - 🔵 Blau = Synchronisiert

---

# 🗄 Datenbank Struktur (Supabase)

## Tabellen

- profiles (User + Rolle)
- customers
- bvs (mit customer_id)
- objects (mit bv_id)
- object_smoke_detectors
- object_photos
- object_checklist_items
- optional:
  - orders
  - reminders
  - messages

## Storage

- Bucket: object-photos

---

# 💬 Message System

- Push-Nachrichten
- Erinnerungen (z. B. Wartung fällig)
- Interne Nachrichten (Messenger)

---

# 🚀 MVP Empfehlung

## MVP 1

- Login + Rollen
- Kunden → BV → Objekt CRUD
- QR-Scan
- Fotos
- Offline-Speicherung
- Auto-Sync
- Sync-Status Anzeige

## MVP 2

- QR-Druck
- Wartungsbericht als PDF per E-Mail
- Strukturierte Checkliste
- Datenimport (CSV/Excel)
- Erinnerungsfunktion
- Messenger

---

# 📂 Struktur

Kunde  
└── BV  
  └── Objekt  

---
# 📝 Erweiterung: Wartungsprotokoll

---

# 📌 Wartungsprotokoll (pro Objekt)

Das Wartungsprotokoll wird einem **Objekt** zugeordnet und dokumentiert jede durchgeführte Wartung.

Struktur:

Kunde  
└── BV  
  └── Objekt  
    └── Wartungsprotokolle  

---

# 🧾 Wartungsprotokoll – Übersicht

## Funktionen

- Liste aller Wartungen pro Objekt
- Suche / Filter (Datum, Mitarbeiter, Status)
- Neues Wartungsprotokoll anlegen
- PDF erstellen
- Per E-Mail versenden
- Unterschrift erfassen
- Fotos hinzufügen

---

# ➕ Neues Wartungsprotokoll anlegen

## Allgemeine Daten

- Datum der Wartung (automatisch + editierbar)
- Uhrzeit
- Mitarbeiter (automatisch aus Login)
- Prüfgrund:
  - Regelwartung
  - Reparatur
  - Nachprüfung
  - Sonstiges (Textfeld)

---

## 🔍 Prüfpunkte

### Wartung nach Herstellerangaben durchgeführt
- Toggle Ja/Nein

### Feststellanlage geprüft
- Toggle Ja/Nein
- Nur sichtbar wenn Feststellanlage vorhanden

### Rauchmelder geprüft
- Automatische Anzeige aller RM (RM1, RM2, …)
- Status pro Rauchmelder:
  - OK
  - Defekt
  - Ersetzt

---

## ⚠️ Mängel

- Neue Mängel festgestellt (Ja/Nein)
- Beschreibung (Textfeld)
- Dringlichkeit:
  - Niedrig
  - Mittel
  - Hoch
- Sofort behoben? (Toggle)
- Foto hinzufügen

---

## 📸 Fotos

- Mehrere Fotos möglich
- Lokal speichern (Offline)
- Automatische Synchronisierung

---

## 🖊 Unterschrift

- Techniker Unterschrift (Touchfeld)
- Kunde Unterschrift (Touchfeld)
- Optional: Name in Druckschrift

---

## 📧 Versand

Wenn im Kunden/BV aktiviert:

- Wartungsbericht per E-Mail senden (automatisch)
- Empfänger:
  - Hinterlegte Wartungsbericht E-Mail
  - Optional weitere E-Mail-Adresse

---

# 📄 PDF Wartungsbericht

Inhalt:

- Logo
- Kundendaten
- BV-Daten
- Objektdaten
- Prüfergebnis
- Mängelliste
- Fotos
- Unterschriften
- Datum & Uhrzeit

PDF wird:
- Lokal erzeugt
- In Supabase Storage gespeichert
- Optional per E-Mail versendet

---

# 🗄 Datenbank Erweiterung (Supabase)

Neue Tabellen:

## maintenance_reports
- id (UUID)
- object_id
- created_at
- maintenance_date
- technician_id
- reason
- manufacturer_maintenance_done (boolean)
- deficiencies_found (boolean)
- deficiency_description
- urgency
- fixed_immediately (boolean)
- customer_signature_path
- technician_signature_path
- pdf_path
- synced (boolean)

---

## maintenance_report_photos
- id
- report_id
- storage_path
- caption
- created_at

---

## maintenance_report_smoke_detectors
- id
- report_id
- smoke_detector_label (RM1, RM2…)
- status (OK / Defekt / Ersetzt)

---

# 🔔 Erweiterung Erinnerungsfunktion

Pro Objekt speicherbar:

- Wartungsintervall (z. B. 12 Monate)
- Letzte Wartung
- Nächste Wartung automatisch berechnen
- Push-Benachrichtigung bei Fälligkeit

---

# 🌐 Offline Verhalten

- **Kunden, BVs, Objekte:** Lesen, Anlegen, Bearbeiten, Löschen (Cache + Outbox)
- **Wartungsprotokolle:** Lesen (Cache), Anlegen offline (Outbox), Rauchmelder inklusive
- **Suche:** Durchsuchen von Kunden/BVs/Objekten aus Cache
- **Sync:** Änderungen werden bei nächster Verbindung automatisch hochgeladen
- Sync Status:
  - 🔴 Offline
  - 🟢 Bereit
  - 🔵 Synchronisiert

---

# 📧 E-Mail-Versand (Wartungsprotokoll)

Für den E-Mail-Versand wird eine Supabase Edge Function und Resend genutzt:

1. **Resend-Account:** https://resend.com – API Key erstellen
2. **Supabase Secrets setzen:** Project Settings → Edge Functions → Secrets
   - `RESEND_API_KEY`: API Key von Resend
   - `RESEND_FROM` (optional): Absender, z. B. `Vico <info@ihredomain.de>`
3. **Edge Function deployen:**
   ```bash
   supabase functions deploy send-maintenance-report
   ```
4. **E-Mail-Adresse:** Unter Kunde oder BV muss „E-Mail für Wartungsprotokoll“ ausgefüllt sein.

---

# 🔑 Passwort vergessen

1. **Login:** Link „Passwort vergessen?“ → E-Mail eingeben → Supabase sendet Reset-Link.
2. **Redirect URLs:** In Supabase Dashboard → Authentication → URL Configuration:
   - **Site URL:** z. B. `https://ihredomain.de`
   - **Redirect URLs:** z. B. `https://ihredomain.de/reset-password` und `vico://reset-password`
3. **Mobile Deep Link:** Das Schema `vico` ist in `app.json` hinterlegt. Der Link aus der E-Mail führt zu `vico://reset-password` und öffnet die App.

---

# 🚀 Erweiterung MVP Plan

## MVP 2 Ergänzung

- Wartungsprotokoll erstellen
- PDF Export
- E-Mail Versand
- Unterschrift
- Erinnerungsfunktion


Rechteverwaltung für untergeordnete rollen 
Monteuerbericht
Wartungsberichte im Archiv ablegen, Kundenstruktur
Kundenportal für wartungsberichte 



