/**
 * Inhalt für „Komponenten & Funktionen“ PDF.
 * Bei neuen Features hier ergänzen – entspricht docs/Komponenten-und-Funktionen.md
 */
export const komponentenPdfContent = `Vico – Komponenten und Funktionen

Stand: Wird bei jedem Abruf aus dieser Quelle generiert.
Bei neuen Features: admin/src/data/komponentenPdfContent.ts und docs/Komponenten-und-Funktionen.md ergänzen.

1. Haupt-App (Vico Web-App)

1.1 Startseite (Dashboard)
Route: /
Funktionen: Übersicht Aufträge, Wartungserinnerungen, Schnellzugriff auf Kunden/Objekte

1.2 Kunden
Route: /kunden, /kunden/:customerId/bvs, /kunden/:customerId/bvs/:bvId/objekte
Funktionen: Kunden CRUD, BVs (Gebäude/Standorte) verwalten, Objekte (Türen/Tore) verwalten, Adressfelder, Fotos, QR-Code-Druck (Bluetooth)

1.3 Wartungsprotokolle
Route: /kunden/.../objekte/:objectId/wartung
Funktionen: Prüfgrund, Herstellerwartung, Feststellanlage, Rauchmelder, Mängel, Fotos, Unterschriften, PDF-Export, E-Mail-Versand

1.4 Suche
Route: /suche
Funktionen: Globale Suche über Kunden, BVs, Objekte, Aufträge

1.5 Auftrag
Route: /auftrag, /auftrag/:orderId
Funktionen: Auftrag anlegen, Auftragsdetail mit Monteursbericht, Unterschriften, Completion-Formular

1.6 Scan
Route: /scan
Funktionen: QR-Code-Scan für Objekt-Navigation, Kamera-Zugriff

1.7 Import
Route: /import
Funktionen: CSV/Excel-Import für Kunden, BVs, Objekte mit Spalten-Mapping

1.8 Arbeitszeiterfassung
Route: /arbeitszeit
Funktionen: Start/Ende Arbeitszeit, Pausen (manuell/automatisch ArbZG §4), Tages-/Wochen-/Monatsansicht, Urlaubsanträge, Admin-Bearbeitung mit Grund, GPS-Ortung (mit Einwilligung), Standortabfrage-Einwilligung, Web-Push bei Standortanfrage

1.9 Info
Route: /info
Funktionen: App-Version, Lizenz-Status, Anleitung

1.10 Einstellungen
Route: /einstellungen
Funktionen: Komponenten ein-/ausblenden, Sync-Status, Lizenz-Aktivierung, GPS-/Standortabfrage-Einwilligung, Push-Benachrichtigungen, Stammdaten/Impressum (Admin), Teamleiter-Standortabfrage (Admin)

1.11 Benutzerverwaltung
Route: /benutzerverwaltung
Funktionen: Benutzer anlegen/bearbeiten, Rollen zuweisen, 2FA, Soll-Minuten (Admin)

1.12 Historie
Route: /historie
Funktionen: Audit-Log, Änderungsverlauf, Detailansicht pro Eintrag

1.13 Fehlerberichte
Route: /fehlerberichte
Funktionen: Automatisch erfasste Fehler (window.onerror, unhandledrejection, ErrorBoundary), Admin-Ansicht

1.14 Ladezeiten
Route: /ladezeiten
Funktionen: Performance-Monitoring, Sync- und Startseiten-Ladezeiten

1.15 Profil
Route: /profil
Funktionen: Profildaten anzeigen/bearbeiten, Passwort ändern, 2FA-Einstellungen

1.16 Aktivierung, Impressum, Datenschutz
Routen: /aktivierung, /impressum, /datenschutz
Funktionen: Lizenz-Aktivierung ohne Login, Impressum/Datenschutz (öffentlich)

2. Admin (Lizenzportal)

2.1 Mandanten
Route: /mandanten, /mandanten/neu, /mandanten/:id
Funktionen: Mandanten anlegen/bearbeiten, Stammdaten, Corporate Design, App-Domain, Lizenzzuordnung, Daten-Export bei Kündigung

2.2 Grenzüberschreitungen
Route: /grenzueberschreitungen
Funktionen: Grenzwarnungen (80 %/90 %/100 %), Meldungen pro Mandant, Filter

2.3 Lizenzmodelle
Route: /lizenzmodelle, /lizenzmodelle/neu, /lizenzmodelle/:id
Funktionen: Lizenzmodelle anlegen/bearbeiten, Features pro Modell (arbeitszeiterfassung, standortabfrage, etc.)

2.4 Einstellungen
Route: /einstellungen
Funktionen: Benutzeranleitung öffnen, Vico-Dokumentation (PDF), Web-App-Test-Checkliste, Komponenten & Funktionen (PDF)

3. Kundenportal

3.1 Berichte
Route: /berichte
Funktionen: Wartungsprotokolle der eigenen Kunden lesen, PDF-Download

3.2 Meine Daten
Route: /meine-daten
Funktionen: Portal-Benutzer-Daten, Magic-Link-Login

3.3 Impressum / Datenschutz
Routen: /impressum, /datenschutz
Funktionen: Öffentliche Seiten, Mandanten-spezifisch aus Lizenz-API

4. Arbeitszeitenportal

4.1 Übersicht
Route: /, /uebersicht
Funktionen: Wochenübersicht Zeiterfassung, Soll/Ist, Mitarbeiter-Standorte (Admin/Teamleiter)

4.2 Alle Zeiten
Route: /alle-zeiten
Funktionen: Alle Zeiteinträge, Filter (Zeitraum, Benutzer), Admin/Teamleiter

4.3 Urlaub
Route: /urlaub
Funktionen: Urlaubsanträge einsehen/genehmigen (Admin), eigene Anträge stellen

4.4 Log
Route: /log
Funktionen: Bearbeitungs-Log (Korrekturen, Gründe)

4.5 Stammdaten
Route: /stammdaten
Funktionen: Soll-Minuten pro Mitarbeiter setzen (Admin), Arbeitszeiten-Einstellungen

4.6 Standort
Route: /standort
Funktionen: Mitarbeiter mit Einwilligung anzeigen, Standort anfordern (löst RPC + Web-Push), Karte anzeigen

5. Edge Functions (Supabase)

5.1 refresh-holidays: Feiertage von feiertage-api.de laden, in public_holidays speichern
5.2 send-maintenance-report: Wartungsprotokoll-PDF per E-Mail versenden (Resend)
5.3 request-portal-magic-link: Magic-Link für Kundenportal generieren und versenden
5.4 invite-portal-user: Portal-Benutzer einladen
5.5 notify-portal-on-report: Kundenportal bei neuem Wartungsprotokoll benachrichtigen
5.6 cleanup-demo-data: Demo-Mandanten-Daten nach 24h löschen
5.7 send-standort-push: Web-Push-Benachrichtigung bei Standortanfrage an Mitarbeiter

6. Lizenzportal-API (Netlify / Supabase)

6.1 license: Lizenzstatus abfragen, Features, Grenzen, Impressum
6.2 limit-exceeded: Grenzüberschreitungen von Haupt-App/Kunden empfangen und speichern
6.3 update-impressum: Impressum-Stammdaten pro Mandant aktualisieren

7. Services und Kontexte (Haupt-App)

AuthContext: Login, Logout, Session, Rollenprüfung
LicenseContext: Lizenz-Status, Features, Grenzen, Design
SyncContext: Offline-Sync, Outbox, Sync-Status
ComponentSettingsContext: Komponenten ein-/ausblenden
dataService: CRUD Kunden, BVs, Objekte, Aufträge (mit Offline)
timeService: Zeiterfassung, Pausen, Soll/Ist
leaveService: Urlaubsanträge
locationService: Standort senden, Standortanfrage prüfen
pushService: Web-Push-Subscription, Benachrichtigungen
userService: Profile, GPS/Standortabfrage-Einwilligung
licensePortalApi: Lizenz-API-Aufrufe, Impressum`