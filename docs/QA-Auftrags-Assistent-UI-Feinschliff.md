# QA-Protokoll: Auftrags-Assistent UI-Feinschliff (mobil + dark)

Datum: 2026-04-14

## Ziel

Gezielter Feinschliff der neuen Assistenten-Oberfläche mit Fokus auf:
- mobile Bedienbarkeit,
- Lesbarkeit in dunklem Theme,
- klare Status-/Action-Darstellung ohne Layout-Brüche.

## Umgesetzte UI-Verbesserungen

1. **Progress-Zeile robuster auf schmalen Displays**
- Fortschrittstext in der Assistenten-Karte kann umbrechen (`break-words`), damit keine Überläufe bei kleinen Breiten entstehen.

2. **Bessere Bedienbarkeit der Punkt-Navigation mobil**
- Steuerleisten „Vorheriger Punkt / Nächster Punkt“ in Tür- und Feststell-Schritt sind jetzt mobilfreundlich als Spalte + Wrap ausgelegt (`flex-col` auf klein, `sm:flex-row` auf größer).
- Dadurch kein Quetschen/Abschneiden bei schmalen Geräten.

3. **Action-Buttons mit klareren ARIA-Labels**
- Mehrtür-Aktionen erhielten explizite `aria-label`s:
  - „Nächste offene Tür auswählen“
  - „QR-Scan öffnen“

4. **Dark-Theme-Kontrast für `Assistent (beta)` verbessert**
- In der Auftragsliste wurde der Button im Dark Mode kontrastreicher abgestimmt (`text-sky-200`, `border-sky-600`, `hover:bg-sky-900/40`).

## Prüfprotokoll

Nach Feinschliff vollständig erneut ausgeführt:

- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:run` ✅
  - 16 Test-Dateien
  - 133 Tests
  - alle bestanden

## Ergebnis

UI ist auf mobilen Breiten und im Dark Theme stabiler/lesbarer, ohne funktionale Regressionen im bestehenden Assistenten-Flow.

