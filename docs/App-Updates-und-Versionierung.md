# App-Updates & Versionierung (Planung ab Live-Betrieb)

**Betriebs-Anleitung (Schritt-für-Schritt):** **`docs/Anleitung-App-Updates-fuer-Betrieb.md`**

**Ziel:** Nach dem Go-Live sollen **alle** fachlichen Änderungen, **neuen Module** (soweit in der gleichen Codebasis) und **Verbesserungen** als **nachvollziehbare Update-Versionen** ausgeliefert werden – für Betrieb, Support und Nutzerhinweise.

---

## 1. Grundprinzip: Semantische Versionierung (SemVer)

**Format:** `MAJOR.MINOR.PATCH` (z. B. `1.2.3`), wie in `shared/versionUtils.ts` erwartet.

| Stelle erhöhen | Wann |
|----------------|------|
| **MAJOR** | Breaking Changes für Nutzer/Integration (z. B. entfernte Funktionen, geänderte Pflichtfelder, inkompatible API) |
| **MINOR** | Neue Features, Module, größere UX-Verbesserungen – **abwärtskompatibel** |
| **PATCH** | Bugfixes, kleine Anpassungen, **abwärtskompatibel** |

**Regel:** Jede **produktiv ausgerollte** Änderung am Kunden-Frontend bekommt mindestens einen **PATCH**- oder **MINOR**-Bump; **MAJOR** selten und bewusst kommunizieren.

---

## 2. Ist-Stand: Haupt-App (Vite / PWA)

| Baustein | Ort / Verhalten |
|----------|------------------|
| **Versionsquelle** | `package.json` → Feld `version` |
| **Build-Zeit** | Gemeinsames Script `scripts/vite-plugin-version.mjs` (`vicoVersionPlugin`): schreibt **`version.json`** ins Build-Root (`version`, `buildTime`, `releaseNotes`) |
| **Client** | `__APP_VERSION__` (gleicher Wert wie `package.json`) |
| **Update-Hinweis** | `shared/UpdateBanner.tsx`: lädt `version.json` (no-cache), vergleicht mit `isNewerVersion` → Banner „Neu laden“ |
| **Release Notes im Build** | **Haupt-App:** `release-notes.json` im Repo-Root. **Portal / Arbeitszeit-Portal / Admin:** je `release-notes.json` im jeweiligen App-Ordner – Einträge für **genau die gebaute** Version werden ins `version.json` übernommen |

**Ablauf pro Release (Haupt-App):**

1. **`release-notes.json`** um Einträge für die **neue** Version ergänzen (kurze, nutzerlesbare Bulletpoints).
2. **`package.json` → `version`** auf Zielversion setzen (SemVer).
3. **Build & Deploy** (z. B. Netlify) – sicherstellen, dass **`version.json`** mit ausgeliefert wird (kein aggressives Caching auf `version.json` in CDN-Regeln, oder kurze TTL / Cache-Busting wie bereits `?t=` im Fetch).
4. Optional: **CHANGELOG.md** (für Entwickler/Support) parallel pflegen – kann dieselben Punkte wie `release-notes.json` spiegeln, aber ausführlicher.

**Offline / PWA:** Nutzer mit alter Shell sehen nach erneutem Online-Check das Banner; **Reload** zieht neues Bundle + Service Worker (VitePWA `registerType: 'autoUpdate'`). Kritische Hinweise zusätzlich in Release Notes / Info-Seite.

---

## 3. Weitere Frontends (Admin, Kundenportal, Arbeitszeit-Portal)

**Option A (empfohlen für Übersicht):** **Eigene `version` pro `package.json`** – unabhängige Deployments, eigenes Tempo.

**Option B:** Bei Bedarf **Versionsnummern angleichen** (z. B. alle auf `1.5.0`), wenn mehrere Apps **gemeinsam** released werden – dann in Doku/Release-Notiz **explizit** erwähnen, welche Apps zu welchem Commit/Tag gehören.

**Konkrete nächste Schritte (wenn gewünscht):**

- Dieselbe Idee wie Haupt-App: **`version.json` + Banner** (oder nur Anzeige unter „Info“) für **Portal** und **Arbeitszeit-Portal**.
- **Admin-App:** Version in UI/Build-Metadaten; Update-Hinweis weniger kritisch (intern).

---

## 4. Backend / Supabase: nicht gleich App-Version

- **Datenbank-Migrationen** (`supabase-complete.sql`, zukünftige Migrations-Ordner): **separat versionieren** (Zeitstempel oder Migrations-ID). App-Version und Schema-Stand müssen **kompatibel** sein.
- **Regel:** Neue App-Version darf **alte** API/Tabellen nicht brechen, **oder** Migration **vor** oder **gleichzeitig** mit Deploy (Blue/Green oder kurze Wartung).
- **RPC / Edge Functions:** Breaking Changes nur mit koordiniertem Release + ggf. MAJOR-Bump.

---

## 5. Module vs. App-Version

- **Lizenz-Features / Module** (z. B. `qr_batch_a4`, `standortabfrage`): steuern **Sichtbarkeit**, nicht die **SemVer** der App.
- **Kommunikation:** In Release Notes z. B. „Neu: Modul X (aktivierbar pro Lizenz)“ – damit klar ist: **Code ist drin**, **Nutzung** hängt von Lizenz/Admin-Rolle ab.

---

## 6. Mobile (Capacitor)

- **Web-Teil** der App: wie PWA – Updates über Deploy + Reload im WebView nach Prompt oder App-Neustart (je nach Implementierung).
- **Store-Builds (Play/App Store):** eigene **Store-Versionsnummern** / Build-Nummern – in Release-Doku **Mapping** festhalten: „Store Build 47 = App SemVer 1.4.2“.

---

## 7. Zusammenhang mit bestehenden Dokumenten

| Dokument | Rolle |
|----------|--------|
| **`docs/Release-Checkliste.md`** | Operative Punkte vor Deploy (Env, Lizenz, …) – vor jedem Go-Live abarbeiten |
| **`release-notes.json` + `package.json`** | Technische Quelle für **sichtbare** Nutzer-Release-Notes im Banner |
| **Dieses Dokument** | **Prozess & Strategie** für fortlaufende Updates nach Live-Gang |

---

## 8. Kurz-Checkliste „Update veröffentlichen“

- [ ] Änderungen gemerged, Tests/Build lokal grün
- [ ] **`package.json` `version`** der **tatsächlich deployten** App angehoben (SemVer)
- [ ] **`release-notes.json`** im **passenden** Ordner (Root / `portal/` / `arbeitszeit-portal/` / `admin/`) für diese Version
- [ ] DB-Migrationen / RPC falls nötig **vor** oder **mit** Deploy
- [ ] `Release-Checkliste.md` für Zielumgebung
- [ ] Nach Deploy: `version.json` im Browser prüfen, **UpdateBanner** mit alter Session testen

---

## 9. Getrennte Updates pro App-Teil (Zielbild)

**Idee:** Jede **auslieferbare Einheit** (Haupt-App, Kundenportal, Arbeitszeit-Portal, Admin-App) hat **eigene** SemVer, **eigenes** `version.json`, **eigenes** Release-Notes-Set und wird **eigenständig** gebaut und deployed. Änderungen nur im **Kundenportal** → nur **Portal**-Version bumpen und **nur** das Portal-Deployment auslösen; Haupt-App-Nutzer sehen **kein** Update-Banner.

### 9.1 Was ist eine „Einheit“ im Sinne von Updates?

| Einheit | Typisch eigene URL / Site | Eigene `version`? |
|---------|---------------------------|-------------------|
| **Haupt-App** (Vite Root) | z. B. `app.example.de` | ✅ |
| **Kundenportal** (`portal/`) | z. B. `portal.example.de` | ✅ |
| **Arbeitszeit-Portal** (`arbeitszeit-portal/`) | z. B. `az.example.de` | ✅ |
| **Admin / Lizenz-UI** (`admin/`) | z. B. `admin.example.de` | ✅ |
| **Supabase** (DB, RPC, Edge Functions) | keine „App-Version“ | ⚙️ Schema/Migration **separat** (betrifft oft **alle** Clients) |
| **Capacitor** (Stores) | gebündelte Haupt-App | ✅ an Haupt-App gekoppelt, **zusätzlich** Store-Build-Nr. |

### 9.2 Ablauf (vereinfacht)

```text
Code-Änderung in genau EINER Einheit (z. B. portal/)
    → SemVer dieser Einheit erhöhen (PATCH/MINOR/MAJOR)
    → Release Notes NUR für diese Einheit pflegen
    → Build NUR dieser Einheit (npm run build im jeweiligen Ordner)
    → Deploy NUR dieser Site (Netlify/GitHub Actions „nur portal“)
    → Nutzer dieser URL: UpdateBanner / Reload holt neues Bundle
    → Andere URLs: unverändert, kein unnötiges Redeploy
```

**Wichtig:** Wenn die Änderung **gemeinsam genutzte** Dinge betrifft (z. B. neue DB-Spalte, neuer RPC), ist das **kein** „nur Portal“-Update: Schema/RPC muss **kompatibel** deployed werden; betroffene **Apps** müssen ggf. **nacheinander** oder **gemeinsam** angepasst werden (siehe §9.4).

### 9.3 Shared Code / „Wer muss mitbauen?“

Aktuell **kein** zentrales npm-Workspace-Paket im Repo-Root – gemeinsame Teile können über **relative Imports** oder Kopien existieren. Für saubere getrennte Updates planen:

- **Option 1 (minimal):** Kein Shared-Paket; Duplikat akzeptieren → jede Einheit versioniert sich **nur** bei **eigenen** Dateiänderungen.
- **Option 2 (empfohlen mittelfristig):** `packages/shared` (oder `@vico/shared`) mit **eigener** Versionsnummer oder **Changelog „shared bump“** – wenn sich `shared` ändert, **explizit entscheiden**, welche Apps **neu gebaut** werden müssen (Matrix in CI oder Handbuch).

### 9.4 Wann ist es doch „mehr als eine App“?

| Änderung | Typische Konsequenz |
|----------|---------------------|
| Nur UI/Text im Portal | Nur **Portal** deployen |
| Neue RPC / Spalte / RLS, alte Apps funktionieren weiter | **DB-Migration zuerst**, dann **eine** App mit neuem Code (oder alle, wenn alle die API nutzen sollen) |
| Breaking RPC / entfernte Spalte | **Koordiniertes Release**: Migration + **alle** betroffenen Frontends in kurzem Fenster oder Feature-Flags |
| Lizenzportal Edge Function | Eigener Deploy-Schritt; ggf. **Admin** + **Haupt-App** testen |

### 9.5 Tiefeneinsteig: „Wichtig zu verstehen“ – zwei Ebenen von Updates

Viele verwechseln **„nur Portal deployen“** mit **„nur Portal ist betroffen“**. Technisch sind das **zwei verschiedene Ebenen**:

#### Ebene A – Frontend-Assets (pro URL getrennt)

- Jede App (Haupt, Portal, AZ, Admin) ist ein **eigenes** gebündeltes JavaScript/CSS auf **eigener** Domain/Site.
- Ein Deploy ersetzt nur die Dateien **dieser** Site. Die anderen Sites merken **nichts** – kein neues `version.json`, kein neuer Bundle-Hash.
- **Das** ist die „getrennte Update-Funktion“: *Wer* neu ausliefert, steuert ihr **pro Build/Deploy**.

#### Ebene B – Backend-Vertrag (für alle Clients gemeinsam)

- **Eine** Supabase-Instanz (Postgres, RLS, RPC, ggf. Edge Functions) ist der **gemeinsame Vertrag** zwischen **allen** Frontends, die dieselbe DB/API nutzen.
- Eine **Migration** ändert diesen Vertrag **einmal zentral**. Es gibt **kein** „nur Portal-Datenbank“ parallel zur Haupt-App – außer ihr baut bewusst **mehrere** Umgebungen (nicht der Normalfall).
- **Folge:** Ihr könnt **Deployment** splitten (nur Portal neu), aber **Schema/RPC** betrifft **alle** noch verbundenen App-Versionen gleichzeitig. Alte Haupt-App-Builds laufen weiter und sprechen **dieselbe** API an wie das neue Portal.

**Merksatz:** *Getrennt deployen = getrennte **Lieferung**.* *Gemeinsame DB = gemeinsamer **Vertrag** – den müsst ihr **kompatibel** halten oder koordiniert umbrechen.*

#### Was schiefgeht, wenn man nur die eine Ebene im Kopf hat

| Situation | Problem |
|-----------|---------|
| Portal deployed, ruft neuen RPC `get_x` auf | Migration/RPC noch nicht live → **Fehler** im Portal |
| Migration entfernt Spalte `foo` | Alte Haupt-App liest noch `foo` → **Fehler** für alle, die alte Version nutzen |
| Migration macht Spalte NOT NULL ohne Default | Alte Apps schreiben noch ohne Feld → **INSERT/UPDATE scheitert** |

#### Expand-only vs. Breaking (Leitplanken)

- **Expand-only (bevorzugt):** Neue Spalte **nullable** oder mit **Default**, neuer RPC **zusätzlich**, alte Felder/RPCs **unverändert**. Alte App-Versionen laufen weiter; neue Apps nutzen das Neue. Später optional **Contract** bereinigen (zweite Phase).
- **Breaking:** Spalte weg, Signatur geändert, RLS verschärft ohne dass alte Queries noch dürfen → braucht **koordiniertes** Release (kurzes Fenster: Migration + alle betroffenen Frontends) oder **Feature-Flag** / **Zwei-Phasen-Migration**.

### 9.6 Playbook: So würde ich Updates konkret fahren

Unten: **praktische Reihenfolgen**, nicht Rechtsberatung – immer mit eurem Schema/Staging testen.

#### Fall 1 – Nur Portal-UI / Texte / Routing, keine API-Änderung

1. Änderungen nur unter `portal/`.  
2. `portal/package.json` Version PATCH/MINOR.  
3. `portal/release-notes.json` ergänzen.  
4. Build + Deploy **nur** Portal-Site.  
5. Fertig. Haupt-App, AZ, Admin **unberührt**. DB **kein** Schritt.

#### Fall 2 – Portal braucht **neue** Daten (neue Spalte / neuer RPC), alte Clients sollen **nicht** brechen

1. **Migration** in Supabase (Staging → Produktion): nur **additive** Änderungen (nullable/Default, neuer RPC).  
2. **Prüfen:** Haupt-App und AZ mit **alter** Version gegen neue DB (Smoke-Tests).  
3. **Dann** Portal-Code deployen, der die neue Spalte/RPC nutzt.  
4. Optional später: Haupt-App anpassen, wenn sie das Feld auch zeigen soll – **eigenes** Release, wieder nur diese App.  
5. In einer **Kompatibilitätsnotiz** (Tabelle oder `docs/`): „DB-Stand ab Migration **M**; Portal ≥ **x.y.z** nutzt Spalte **s**.“

#### Fall 3 – Gleiche Änderung sichtbar in **Portal und Haupt-App**

1. Migration **expand-only** wie Fall 2 **oder** keine DB-Änderung.  
2. Zwei **unabhängige** Frontend-Releases möglich: zuerst Portal, dann Haupt-App (oder umgekehrt), solange **API kompatibel** ist.  
3. Beide `package.json`-Versionen separat erhöhen, je eigene Release Notes.

#### Fall 4 – Breaking Change (nicht vermeidbar)

1. Plan: **Wartungsfenster** oder **Feature-Flag** (neue Route/RPC, alte deprecaten).  
2. Reihenfolge typisch: **Backward-kompatible** Zwischenmigration → alle Clients deployen, die **neu** können → **dann** aufräumen (zweite Migration).  
3. Wenn **Big Bang** nötig: Migration + **alle** betroffenen Sites **fast gleichzeitig** deployen; Nutzer kurz auf Reload/Cache hinweisen.

#### Fall 5 – Edge Function / Lizenz-API

1. Eigener Deploy-Schritt (nicht „Portal-Version“).  
2. **Kompatibilität:** Ändert sich JSON-Response **breaking**, müssen **alle** Aufrufer (Admin, Haupt-App, …) **vor** oder **mit** dem Deploy angepasst sein – oder API-Versionierung (`/v2/…`).

#### Fall 6 – Capacitor / Store

1. Bindet **Haupt-App-Bundle**; sinnvolle Regel: **Store-Build** bei relevanten **Haupt-App**-Releases (MINOR/MAJOR oder sicherheitsrelevantem PATCH).  
2. Portal-only-Änderung **kein** Store-Update nötig.

#### Operative Artefakte (empfohlen)

| Artefakt | Zweck |
|----------|--------|
| **SemVer pro App** | Nachvollziehbarkeit pro Site |
| **`version.json` pro App** | Update-Banner / Support |
| **Migrations-Log / Timestamp** | „DB-Stand“ unabhängig von App-Version |
| **Kompatibilitätsmatrix** (kurz) | Zeile: Migration-ID; Spalten: min. Haupt-App / Portal / AZ |
| **CI: Deploy nur bei `paths`** | Verhindert unnötige Builds; ersetzt **nicht** die DB-Disziplin |

---

## 10. Detaillierte Rückfragen (zum Abhaken)

### Deployment & Infrastruktur

1. **Hosting:** Sind **vier getrennte** Netlify-Sites (oder gleichwertig) für Haupt-App, Portal, AZ-Portal, Admin **geplant** – eine Site pro Build-Root? Oder heute noch **ein** Bundle?
2. **CI/CD:** Soll **path-based** deployen (nur bei Änderungen unter `portal/**` → nur Portal-Build) automatisch laufen, oder bewusst **manuell** „Workflow: Portal Release“?
3. **Branches:** Release nur von `main`, oder auch Release-Branches pro Kunde?
4. **Preview-Deploys:** Pro PR eine Preview **pro betroffener App** nötig?

### Versionierung & Kommunikation

5. **Versionsnummern:** Sollen die vier Apps **komplett unabhängige** SemVer führen (z. B. Haupt-App `2.1.0`, Portal `1.0.3`), oder ein **Produkt-Label** zusätzlich (z. B. „Vico Platform 2026.03“) für Marketing/Support?
6. **Release Notes:** Pro App **eigene** Datei (z. B. `portal/release-notes.json`) statt einer globalen `release-notes.json` nur für die Haupt-App?
7. **Update-UI:** Überall **Banner wie Haupt-App**, oder Portal/AZ nur **still** (Version unter „Info“), Banner nur bei **MINOR+**?
8. **Admin-App:** Braucht intern ein **Update-Banner** oder reicht **Versionsanzeige** im Footer?

### Backend & Kompatibilität

9. **Migrations-Prozess:** Ein **einziger** Supabase-Projekt-Stand für alle Mandanten – wie wird **documentiert**, welche **Mindest-App-Version** welche DB voraussetzt (Kompatibilitätsmatrix)?
10. **Rollbacks:** Wenn nur Portal zurückgedreht wird, bleibt die DB „vorne“ – ist **Rückwärtskompatibilität** der API **Pflicht** für alle Releases?
11. **Edge Functions / Lizenz-API:** Eigener **Deploy-Zyklus** – wer darf deployen, und wie wird das in Release Notes kommuniziert (intern)?

### Mobile & PWA

12. **Capacitor:** Soll ein **Store-Update** nur bei **Haupt-App**-Änderungen erfolgen, oder auch bei „nur relevant wenn WebView Cache“ – klare **Trigger-Regel**?
13. **PWA Haupt-App:** Bleibt `version.json`-Check **nur** für Haupt-App, unabhängig von Portal-Version?

### Organisation

14. **Support:** Wenn Kunde anruft – wie erfahren Support-Mitarbeitende **schnell** „Portal 1.2.1, Haupt-App 2.0.0“ (z. B. sichtbare Version in UI, interne Tabelle)?
15. **Security:** Getrennte Deploys – gleiche **Secrets**/Env-Profile pro Site oder zentral dokumentiert?

---

## 11. Konkreter Umsetzungsvorschlag (Detail)

### 11.1 Technisch: gleiches Muster in jeder Vite-App (**umgesetzt**)

Für **Haupt-App**, **`portal/`**, **`arbeitszeit-portal/`**, **`admin/`**:

1. **`scripts/vite-plugin-version.mjs`** – einmalig, in jeder `vite.config.ts` per `vicoVersionPlugin(__dirname)` eingebunden.
2. **`__APP_VERSION__`** aus **jeweiligem** `package.json` (`version`).
3. **`release-notes.json`** – Root für Haupt-App; **`portal/`**, **`arbeitszeit-portal/`**, **`admin/`** je eigene Datei (Schema: `{ "1.0.0": ["…"] }`).
4. **`shared/UpdateBanner.tsx`** + **`shared/versionUtils.ts`** – Import in Layout bzw. `App.tsx` (Haupt-App: `Layout.tsx`).
5. **Service Worker / PWA:** weiter nur Haupt-App nach Bedarf; Sub-Apps ohne PWA-Update-Logik.

### 11.2 Deployment: eine Site pro App

- **Netlify:** Pro Ordner **Base directory** + **Build command** + **Publish directory** eigene Site.
- **GitHub Actions:** Jobs `deploy-main-app`, `deploy-portal`, … mit `paths:`-Filter:

  ```yaml
  # Beispiel-Idee
  on:
    push:
      branches: [main]
      paths:
        - 'portal/**'
  ```

- **Manueller Override:** Workflow „Deploy all“ für große Releases.

### 11.3 Repo-Struktur (Ist)

- **`shared/`:** u. a. `versionUtils.ts`, `UpdateBanner.tsx` (bereits von Portal, AZ-Portal, Admin und Haupt-App genutzt).
- **Optional später:** `packages/shared` als npm-Workspace, wenn weitere Pakete dazukommen.

### 11.4 Dokumentation & Betrieb

- **`docs/Release-Checkliste.md`:** Unterpunkte **pro App** (Checkbox „nur wenn deployt“).
- **Kompatibilitäts-Tabelle** (ein Abschnitt in dieser Datei oder `docs/DB-App-Kompatibilitaet.md`): Zeile = DB-Migration / RPC-Version, Spalte = Mindest-App-Versionen.

### 11.5 Was ihr **nicht** tun müsst

- **Keine** zwingende gleiche Versionsnummer über alle Apps.
- **Kein** Monolith-Deploy nur deshalb, weil eine Zeile im Portal geändert wurde – solange DB/API kompatibel bleibt.

---

## 12. Kurz-Checkliste „nur eine App aktualisieren“

- [ ] Änderung wirklich **nur** in dieser Einheit (+ keine breaking DB ohne Absicherung)?
- [ ] **`package.json` `version`** in **diesem** Ordner erhöht
- [ ] **`release-notes.json`** in **diesem** Ordner für diese Version
- [ ] Build & Deploy **nur** diese Site / dieser Workflow
- [ ] Bei DB/RPC-Änderung: Migration + Kompatibilitätsnotiz + ggf. andere Apps zeitnah

---

**Stand:** März 2026 – inkl. getrennte Updates pro App-Teil (§9–12), Tiefeneinsteig & Playbook **§9.5–9.6**, Rückfragen §10, Vorschlag §11.

**Anleitung für Betrieb:** **`docs/Anleitung-App-Updates-fuer-Betrieb.md`** (siehe auch `Noch-zu-erledigen.md` §11).
