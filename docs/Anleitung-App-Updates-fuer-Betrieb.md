# Anleitung: App-Updates & getrennte Releases (für Betrieb)

**Ziel:** Du weißt nach jedem Schritt, **welche Datei** du anfasst, **welche App** du baust und **wann** die Datenbank mitspielt.  
**Technische Tiefe:** `docs/App-Updates-und-Versionierung.md`  
**Vor jedem größeren Go-Live:** `docs/Release-Checkliste.md`

---

## 1. Welche „Apps“ gibt es?

| Teil | Ordner im Repo | Typische eigene URL (Beispiel) |
|------|----------------|--------------------------------|
| **Haupt-App** | Repo-Root (`/`) | z. B. `app.deine-domain.de` |
| **Kundenportal** | `portal/` | z. B. `portal.deine-domain.de` |
| **Arbeitszeit-Portal** | `arbeitszeit-portal/` | z. B. `az.deine-domain.de` |
| **Lizenz-Admin** | `admin/` | z. B. `admin.deine-domain.de` |

Jede hat **eigene** `package.json` → Feld **`version`** und **eigene** `release-notes.json` (Haupt-App: Datei im **Repo-Root**).

---

## 2. SemVer in 30 Sekunden

- **PATCH** (1.0.**0** → 1.0.**1**): kleiner Fix, Text, Bug – alles bleibt kompatibel.  
- **MINOR** (1.**0**.0 → 1.**1**.0): neues Feature, größere Verbesserung – alte Nutzung geht weiter.  
- **MAJOR** (**1**.0.0 → **2**.0.0): bewusster Bruch (API, Pflichtfelder) – selten und ankündigen.

---

## 3. Standard-Ablauf: **nur eine** App geändert (ohne DB)

**Beispiel:** Du hast nur etwas unter `portal/` geändert.

1. Im Ordner **`portal/`** in `package.json` die **`version`** erhöhen (z. B. `1.0.0` → `1.0.1`).  
2. In **`portal/release-notes.json`** einen Eintrag für **genau diese** Version ergänzen:

```json
{
  "1.0.1": [
    "Kurzer Satz für Nutzer: was ist neu oder gefixt?"
  ]
}
```

3. Lokal testen: `cd portal && npm run build` (soll ohne Fehler durchlaufen).  
4. **Nur** die **Netlify-Site (oder Hosting)** deployen, die das **Portal** ausliefert – Haupt-App und Admin **nicht** neu deployen.  
5. Im Browser: Portal öffnen, nach ein paar Sekunden ggf. **gelbes Update-Banner** → **Aktualisieren** klicken.

**Wichtig:** Ohne Schritt 1–2 enthält das Build zwar `version.json`, aber ohne passende Release-Notes-Zeile für die neue Version können die Notes leer sein – trotzdem funktioniert der Versionsvergleich.

---

## 4. Beispiel: **nur Haupt-App**

1. **`package.json`** im **Repo-Root**: `version` erhöhen.  
2. **`release-notes.json`** im **Repo-Root**: Schlüssel = neue Version, Wert = Liste von Strings.  
3. `npm run lint` und `npm run build` im Root.  
4. Deploy **nur** Haupt-App-Site.  
5. `Release-Checkliste.md` für Env (Lizenz-URL usw.) abhaken.

---

## 5. Wann **Supabase / Migration** dazukommt

**Faustregel:** Änderst du **Tabellen, RPC, RLS, Edge Functions**, betrifft das **alle** Clients, die dieselbe Datenbank nutzen – nicht nur eine Oberfläche.

| Situation | Vorgehen |
|-----------|----------|
| **Nur neue Spalte / neuer RPC, alte Apps funktionieren weiter** | Migration zuerst (Staging → Produktion), dann die App(s) deployen, die das Neue **nutzen**. Andere Apps können später nachziehen. |
| **Nur UI-Text, keine API-Änderung** | Nur betroffene App versionieren und deployen (wie Abschnitt 3). |
| **Breaking Change** | Kurz mit Entwicklung abstimmen: oft zweistufig (erst erweitern, alle Clients aktualisieren, dann aufräumen) oder ein gemeinsames Zeitfenster. |

Details und Beispiele: **`App-Updates-und-Versionierung.md`** §9.5–9.6.

---

## 6. Wo `version.json` herkommt

Beim **Build** schreibt das Plugin **`scripts/vite-plugin-version.mjs`** automatisch **`version.json`** ins Ausgabe-Verzeichnis (`dist/`). Inhalt u. a.:

- `version` – aus `package.json`  
- `buildTime`  
- `releaseNotes` – aus `release-notes.json` für diese Version  

Die **Haupt-App** zeigt Updates über **`shared/UpdateBanner.tsx`** (gleiche Komponente auch in Portal, AZ-Portal, Admin).

---

## 7. CI / Qualität vor dem Push

Im Repo (Root):

```bash
npm run lint
npm run test:run
npm run build
```

Optional wie in GitHub Actions:

```bash
cd portal && npm ci && npm run build
cd ../admin && npm install --legacy-peer-deps && npm run build
```

(Env-Variablen für Vite wie in CI: Platzhalter-URL reicht für den Build-Test.)

---

## 8. Support: Welche Version läuft?

- **Haupt-App:** Menü **Info** – dort wird die gebaute Version angezeigt.  
- **Andere Apps:** nach Bedarf dieselbe Info-Seite ergänzen oder `version.json` unter der Basis-URL prüfen:  
  `https://deine-portal-url/version.json`

---

## 9. Kurz-Checkliste vor jedem Release

- [ ] Richtige App: richtige `package.json` + richtige `release-notes.json`  
- [ ] SemVer erhöht  
- [ ] Lokal Lint/Test/Build (soweit üblich)  
- [ ] DB: nur wenn nötig – Migration **Kompatibilität** beachten  
- [ ] `Release-Checkliste.md` für Produktion  
- [ ] Nach Deploy: Seite neu laden / Update-Banner testen  

---

**Stand:** März 2026 (Phase 0 – umgesetzt)
