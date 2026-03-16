# Etikettendrucker – Planung QR-Code-Druck aus der App

**Stand:** Februar 2025  
**Ziel:** Mobile Lösung für den Druck von Objekt-QR-Codes unterwegs, direkt aus der Vico-App.

---

## 1. Anforderungen

| Anforderung | Beschreibung |
|-------------|--------------|
| **Mobil** | Einsatz unterwegs (Service, Montage), nicht nur am Schreibtisch |
| **Akku** | Integrierter Akku, Ladung per USB – kein Netzteil nötig |
| **Kleine Sticker** | Etiketten im Kleinformat (typisch 20–50 mm Breite) für Objekt-Aufkleber |
| **Bluetooth** | Verbindung zum Smartphone/Tablet ohne Kabel |
| **Android** | Kompatibel mit Android (Hauptzielplattform für Feldnutzer) |
| **Druck aus unserer App** | Direkt aus der Vico-App drucken, nicht nur über Hersteller-App |

**Technischer Kontext:** Die Vico-Haupt-App ist eine **reine Web-/PWA-App** (React + Vite + PWA). Direkter Bluetooth-Druck aus dem Browser ist eingeschränkt (Web Bluetooth API, Geräte-Support). Für echten „Druck aus der App“ ist daher eine **native Android-Schicht** (Wrapper oder Helper-App) nötig.

---

## 2. Modellvorschläge

Nur Drucker mit **offiziellem Android-SDK** oder gut dokumentiertem Druckprotokoll (ZPL/CPCL/ESC-POS) eignen sich für die Integration in eine eigene App. Reine Consumer-Geräte (nur Hersteller-App) scheiden für „Druck aus unserer App“ aus.

### 2.1 Primäre Empfehlung: Zebra ZQ220 / ZQ320

| Eigenschaft | Beschreibung |
|-------------|--------------|
| **Typ** | Mobile 2"-Thermodrucker (Belege/kleine Labels) |
| **Konnektivität** | Bluetooth, optional WLAN/USB (modellabhängig) |
| **Akku** | Wechselakku, für Außeneinsatz geeignet |
| **Labels** | Kleine Etiketten/Belege, QR-Codes problemlos |
| **Android** | **Zebra Link-OS SDK for Android** – Druck von Bitmaps, QR-Codes, ZPL/CPCL |
| **Dokumentation** | Sehr gut, viele Referenzen in Logistik/Service |

**Einsatz:** Industrietauglich, hohe Verbreitung, beste Wahl wenn Budget nicht die Hauptrolle spielt.

---

### 2.2 Alternative: Brother RJ-2150 (bzw. RJ-2050 / RJ-2140)

| Eigenschaft | Beschreibung |
|-------------|--------------|
| **Typ** | Robuster 2"-Mobildrucker (Belege/kleine Etiketten) |
| **Konnektivität** | Bluetooth, teils WLAN/USB |
| **Akku** | Integrierter Li-Ion-Akku |
| **Labels** | 2"-Papier/Etiketten, QR-Codes unterstützt |
| **Android** | **Brother Android SDK** (Java/Kotlin) inkl. Beispiele für QR/Barcode/Text |
| **Dokumentation** | SDK mit Beispielcode, gut für Integration |

**Einsatz:** Gute Balance aus Robustheit und Integration; oft etwas günstiger als Zebra.

---

### 2.3 Budget-Option: Bixolon SPP-R200III (oder Nachfolger)

| Eigenschaft | Beschreibung |
|-------------|--------------|
| **Typ** | Kompakter 2"-Mobildrucker, Gürtelclip |
| **Konnektivität** | Bluetooth, optional WLAN/USB |
| **Akku** | Integrierter Akku |
| **Labels** | Kleine Etiketten, QR/Barcode |
| **Android** | **Bixolon Android SDK** mit Druck-API und Beispielen |
| **Dokumentation** | SDK + ESC-POS-ähnliches Protokoll |

**Einsatz:** Etwas kompakter/günstiger, trotzdem gut integrierbar für Service/Feld.

---

### 2.4 Nicht empfohlen für App-Integration

- **Phomemo / Callstel / ähnliche Consumer-Drucker:** In der Regel nur über Hersteller-App nutzbar, kein offizielles SDK für eigene Apps. Für „Druck aus unserer App“ ungeeignet, sofern der Hersteller kein SDK bereitstellt.

---

## 3. Integrationsansatz (Web/PWA-App)

Da die Vico-App eine **Web-/PWA-App** ist, kann der Browser nicht zuverlässig direkt auf Bluetooth-Drucker zugreifen (Web Bluetooth ist limitiert und nicht von allen Druckern unterstützt). Daher:

### 3.1 Option A: Native Android-Wrapper (Capacitor / Cordova)

- **Idee:** Die bestehende React-App in einem **Capacitor-** (oder Cordova-)Projekt einbinden. Eine native Android-App lädt die Web-App im WebView und stellt über ein **Plugin** die Druckerfunktion bereit.
- **Ablauf:** Nutzer wählt in der Web-App „QR-Code drucken“ → Web-App ruft z. B. `Capacitor.Plugins.Printer.print({ qrPayload: url })` auf → Plugin verbindet per Bluetooth mit dem Drucker (SDK) und sendet den Druckjob.
- **Vorteil:** Eine Codebasis (Web), Druck nur auf Android über natives Plugin; gleiche App kann weiterhin im Browser laufen (ohne Druck).

### 3.2 Option B: Kleine Android-Helper-App

- **Idee:** Separates, schlankes Android-Projekt (z. B. Kotlin), das per **Intent** oder **Custom URL Scheme** von der PWA aufgerufen wird. Die PWA öffnet z. B. `vico-print://?qr=...` oder übergibt Daten; die Helper-App übernimmt Pairing und Druck.
- **Vorteil:** Kein Umbau der Web-App zu Capacitor; PWA bleibt reine PWA. Nachteil: Zwei getrennte Apps (PWA + Helper) müssen installiert sein.

### 3.3 Option C: PWA nur als „Generator“, Druck über Hersteller-App (Workaround)

- **Idee:** In der Vico-App den QR-Inhalt (URL/Objekt-ID) generieren und per **Share/Intent** oder **Download** (z. B. als Bild) an die Hersteller-App des Druckers übergeben. Nutzer druckt aus der Phomemo/Brother/Zebra-App.
- **Nachteil:** Kein „ein Klick in unserer App“; Abhängigkeit von Hersteller-App und manueller Schritt.

---

### 3.4 Wrapper vs. Helper-App – Erklärung

Beide Ansätze lösen dasselbe Problem: Die Vico-App ist eine Web-/PWA-App und kann im Browser nicht zuverlässig direkt auf Bluetooth-Drucker zugreifen. Dafür braucht ihr eine **native Android-Schicht**. Der Unterschied ist, **wo** die Web-App läuft und **wer** den Druck auslöst.

#### Wrapper („App-Hülle“)

- **Idee:** Die React-App läuft **in einer nativen Android-App** (z. B. WebView oder Capacitor). Die gesamte Oberfläche bleibt eure Web-App; das Gerät ist eine „echte“ Android-App.
- **Ablauf:** Nutzer öffnet die Vico-App (Android-App) → innen wird die Web-App geladen → bei „QR drucken“ ruft die Web-App eine Brücke auf (z. B. `window.VicoNative.printLabel(qrPayload)`) → die native Schicht (Java/Kotlin) spricht per SDK den Bluetooth-Drucker an und sendet den Druckjob.
- **Vorteile:** Eine App im Store / auf dem Gerät; ein Login, eine Oberfläche; dieselbe Brücke später für andere native Features nutzbar (Kamera, Dateien, Benachrichtigungen).
- **Nachteile:** Android-Projekt (und ggf. iOS) muss gepflegt werden (Build, Signing, Updates); etwas mehr Einstiegsaufwand (z. B. Capacitor einbinden).

#### Helper-App („Drucker-Helfer“)

- **Idee:** Die Vico-App bleibt **reine Web-App/PWA** (wird im Browser oder PWA-Client geöffnet). Zum Drucken wird eine **separate, kleine Android-App** gestartet, die nur Druckaufträge entgegennimmt und an den Drucker sendet.
- **Ablauf:** Nutzer arbeitet in der Vico-PWA im Browser → bei „QR-Etikett drucken“ öffnet die PWA einen speziellen Link (Custom URL Scheme oder Intent), z. B. `vico-print://?payload=...` → die Helper-App startet, empfängt die Daten, generiert den QR-Code, wählt den gekoppelten Drucker und druckt → Nutzer wechselt zurück zur PWA.
- **Vorteile:** Vico bleibt 100 % Web; kein eigenes Android-Projekt für die Haupt-App; die Helper-App ist klein und fokussiert (nur Drucken), einfacher zu warten.
- **Nachteile:** Zwei getrennte Apps aus Nutzersicht; Datenübergabe zwischen Browser und Helper-App ist begrenzt (URL-Länge, Intent-Support je nach Browser); nicht jeder Browser unterstützt Custom-URL-Schemes gleich gut.

#### Vergleich

| | **Wrapper** | **Helper-App** |
|--|-------------|-----------------|
| **Vico-App** | Läuft in nativer Hülle (eine installierte App) | Bleibt PWA im Browser |
| **Drucker-Anbindung** | In derselben App (Brücke/Plugin) | In separater kleiner App |
| **Nutzer-Erlebnis** | Eine App, nahtlos | Zwei Apps, Wechsel beim Drucken |
| **Aufwand** | Höher (native App bauen & pflegen) | Geringer (nur kleine Drucker-App) |
| **Datenübergabe** | Direkt (JavaScript → Native) | Über URL/Intent (Längen-/Browser-Limits) |

#### Empfehlung

- **Wrapper:** Wenn ihr ohnehin eine installierbare „Vico-App“ (z. B. Play Store) wollt und später weitere native Features (Kamera, Offline, Push) plant – dann ist der Wrapper langfristig sauberer und nutzerfreundlicher.
- **Helper-App:** Wenn Vico bewusst reine PWA bleiben soll und ihr nur für Techniker das Drucken braucht – dann reicht die Helper-App und spart Aufwand; Datenübergabe und Verhalten in verschiedenen Browsern sollten gezielt getestet werden.

---

## 4. Empfohlene Reihenfolge

1. **Drucker beschaffen:** Zebra ZQ220/ZQ320 oder Brother RJ-2150 (je nach Budget/Verfügbarkeit).
2. **Entscheidung Integrationsweg:** Option A (Capacitor + Plugin) wenn die App mittelfristig ohnehin als „native“ App vertrieben werden soll; Option B (Helper-App) wenn die App rein als PWA bleiben soll.
3. **Native Schicht umsetzen:** Android-Plugin bzw. Helper-App mit Hersteller-SDK (Zebra/Brother/Bixolon), Bluetooth-Pairing, Druckjob (QR als Bitmap oder ZPL/CPCL).
4. **Web-App anbinden:** In Vico z. B. Button „QR-Code drucken“ im Objekt-Kontext; Aufruf des Plugins bzw. der Helper-App mit Objekt-URL oder -ID.

---

## 5. Offene Punkte

- [ ] Finale Wahl des Druckermodells (Zebra vs. Brother vs. Bixolon) nach Beschaffung/Test.
- **Entscheidung:** Capacitor-Wrapper (Option A), da Capacitor bereits eingebunden; Option B nur bei bewusst reiner PWA. Siehe `docs/Entscheidungen-Offene-Punkte.md` §9.
- [ ] Definition des QR-Inhalts pro Objekt (z. B. vollständige Vico-URL vs. kurze Objekt-ID + Auflösung per Scan).
- [ ] iOS: Falls später gewünscht – gleiche Drucker oft auch mit iOS-SDK; dann entsprechendes Plugin/Wrapper für iOS.

---

*Dieses Dokument kann bei Beschaffung und Implementierung fortlaufend ergänzt werden.*
