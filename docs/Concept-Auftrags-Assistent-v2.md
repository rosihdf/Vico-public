# Konzept: Auftrags-Assistent v2 (Checkliste bis Monteursbericht)

Stand: konsolidierte Final-Spezifikation aus den abgestimmten Entscheidungen.

## 1. Zielbild

Der Auftrags-Assistent führt Prüfer und Monteure mit minimalem Scrollen durch den kompletten Ablauf von der Checkliste bis zum Monteursbericht. Es wird immer nur die aktuell notwendige Aktion gezeigt. Entscheidungen und Ausnahmen bleiben nachvollziehbar (Audit-fähig).

## 2. Einstieg & Aktivierung

- In der Auftragsliste gibt es pro Auftrag zusätzlich den Button **`Assistent (beta)`**.
- Sichtbarkeit des Buttons wird über LP-Feature **`checklist_assistant`** gesteuert.
- Klick auf **`Assistent (beta)`** öffnet zunächst einen Dialog:
  1. **Auftrag ausführen**
  2. **Auftrag bearbeiten** (führt vorübergehend auf bestehendes `Auftrag öffnen`)

## 3. Modusauswahl zu Beginn

Beim Start von **Auftrag ausführen**:
- zuerst Modusfrage:
  - **Assistent**
  - **Klassische Ansicht**
- danach läuft der gewählte Modus durchgängig weiter.
- spätere Steuerung pro Mandant über Policy vorbereitet.

### 3.1 Modus-Policy (vorbereitet)

Unterstützte Policies:
- `selectable`
- `assistant_only`
- `classic_only`

Technisch zentral vorbereitet in `resolveChecklistModePolicy(...)`.

## 4. Mehrtürige Aufträge

- Standard: automatische Auswahl der **nächsten offenen Tür**.
- Zusätzlich Option **Tür wechseln**.
- Fortschritt immer sichtbar:
  - `X von Y geprüft`
  - `Z offen`
- QR-Scan ist vorgesehen, damit Prüfer Türen direkt ansteuern können.

## 5. QR-Scan & vergessene Tür

Wenn per QR eine Tür gefunden wird, die nicht im Auftrag enthalten ist:
- Rückfrage: **„Zum Auftrag hinzufügen?“**
- Bei Bestätigung wird die Tür in den laufenden Auftrag übernommen (mit Audit-Eintrag).

## 6. Checklisten-Flow (Assistent)

- Wizard-ähnliche Fortschrittsanzeige wie im LP (Neuer Mandant).
- Punkt-für-Punkt-Abarbeitung:
  - pro Schritt nur ein Punkt
  - Vorheriger/Nächster Punkt
  - „Nächster Punkt“ springt intelligent zum nächsten offenen Punkt
- Umschaltung Detail/Kompakt zu Testzwecken während des Flows möglich.
- Nach Checkliste: optionale Übersicht (Read-only) mit „Zur Stelle springen“.
- Danach Prüfer-Unterschrift als eigener Schritt.

## 7. Abschluss trotz offener Türen

- Standard: Abschluss trotz offener Türen ist mandantensteuerbar, Default aktuell **erlaubt mit Bestätigung**.
- Wenn mit offenen Türen abgeschlossen wird:
  - Folgeauftrag wird **automatisch sofort** erzeugt.

## 8. Folgeauftrag-Regeln

Folgeauftrag übernimmt:
- Kunde, BV, relevante Auftragsdaten,
- nur offene Türen,
- Referenz auf Ursprungsauftrag,
- Kennzeichen „aus Assistent erzeugt“.

Zusammenführung Folgeauftrag ↔ Ursprungsauftrag:
- möglich, aber nicht zwingend,
- nur wenn **nicht abgerechnet**.

## 9. Abrechnungssteuerung (zukunftssicher)

Zielmodell:
- `billing_status`: `open | prepared | billed | cancelled`

Übergang bis Buchhaltungs-Schnittstelle:
- Hybrid-Regel:
  - wenn `billing_status` vorhanden, dann führend,
  - sonst Fallback auf `order.status`.

Später:
- Buchhaltungsschnittstelle setzt auf `billed`, sobald Rechnung erstellt wurde.

## 10. Monteursbericht-Flow (adaptiv)

- Schrittweise Führung, adaptiv 2- oder 3-stufig (je nach Komplexität).
- Vorbelegung:
  - Kunde/BV,
  - bei Prüfauftrag relevante Türdaten + Prüfstatus.
- Abschluss mit finaler Unterschrift.
- Hinweistext bei vorbefüllten Schritten:
  - **„Automatisch ausgefüllt – weiter“**

## 11. Zusatzanforderungen für hohe Benutzerfreundlichkeit

### 11.1 Resume / Fortsetzen
- Beim Wiedereinstieg Dialog:
  - „Fortsetzen bei Schritt X“
  - „Neu starten bei Schritt 1“

### 11.2 Auto-Save-Status
- Kleines Status-Badge (dezent, dauerhaft sichtbar):
  - `Gespeichert`
  - `Entwurf lokal`
  - `Wird synchronisiert`
  - `Fehler`

### 11.3 Parallelbearbeitung
- Weiche Warnung + Konfliktdialog beim Speichern (kein blindes Überschreiben).

### 11.4 Restaufgaben-Hinweis
- Adaptiv:
  - kompakt während des Flows,
  - detailliert vor Abschluss.

### 11.5 Quick Actions pro Punkt
- Direkt im Punkt erreichbar:
  - `Mangel`
  - `Hinweis`
  - `Foto`

### 11.6 Rollenvereinfachung
- Leicht reduzierte UI für Monteur (gleiche Funktion, weniger Meta-Infos).

### 11.7 Aktivitäten-Panel
- Kleines Aktivitäten-Panel statt Vollprotokoll im Assistenten (zusätzlich internes Audit vollständig).

## 12. Offene Punkte (bewusst später)

- Feinregeln „Erbrachte Leistungen“ (Pflicht/optional) bleiben vorerst konfigurierbar nach Bedarf.
- Mandantenweite Steuerung dieser Validierungsregeln erfolgt später im LP.
- Genaues Mapping der Buchhaltungs-Schnittstelle auf `billing_status` wird separat spezifiziert.

## 13. Nächste Implementierungsblöcke

1. Neue Route für den Assistenten (`/auftraege/:id/assistent`) inkl. Startdialog.
2. Mehrtür/QR-Entry + Tür hinzufügen Dialog.
3. Folgeauftrag-Automatik bei Teilabschluss.
4. `billing_status` + Hybrid-Übergangslogik.
5. Adaptive Monteursbericht-Schritte inkl. „Automatisch ausgefüllt – weiter“.
6. Resume, Auto-Save-Badge, Konfliktdialog, Restaufgabenpanel.

