# Optimierungsplan Vico

**Stand:** Februar 2025  
**Ziel:** Konkrete Optimierungsvorschläge mit Wirkung und möglichen negativen Auswirkungen.

---

## 1. Übersicht

| Bereich | Priorität | Aufwand | Nutzen | Risiko |
|--------|-----------|---------|--------|--------|
| Data-Layer: explizite Spalten statt `select('*')` | Hoch | Mittel | Weniger Payload, schnellere Antworten | Neue Spalten müssen nachgezogen werden |
| Sync: schlankere Pulls | Hoch | Mittel | Weniger Daten pro Sync | Cache muss alle genutzten Felder enthalten |
| Suche: schlankere/ server-seitige Abfragen | Mittel | Mittel–Hoch | Schnellerer Erstlauf, weniger Speicher | UX/Offline-Verhalten prüfen |
| Vite: Chunk-Strategie | Niedrig | Gering | Kleinere Initial-Bundles | Mehr Requests bei Navigation |
| Historie: Paginierung | Niedrig | Gering | Skalierbar bei vielen Einträgen | Bereits Limit 200 |
| Scan: Abfragen zusammenführen | Niedrig | Gering | Weniger Roundtrips | Keine nennenswerten |
| Caching/Debounce | Situativ | Gering | Weniger Doppel-Requests | Veraltete Daten wenn TTL zu lang |

---

## 2. Data-Layer (dataService.ts)

### 2.1 Wo es effizienter wird

- **customers, bvs, objects, orders:** Aktuell überall `select('*')`. Reduktion auf die tatsächlich in der App genutzten Spalten reduziert Netzwerk-Payload und JSON-Parsing.
- **maintenance_reports, object_photos, object_documents, maintenance_report_photos:** Gleichfalls `select('*')` – oft werden nicht alle Spalten (z. B. große Texte/Binaries) benötigt.
- **customer_portal_users:** Falls nur für Prüfung/Liste genutzt, reicht ein schlankes Select.

### 2.2 Konkrete Vorschläge

1. **Pro Tabelle eine konstante Spaltenliste** (z. B. `CUSTOMER_SELECT_COLUMNS`) und überall diese Liste statt `'*'` nutzen. Bei neuen Features neue Spalte in die Konstante aufnehmen.
2. **fetchCustomerCount** nutzt bereits Count – beibehalten.
3. **fetchMaintenanceReminders / fetchAuditLog** nutzen RPCs – beibehalten; RPCs ggf. in DB optimieren (Indizes, Limit).

### 2.3 Mögliche negative Auswirkungen

- **Vergessene Spalte:** Wird eine neue Spalte in der UI genutzt, aber nicht in die Select-Liste aufgenommen, fehlt sie (undefined). Abhilfe: TypeScript-Typen strikt aus den gleichen Spalten ableiten oder zentral eine „single source of truth“ für Spalten pro Tabelle.
- **Offline-Cache:** Cache-Struktur (offlineStorage) muss weiterhin alle Felder enthalten, die die App für Offline-Anzeige und -Bearbeitung braucht. Beim Reduzieren der Select-Spalten prüfen: Reicht das für Formulare, Listen und Merge-Logik (z. B. in syncService)?

---

## 3. Sync (syncService.ts)

### 3.1 Wo es effizienter wird

- **pullFromServer():** Lädt sieben Tabellen mit `select('*')` (customers, bvs, objects, orders, object_photos, object_documents, maintenance_report_photos) plus component_settings (bereits schlank), profiles (bereits explizit), Lizenz-RPC, audit_log-RPC, Reminders-RPC.
- Weniger Spalten pro Tabelle = weniger Daten pro Sync, kürzere Ladezeit und weniger Speicher im Offline-Cache.

### 3.2 Konkrete Vorschläge

1. **Gleiche Spaltenlisten wie im dataService** in pullFromServer verwenden (oder zentrale Konstanten aus einem Modul wie `dataServiceColumns.ts`), damit Cache und API konsistent sind.
2. **Optional: Timeout** für pullFromServer (z. B. AbortController mit 30–60 s), damit die App bei sehr langsamen Netzen nicht ewig hängt; bei Timeout Offline-Cache unverändert lassen und Fehler anzeigen.
3. **Reihenfolge beibehalten:** Zuerst Push (Outbox), dann Pull – bereits sinnvoll.

### 3.3 Mögliche negative Auswirkungen

- **Cache unvollständig:** Wenn eine Spalte im Pull fehlt, die die App später (z. B. in Formularen oder in mergeCacheWithOutbox) erwartet, können Anzeige- oder Merge-Fehler entstehen. Nur Spalten weglassen, die nirgends genutzt werden.
- **Timeout:** Bei Timeout könnte der Nutzer denken, Sync wäre fehlgeschlagen, obwohl nur das Netz langsam ist – klare Fehlermeldung und „Erneut versuchen“ anbieten.

---

## 4. Suche (Suche.tsx) / Startseite / Kunden

### 4.1 Wo es effizienter wird

- **Suche:** Beim Mount werden `fetchCustomers()`, `fetchAllBvs()`, `fetchAllObjects()` aufgerufen – drei volle Tabellen für clientseitige Suche. Bei vielen Kunden/BVs/Objekten: hoher Erst-Ladeaufwand und Speicher.
- **Startseite:** Lädt ebenfalls `fetchCustomers()`, `fetchAllBvs()`, plus `fetchMaintenanceReminders` – ähnliches Bild.
- **Kunden:** Lädt beim Start alle Kunden + Reminders; BVs/Objekte on-demand pro aufgeklapptem Kunden/BV – gut. Wenn aber viele Kunden da sind, ist der erste Load trotzdem schwer.

### 4.2 Konkrete Vorschläge

1. **Suche – Option A (Quick-Win):** Spalten in dataService für customers/bvs/objects ohnehin reduzieren (siehe Abschnitt 2); dann profitiert auch die Suche ohne weitere Änderung. **Entscheidung:** Zuerst Option A; Option B bei Bedarf später. Siehe `docs/Entscheidungen-Offene-Punkte.md` §10.
2. **Suche – Option B (größerer Schritt):** Server-seitige Suche (Supabase Full-Text oder `ilike` auf einem Such-Endpoint/RPC), der nur Treffer zurückgibt. Dann keine vollen Tabellen mehr beim Öffnen der Suche; dafür Such-UI an „Ergebnisse laden“ anpassen und ggf. Offline-Fallback (z. B. gecachte letzte Ergebnisse oder Hinweis „Suche nur online“).
3. **Startseite:** Wenn Dashboard nur Aggregationen/Listen-Ausschnitte braucht, RPC oder schlankere Abfragen (z. B. nur IDs/ Namen für Dropdowns) prüfen; Reminders-RPC ist bereits sinnvoll.
4. **Kunden:** Lazy-Loading der BVs/Objekte ist bereits gut; Optimierung vor allem über schlankere customer-Liste (Spalten) und ggf. Paginierung, wenn Kundenanzahl sehr groß wird.

### 4.3 Mögliche negative Auswirkungen

- **Server-seitige Suche:** Ohne Netz keine Suche, es sei denn, man baut einen Offline-Fallback (z. B. lokaler Index oder begrenzter Cache) – erhöhter Implementierungsaufwand.
- **Paginierung bei Kunden:** UX-Anpassung nötig („Mehr laden“, unendliches Scroll oder Seiten); Filter/Sortierung muss mit Paginierung zusammenspielen.

---

## 5. Historie (Historie.tsx / fetchAuditLog)

### 5.1 Aktuell

- `fetchAuditLog(limit = 200)` nutzt RPC `get_audit_log` mit Limit – bereits begrenzt.

### 5.2 Vorschläge

1. **Limit beibehalten oder konfigurierbar** machen (z. B. 100/200/500), wenn Nutzer „mehr Historie“ wünschen.
2. **Paginierung:** RPC um `offset`/`limit` erweitern und in der Historie „Ältere laden“ anbieten – skaliert besser bei vielen Einträgen.

### 5.3 Mögliche negative Auswirkungen

- Paginierung: Zusätzliche Klicks/UI; Konsistenz (neue Einträge zwischen Seiten) – akzeptabel für Audit-Log.

---

## 6. Vite / Bundle (vite.config.ts, App.tsx)

### 6.1 Aktuell

- Routen per `lazy()` geladen, einheitlicher Suspense-Fallback – gut.
- Keine manuellen Rollup-Chunks konfiguriert.

### 6.2 Vorschläge

1. **Gemeinsame Chunks:** z. B. `manualChunks` in Vite so setzen, dass große Bibliotheken (z. B. Supabase, React-Router) in eigenen Chunks landen – kleinere Initial-Bundle, besseres Caching bei Updates.
2. **Weitere Lazy-Imports prüfen:** Schon z. B. ObjectQRCodeModal in Kunden lazy – andere schwere Modals/Seiten analog prüfen.

### 6.3 Mögliche negative Auswirkungen

- Mehr Chunk-Requests beim ersten Load oder bei Navigation – in der Regel akzeptabel, da parallel geladen und gecacht.
- Zu viele kleine Chunks vermeiden (Balance zwischen Initial-Größe und Anzahl der Requests).

---

## 7. Scan (Scan.tsx)

### 7.1 Wo es effizienter wird

- Bei UUID: eine Abfrage `objects` (id), bei Fehlschlag Abfrage nach `internal_id`, dann `bvs` für `customer_id`. Kein offensichtliches Doppel pro Pfad; bei internal_id-Fall sind es zwei Object-Abfragen (id, dann internal_id) plus eine BV-Abfrage.
- **Mögliche Optimierung:** Ein RPC `resolve_object_to_navigation(object_or_internal_id)` der einmalig id, bv_id, customer_id zurückgibt – ein Roundtrip statt mehrerer.

### 7.2 Mögliche negative Auswirkungen

- Neuer RPC: Wartungsaufwand in der DB; nur lohnenswert, wenn Scan häufig genutzt wird und Latenz auffällt.

---

## 8. Caching & Debounce

### 8.1 Situative Ideen

- **Debounce** bei Suchfeldern (z. B. Suche, Kunden-Filter), um bei server-seitiger Suche oder teuren Filterungen Requests zu reduzieren.
- **Kurz-TTL-Cache** für schwere, selten wechselnde Daten (z. B. Lizenz-Status) nur dann, wenn viele Aufrufe in kurzer Zeit vorkommen; ansonsten unnötige Komplexität.

### 8.2 Mögliche negative Auswirkungen

- Zu aggressiver Cache: veraltete Anzeige bis TTL abläuft oder manueller Refresh.
- Debounce: leichte Verzögerung beim Tippen – typischerweise 200–400 ms akzeptabel.

---

## 9. Priorisierung und Phasen

### Phase 1 – Quick-Wins (geringer Aufwand, klarer Nutzen)

1. **Spaltenlisten für dataService** definieren und in allen `select('*')`-Stellen für customers, bvs, objects, orders durch diese ersetzen; Types darauf abstimmen.
2. **pullFromServer** auf dieselben Spaltenlisten umstellen.
3. **Historie:** Optional Paginierung vorbereiten (RPC erweitern, UI „Ältere laden“).

### Phase 2 – Mittlerer Aufwand

4. **maintenance_reports, object_photos, object_documents, maintenance_report_photos** in dataService und ggf. Sync auf explizite Spalten umstellen (ohne Spalten, die nie genutzt werden).
5. **Suche:** Entweder von Reduktion der Spalten (Phase 1) profitieren oder Konzept für server-seitige Suche (RPC/Endpoint) + UI anpassen.
6. **Vite manualChunks** einführen und Ladezeit messen.

### Phase 3 – Nach Bedarf

7. **Startseite** mit schlankeren Abfragen oder RPCs, wenn Dashboard-Performance Thema wird.
8. **Scan** RPC `resolve_object_to_navigation`, wenn Scan-Latenz auffällt.
9. **Timeout für pullFromServer** plus klare Fehlerbehandlung und Retry-Button.
10. **Kunden-Liste** paginieren, wenn Datenmengen groß werden.

---

## 10. Kurzfassung negativer Auswirkungen pro Bereich

| Maßnahme | Mögliche Nachteile |
|---------|--------------------|
| Explizite Spalten (dataService/Sync) | Neue Spalten müssen in Listen ergänzt werden; Cache muss alle für Offline nötigen Felder behalten. |
| Server-seitige Suche | Suche offline nur mit Zusatzaufwand (Cache/Index); mehr Backend-Logik. |
| Paginierung (Kunden/Historie) | Mehr UI-Interaktion; Konsistenz bei laufenden Änderungen. |
| Vite Chunks | Mehr Requests beim ersten Load/Navigation. |
| Sync-Timeout | Nutzer sieht Fehler bei langsamem Netz; Retry nötig. |
| Debounce Suche | Kurze Verzögerung beim Tippen. |
| Scan-RPC | Zusätzliche DB-Funktion zu pflegen. |

---

*Zuletzt aktualisiert: Februar 2025*
