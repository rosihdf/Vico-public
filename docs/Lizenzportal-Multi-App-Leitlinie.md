# Lizenzportal – Multi-App-Leitlinie (Vorbereitung)

**Erweitertes Zielbild** (Produkt/Module, DB-Rollout-Schichten, Historie-Skizze): [**Lizenzportal-Multi-App-und-DB-Rollout-Zielmodell.md**](./Lizenzportal-Multi-App-und-DB-Rollout-Zielmodell.md).

Stand: Konzept- und UI-Vorbereitung **ohne** DB-Migration und ohne Umbau der Release-/Rollout-Flows.

## 1. Grundsatz

| Begriff | Bedeutung |
|---------|-----------|
| **Lizenzportal** | Neutraler Betreiber-Hub: Mandanten, Lizenzen, Releases, Mailkonfiguration, globale Vorlagen. |
| **Produkt / App** | Veröffentlichbare Softwarelinie (aktuell erstes Produkt: **ArioVan**). |
| **Mandant** | Kunde mit eigener Mandanten-DB und Lizenzdaten; kann langfristig **mehrere Produkte** nutzen. |
| **Kanal** (`main`, `kundenportal`, `arbeitszeit_portal`) | Deploy-/Release-Ziel im Repo (Webeditionen); derzeit **nicht** gleichbedeutend mit einem formalen `products`-Datensatz. |

**Doku-Konvention:** Wenn explizit die erste Haupt-App gemeint ist → Produktname **ArioVan**. Texte im Lizenzportal-Chrome bleiben **produktneutral**, sofern keine konkrete Produktdatei oder Mandantenfeld gemeint ist.

---

## 2. Analyse: Wo ist das Portal heute produktgebunden?

### 2.1 App-Releases & Release-Rollout

| Aspekt | Bindung | Sofort neutralisierbar? | Später DB/Konzept |
|--------|---------|-------------------------|-------------------|
| Tabelle `app_releases`, Feld `channel` | Logisch an **eine** Haupt-App + zwei Portale im Monorepo | Labels/UI-Texte können neutral bleiben („Kanal“, „App-Ziel“) | **`product_id`** oder **`product_key`** am Release; Zuordnung Kanal → Produkt |
| `RELEASE_CHANNEL_LABELS` (`main` = „Haupt-App“) | Semantisch = erste Produkt-Haupt-App | Bezeichnung „Haupt-App“ ist generisch genug | Klärung: „Haupt-App **welchen** Produkts?“ |

### 2.2 Mandanten aktualisieren & DB-Update-Pakete

| Aspekt | Bindung | Sofort neutralisierbar? | Später DB/Konzept |
|--------|---------|-------------------------|-------------------|
| Kuratierte Liste `admin/src/lib/mandantenDbUpdatePackages.ts` | Pakete gelten faktisch für **ArioVan-Mandanten-DB** | **`product_key`** (statisch `ariovan`) + Anzeigename in der UI | Tabelle **`product_update_packages`** oder Verknüpfung Paket ↔ Produkt |
| SQL-Pfade (`supabase-complete.sql`, Altbericht-Complete) | Repo-Stand der ersten Haupt-App | Doku / Kommentare | Pro Produkt eigene Complete-Pfade oder Manifest |

### 2.3 Mailvorlagen

| Aspekt | Bindung | Sofort neutralisierbar? | Später DB/Konzept |
|--------|---------|-------------------------|-------------------|
| `tenant_mail_templates` mit `tenant_id = null` | Global pro Portal, Platzhalter **`{{app.name}}`** (Mandanten-/Produktname) | UI-Hinweis: Vorlagen sind mandantenweit; Produktbezug über Kontext | Optional **`product_key`** an Vorlage; Fallback-Kette global → produkt → mandant |

### 2.4 Lizenz- / Modulverwaltung

| Aspekt | Bindung | Sofort neutralisierbar? | Später DB/Konzept |
|--------|---------|-------------------------|-------------------|
| `tenants.app_name`, Default **ArioVan** | Produkt-Branding für Haupt-App | bleibt bewusst Default für erstes Produkt | Standard pro Produkt oder leer + Pflicht bei Multi-Produkt |
| `features` / Lizenzmodelle | Fachlich oft produktabhängig | Begriffe „Modul“, „Feature“ nutzen | **`product_modules`** / Zuordnung Feature ↔ Produkt |

### 2.5 UI-Texte

| Aspekt | Bindung | Sofort neutralisierbar? | Später DB/Konzept |
|--------|---------|-------------------------|-------------------|
| Chrome „Lizenzportal“ | Bereits neutral | ✓ | — |
| „Haupt-App“ in Mandantenformular / Hosting | Meint aktuell ArioVan-Haupt-App | Text „Mandanten-Haupt-App“ / „Produkt-Haupt-App“ möglich | Tooltip mit Produktname |

### 2.6 Doku

| Aspekt | Bindung | Sofort neutralisierbar? | Später DB/Konzept |
|--------|---------|-------------------------|-------------------|
| `Vico.md`, ältere Ops-Docs | Historischer Projektname | Schrittweise; nicht Teil dieser Phase | — |
| `docs/sql/*` | Mandanten-DB = erste Haupt-App | Verweis auf diese Leitlinie | Produktspalte in Paketlisten |

**Legende „später“:** Migration bestehender Daten, neue Tabellen, Filter in allen Screens, API-Anpassungen.

---

## 3. Minimal umgesetzt (Code/Doku in dieser Phase)

- Statisches **`product_key`** (`ariovan`) an DB-Paketen + **Anzeigename** „ArioVan“ über zentrales Mapping (`mandantenDbUpdatePackages.ts`).
- UI-Hinweis unter „Datenbank aktualisieren“, welche **Produkte** in der aktuellen Paketliste vorkommen (aus Metadaten abgeleitet, keine neue Logik).
- Diese Datei als **Leitlinie** für Teams und zukünftige Issues.

---

## 4. Multi-App-Zielbild (nicht umsetzen)

Mögliche spätere Erweiterungen (Illustration):

| Tabelle / Artefakt | Zweck |
|--------------------|--------|
| **`products`** | `id`, `key` (z. B. `ariovan`), Anzeigename, Beschreibung, aktiv |
| **`tenant_products`** | Welcher Mandant hat welches Produkt (mit Lizenz-/Tier-Verknüpfung) |
| **`product_modules`** | Feature-Flags / Module pro Produkt |
| **`product_releases`** oder Erweiterung von **`app_releases`** | Release-Zeile mit `product_id` + bestehendem `channel` |
| **`product_update_packages`** | Kuratierte SQL-Pakete mit Produktbezug und Sortierung |
| **Mailvorlagen** | Optional `product_id` NULL = alle Produkte; sonst Override pro Produkt |

Abhängigkeiten und Migrationen bewusst **nicht** Teil dieser Phase.

---

## 5. UI-Leitlinie (später)

### 5.1 Produktfilter

Sinnvoll, sobald **mehr als ein Produkt** mit eigenen Releases oder DB-Paketen existiert:

- **App-Releases** (Liste): Filter „Produkt / Alle“.
- **Mandanten aktualisieren**: Oben Tabs oder **Produktkarten** (Produktname, Kurzbeschreibung, Anzahl Pakete, Link „Datenbank“ / „App“ je nach Scope).

### 5.2 Mandanten aktualisieren – Produktkarten (Skizze)

- Karte **Produkt A** (z. B. ArioVan): Unterpunkte „App-Releases (Verweis)“, „DB-Pakete“, „Letzte Rollouts“ (wenn je geloggt).
- Karte nur anzeigen, wenn für dieses Produkt mindestens ein kuratiertes Paket oder Release existiert.

### 5.3 App-Releases produktbezogen

- Release erfasst: **Produkt** + **Kanal** + Version.
- Mandantenzuweisung: weiterhin über bestehende Incoming-/Zuweisungslogik; langfristig nur Releases anzeigen, die zum Produkt des Mandanten passen.

### 5.4 DB-Pakete gruppieren

- Dropdown oder Accordions nach **`product_key`** / Anzeigename.
- Server-Whitelist (`sql_file`) muss weiterhin mit Repository-Pfaden konsistent bleiben.

---

## 6. Regeln für neue Features

1. **Lizenzportal-UI:** Standard neutral (**Mandant**, **Lizenz**, **Release**, **Kanal**, **Modul**); Produktnamen nur, wenn eine konkrete App/Zeile gemeint ist (z. B. PDF „ArioVan-Dokumentation“).
2. **Defaults:** Default `app_name` / API-Fallback **ArioVan** bleiben ok für das erste Produkt, bis Multi-Produkt-Pflege im Mandantenformular existiert.
3. **Neue SQL-Rollout-Pakete:** Immer **`product_key`** (statisch) und Eintrag in **`docs/sql/CHANGELOG-Mandanten-DB.md`**; bei zweitem Produkt Paketliste oder Mapping erweitern.
4. **Keine stillen Annahmen:** „Haupt-App“ im Text möglichst mit Kontext („Mandanten-Haupt-App des Produkts …“) oder Verweis auf Produktfeld.

---

## 7. Technische Altlasten (bewusst)

- Kanal `main` ohne formales Produkt-FK.
- Lizenz-API und `tenants`-Zeilen ohne `products`-Tabelle.
- Globale Mailvorlagen ohne `product_key`-Spalte.
- Monorepo-Pfade und eine gemeinsame Mandanten-DB-Complete-Datei für die erste Haupt-App.

---

## 8. Verweise

- SQL-Paketkonvention: `docs/sql/SQL-Struktur-und-Paketkonvention.md`
- Mandanten-DB-Workflow: `docs/sql/Mandanten-DB-Workflow.md`
- Paketliste (Code): `admin/src/lib/mandantenDbUpdatePackages.ts`
