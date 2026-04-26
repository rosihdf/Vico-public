# Punkt 8 von 10 – Frontend-Stabilität und Vereinheitlichung

## Status
In Arbeit

## Ziel
Große Frontend-Dateien schrittweise entlasten, ohne früh zentrale Geschäftslogik oder riskante Datenpfade zu zerreißen.

---

## Teilbereich 8.2 – Einstellungen.tsx

### Status
Sehr weit fortgeschritten

### Ziel
`src/Einstellungen.tsx` von einer großen Sammelkomponente zu einem klareren Compose-Layer umbauen.

### Bereits ausgelagert
- Import-Stammdaten
- Synchronisation
- Tür-/Schließmittel
- Dashboard-/Startseite
- Mandanten-Ping
- QR-Etikett-Preset
- E-Mail-Erinnerungen
- Digest-Admin
- Komponenten aktivieren/deaktivieren
- Standort-/GPS-Sektionen
- PDF-Briefbogen
- Stammdaten / Impressum
- Monteurbericht / Portal / Checklisten

### Vorgehensmuster
- Präsentationskomponenten ausgelagert
- State, Services, useEffect, Laden/Speichern und Fehlerpfade zunächst im Parent belassen
- keine Änderung an globalen APIs
- keine Änderung am Verhalten

### Ergebnis
- `Einstellungen.tsx` ist deutlich besser lesbar
- große Settings-Blöcke sind klarer getrennt
- riskante Integrationslogik wurde bewusst nicht früh neu verteilt

### Noch bewusst im Parent belassen
- Querschnittslogik rund um Profil, Sichtbarkeitsflags und zentrale Handler
- Lizenz-/Feature-Kopplung
- Save-/Load-Logik der komplexeren Settings-Blöcke

### Offene Risiken / spätere Themen
- Parent-Komponente enthält weiter viel Orchestrierung
- spätere Hook-Bildung nur nach gezielter Review
- kein vorschnelles Zusammenziehen in einen Mega-Hook

---

## Teilbereich 8.3 – Kunden.tsx

### Status
Gut fortgeschritten

### Ziel
`src/Kunden.tsx` schrittweise modularisieren, ohne die riskantesten Knoten zuerst anzufassen.

### Bereits ausgelagert
- Lizenz-Nutzungsbanner
- Filterpanel
- Archiv-Sektion
- QR-Batch-Leiste
- Duplikat-Dialog
- Filter-/Ableitungslogik (`useKundenListFilters`)
- Kunden-Formular-Modal
- BV-Formular-Modal
- Tür-/Tor-Zeile
- BV-Kopf
- Confirm-/Dialog-Bereich bereinigt
- Kopfzeile / Toolbar

### Vorgehensmuster
- zuerst kleine UI-Blöcke
- dann Modale
- dann wiederholte Zeilen-/Header-Komponenten
- Logik, Services, Navigation und kritische Handler im Parent belassen

### Ergebnis
- `Kunden.tsx` ist deutlich modularer
- sichere Schnitte mit wenig Verhaltensrisiko wurden zuerst umgesetzt
- Hauptliste ist strukturell besser vorbereitet für spätere Schritte

### Noch bewusst im Parent belassen
- URL-/Deep-Link-Effekt
- große Orchestrierung der Hauptliste
- kritische Reload-/Refresh-Pfade
- heikle Wartungsvertrags-Refresh-Logik

### Offene Risiken / spätere Themen
- Deep-Link-Logik bleibt hochriskant
- Accordion-Hauptliste weiterhin komplex
- weitere Zerlegung nur mit gezielten manuellen Tests

---

## Übergreifende Erkenntnisse aus Punkt 8
- Sichere Refactors funktionieren gut als reine View-/Modal-/Panel-Schnitte
- State, Services und Seiteneffekte sollten erst spät und gezielt verlagert werden
- `dataService.ts` bleibt weiter die größte zentrale Architekturbaustelle
- große Screens sollten zuerst an ihren Rändern entlastet werden, nicht im Kern aufgerissen

---

## Noch offene große Baustellen in Punkt 8
- `src/lib/dataService.ts`
- `src/Auftragsdetail.tsx`
- Restkomplexität in `src/Kunden.tsx`
- `src/AuftragAnlegen.tsx`
- `admin/src/pages/MandantForm.tsx`

---

## Empfehlung für den nächsten Schritt
### Option A
`Kunden.tsx` erst einmal nicht weiter vertiefen, sondern zum nächsten Frontend-Schwerpunkt wechseln

### Option B
gezielt den nächsten riskanteren Block in `Kunden.tsx` planen

### Empfohlene Richtung
Erst kurz konsolidieren und dann entscheiden, ob als Nächstes
- `AuftragAnlegen.tsx`
- `MandantForm.tsx`
- oder später `dataService.ts`
angegangen wird.
