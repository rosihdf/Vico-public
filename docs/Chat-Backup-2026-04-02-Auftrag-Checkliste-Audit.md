# Chat-Backup: Auftrag Mehrfach-Türen + Wartungscheckliste-Audit (2026-04-02)

## Zweck

- Inhaltlicher Fallback zur Session (kein 1:1-Rohlog des Cursor-Chats; der liegt bei Cursor intern in den Agent-Transkripten).
- Verweis für alle festgehaltenen Produkt- und Code-Entscheidungen: **`Vico.md`** Abschnitt **3** (*Aufträge & Monteursbericht*) und **11.15**.

## Nutzerwünsche (Kern)

1. **Mehrfachauswahl Türen bei Nicht-Wartung:** Klarstellung in der UI: organisatorisch ein Termin / ein Monteurbericht, **keine** automatische türweise Aufteilung wie bei der Wartung.
2. **Wartung „Trotzdem abschließen“:** Beim Abschluss trotz unvollständiger Checkliste **Audit** im Datensatz (Zeit, Nutzer, unvollständige `object_ids`) in `completion_extra`; bei normalem Abschluss Audit-Feld entfernen; **Infobox** am erledigten Auftrag.

## Umsetzung (Code)

| Bereich | Datei(en) |
|---------|-----------|
| Typ + Parser | `src/types/orderCompletionExtra.ts` – `WartungChecklisteAbschlussBypassV1`, `wartung_checkliste_abschluss_bypass`, `parseWartungChecklisteAbschlussBypass` |
| Persistenz & UI Detail | `src/Auftragsdetail.tsx` – `runCompleteOrder`, `setExtra` nach `persistCompletion`, gelbe Infobox |
| Auftrag anlegen | `src/AuftragAnlegen.tsx` – Hinweistexte unter Tür/Tor-Mehrfachauswahl |
| Datenbank | Keine Schema-Änderung; nur JSON in `order_completions.completion_extra` |

## Künftige Dokumentation (Vereinbarung)

Nach größeren Feature-Blöcken: **`Vico.md`** pflegen; bei längeren Chats optional weitere **`docs/Chat-Backup-YYYY-MM-DD-<thema>.md`** – siehe `.cursor/rules/vico-chat-und-doku.mdc`.
