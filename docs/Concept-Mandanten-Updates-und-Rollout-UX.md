# Konzept: Mandanten-Updates, Go-Live und nutzerfreundliche Update-UX

Ziel: Nach **Go-Live** (und bei neuen Builds) soll klar und zuverlässig sein, **wann** und **wie** die App neu lädt – ohne „tote“ Buttons, mit einheitlicher Sprache (**Aktualisieren** / **Später**).

**Admin / geführter Rollout (Vorwärts & Rollback):** siehe **`docs/Concept-Lizenzportal-Update-Assistent.md`**.

**Verwandte Dateien (Stand):**

- `shared/mandantenReleaseReloadBridge.ts` – Reload nach Zuweisung (PWA + immer `location.reload()`)
- `shared/MandantenReleaseRolloutRefreshBanner.tsx` – Zuweisung geändert (Go-Live / Rollback), schwebende Karte unten rechts
- `shared/MandantenReleaseHardReloadGate.tsx` – Vollflächiger Zwang bei `forceHardReload` am aktiven Release
- `shared/UpdateBanner.tsx` – neues **Build** auf dem Host (`version.json` vs. eingebaute Version), aktuell **oben** (amber)
- `src/components/PwaUpdatePrompt.tsx` – neuer **Service Worker** (`onNeedRefresh`), unten rechts

---

## 1. Problem „Neu laden ging nicht“ (technisch)

In der **Haupt-App** war `executeMandantenReleaseReload` an `registerSW(..., true)` gekoppelt. **Go-Live** ändert oft nur die **Lizenz-Zuweisung**, nicht zwingend einen **neuen Service Worker**. Dann endet `updateSW(true)` **ohne** Seiten-Reload → der Nutzer blieb auf der Seite.

**Lösung:** Nach dem optionalen PWA-Schritt immer **`window.location.reload()`** ausführen (wenn der PWA-Pfad schon reloadet, wird der zweite Aufruf nicht mehr wirksam).

---

## 2. Zwei Go-Live-Varianten (Produktwunsch)

| Variante | Nutzererfahrung | Technische Anknüpfung (Ist / Vorschlag) |
|----------|-----------------|----------------------------------------|
| **A – Zwang** | Update **ohne Rückfrage** (sofort oder nach sicherem Punkt) | Heute: **`force_hard_reload`** am **aktiven** Release → `MandantenReleaseHardReloadGate` (nur ein Button). **Erweiterung möglich:** bei gesetztem Flag **automatisch** `reload` sobald neue Zuweisung erkannt (siehe Rückfragen). |
| **B – Angebot** | Hinweis **unten rechts**, **Aktualisieren** / **Später** | Heute: Rollout-Banner nach Zuweisungsänderung (nach UX-Anpassung wie PwaUpdatePrompt). Optional: gleiches Muster für reines **Build-Update** (`UpdateBanner` von oben hierher ziehen). |

**Hinweis:** „Zwang“ bedeutet nicht zwingend „neuer Code ohne Deploy“: Ohne neues **CDN-Build** liefert Reload weiterhin dasselbe Bundle – dann stimmen vor allem **Lizenz-Metadaten** / **Anzeigeversion** (und ggf. SW-Cache-Verhalten).

---

## 3. Grobe UX-Zielarchitektur (Überarbeitung)

1. **Eine Familie von Hinweisen** (gleiche Position, ähnliche Buttons), Priorität z. B.:  
   Hard-Reload-Gate (Vollbild) > Rollout-Zuweisung (Karte) > PWA/SW-Update (Karte) > Build-Update aus `version.json` (Karte).
2. **Begriffe vereinheitlichen:** überall **„Aktualisieren“** und **„Später“** (bzw. beim Vollbild-Zwang nur **„Jetzt aktualisieren“**).
3. **Kein doppelter Widerspruch:** Wenn mehrere Quellen gleichzeitig feuern, nur **einen** kombinierten Hinweis oder klare Priorität (Konzept offen).
4. **Offline / halb-offline:** Was passiert, wenn nach „Später“ die App offline ist und später wieder online geht? (Erneuter Hinweis – ja, mit Drosselung?)

---

## 4. Rückfragen an Produkt / Betrieb

1. **Automatischer Reload (Variante A erweitert):** Soll bei Go-Live mit „Zwang“ die Seite **sofort** neu laden, sobald die Lizenz-API die neue Zuweisung liefert – auch mitten in einem ausgefüllten Formular? Oder erst nach **Navigation**, **Tab-Wechsel** oder **„Speichern“**?
2. **Trennung der Modi:** Reicht **`force_hard_reload`** am Release als **einziger** Schalter für „Zwang“, oder braucht ihr **zusätzlich** ein eigenes Flag nur „auto_reload_on_assign“ (ohne Vollbild-Modal)?
3. **UpdateBanner oben:** Soll das **Build-Update** (`version.json` neuer als Bundle) **dauerhaft** in die **untere Karte** wandern (wie PWA/Rollout), oder **oben** lassen für maximale Sichtbarkeit?
4. **PWA vs. Rollout:** Wenn **sowohl** neuer SW **als auch** neue LP-Zuweisung anliegen – ein gemeinsamer Text („Neue Version verfügbar“) oder zwei nacheinander?
5. **Portale (Kundenportal / Arbeitszeit):** Gleiche Karten-UX und dieselbe Reload-Bridge-Logik ausreichend, oder dort bewusst **weniger** (nur `location.reload`, kein SW)?
6. **„Später“ – wie lange schweigen?** Soll der Hinweis nach X Stunden **wieder** erscheinen, solange `releaseAssignmentUpdatedAt` noch nicht „bestätigt“ wurde?

---

## 5. Nächste Umsetzungsschritte (nach Freigabe)

- Prioritäten und Kombinationsregeln aus den Rückfragen festlegen.
- Optional: gemeinsame Komponente `FloatingAppUpdateCard` (Props: Variante, Text, Primär-/Sekundäraktion).
- `UpdateBanner` optional migrieren oder mit der Karte zusammenführen.
- Go-Live-UI im Lizenzportal: bei Release-Anlage **Modus** wählen (wenn nicht nur `force_hard_reload`): dokumentieren in `Vico.md` / Release-Editor-Hilfetext.

Dieses Dokument ist die **Diskussionsgrundlage**; die konkrete Priorisierung erfolgt nach euren Antworten zu Abschnitt 4.
