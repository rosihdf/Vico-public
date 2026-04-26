# QA-Protokoll: Auftrags-Assistent Block 1-7

Datum: 2026-04-14

## Block 1 – Einstieg, Button, Routing, Startdialog

Umfang:
- Route ` /auftrag/:orderId/assistent ` ergänzt.
- Button `Assistent (beta)` in Auftragsliste (gesteuert über LP-Feature + Komponentensetting).
- Startdialog in Auftragsdetail mit Optionen:
  - Auftrag ausführen
  - Auftrag bearbeiten

Prüfung:
- `npm run lint` ✅
- `npm run build` ✅

## Block 2 – Assistenten-Flow/UI

Umfang:
- Fortschrittsbalken (Prozent + Schrittzähler) in Assistentenansicht.
- Kompakte Auftragsdaten-Kacheln im Flow.
- Save-Status-Badge (`Gespeichert`, `Entwurf lokal`, `Wird synchronisiert`, `Fehler`).

Prüfung:
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:run` ✅

## Block 3 – Mehrtür/QR/Tür ergänzen

Umfang:
- Mehrtür-Fortschritt (`X/Y geprüft`, `offen`).
- Aktion „Nächste offene Tür“.
- Aktion „QR-Scan“ (Sprung auf Scan-Seite).
- Dialog „Tür hinzufügen“ (gleicher Kunde + BV, Persistenz via `updateOrder`).

Prüfung:
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:run` ✅

## Block 4 – Teilabschluss/Folgeauftrag

Umfang:
- Bestehende Folgeauftrag-Logik beibehalten und mit neuem Assistenz-Einstieg kompatibel geprüft.

Prüfung:
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:run` ✅

## Block 5 – Billing-Zielbild (Hybrid-Fallback)

Umfang:
- `OrderBillingStatus` ergänzt.
- Hilfslogik `resolveOrderBillingStatus()` eingeführt (Fallback auf `order.status`, solange `billing_status` nicht führend gepflegt wird).
- Anzeige „Abrechnung“ im Auftragsdetail.

Prüfung:
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:run` ✅

## Block 6 – Monteursbericht adaptive Führung

Umfang:
- Hinweistext bei vorbefüllten Daten im Assistenten:
  - „Automatisch ausgefüllt - weiter“

Prüfung:
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:run` ✅

## Block 7 – UX-Härtung (Resume/Autosave/Grundkonflikt)

Umfang:
- Resume-Dialog: „Fortsetzen“ oder „Neu starten“ bei vorhandenem Zwischenstand.
- Save-Badge dauerhaft sichtbar in Assistentenansicht.
- Bestehende Konflikt-/Follow-up-Dialoge bleiben aktiv.

Prüfung:
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:run` ✅

## Ergebnis

- Lint: erfolgreich
- Build: erfolgreich
- Unit-Tests: 16 Dateien, 133 Tests, alle erfolgreich

