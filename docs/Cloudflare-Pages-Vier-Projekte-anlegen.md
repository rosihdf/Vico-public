# Cloudflare Pages: Vier Projekte aus einem Git-Repo anlegen

Ziel: **vier getrennte Pages-Projekte**, alle mit **demselben GitHub-Repo**, aber unterschiedlichem **Root-Verzeichnis** und **Build-Ausgabe** `dist`. Anschließend erhaltet ihr vier URLs der Form `https://<projektname>.pages.dev` (oder mit Präfix je nach CF-Konvention).

**Weiter nach erfolgreichem Build:** Umgebungsvariablen (`VITE_*`) und ggf. **`npm run cf:apply-env`** im Repo-Root – siehe [`Cloudflare-Mandanten-Env-Skript.md`](./Cloudflare-Mandanten-Env-Skript.md) und [`Cloudflare-URL-und-Secrets-Checkliste.md`](./Cloudflare-URL-und-Secrets-Checkliste.md).

---

## 0. Einmalig vorbereiten

1. **Cloudflare-Account** mit Zugriff auf die Organisation/Domain.
2. **GitHub:** Repo (dieses Vico-Monorepo) unter **Settings → Integrations** bzw. beim ersten Pages-Connect: Cloudflare als **GitHub-App** autorisieren ([Pages: Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)).
3. **Production-Branch** festlegen (meist `main`).

**Tipp:** Namen der vier Pages-Projekte notieren – sie werden u. a. für `projectName` im JSON von `cf:apply-env` gebraucht (exakt wie in der Cloudflare-UI, nicht die URL).

| App | Vorschlag Projektname (frei wählbar) | Root directory |
|-----|--------------------------------------|----------------|
| Haupt-App | z. B. `vico-app` | `/` *(leer lassen oder `.` je nach UI)* |
| Lizenz-Admin | z. B. `vico-admin` | `admin` |
| Kundenportal | z. B. `vico-portal` | `portal` |
| Arbeitszeitenportal | z. B. `vico-arbeitszeit` | `arbeitszeit-portal` |

---

## 1. Navigation im Cloudflare-Dashboard

1. Einloggen auf [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Workers & Pages** (oder **Compute (Workers)**) öffnen.
3. **Create** / **Erstellen** → **Pages** → **Connect to Git** / **Mit Git verbinden**.
4. Bei erstem Mal: **GitHub-Account verbinden** und **Repository** sowie **Team** wählen.

(Die genauen Bezeichnungen können leicht variieren; die Logik ist: **Pages + Git + ein Repo**.)

---

## 2. Projekte nacheinander anlegen (viermal wiederholen)

Für **jede** der vier Zeilen aus der Tabelle oben:

### Schritt 2.1 – Neues Pages-Projekt starten

- **Connect to Git** → Repository auswählen → **Begin setup** / **Einrichten beginnen**.

### Schritt 2.2 – Build-Konfiguration

| Feld | Haupt-App | Admin | Kundenportal | Arbeitszeitenportal |
|------|-----------|-------|--------------|---------------------|
| **Project name** | z. B. `vico-app` | z. B. `vico-admin` | z. B. `vico-portal` | z. B. `vico-arbeitszeit` |
| **Production branch** | `main` (o. ä.) | gleich | gleich | gleich |
| **Root directory** | leer / Repo-Root | `admin` | `portal` | `arbeitszeit-portal` |
| **Build command** | `npm ci && npm run build` | `npm ci && npm run build` | `npm ci && npm run build` | `npm ci && npm run build` |
| **Build output directory** | `dist` | `dist` | `dist` | `dist` |

- **Framework preset:** meist **None** / **Other** (Vite ist nicht zwingend als Preset nötig).
- **`npm ci`** setzt voraus, dass im jeweiligen Root ein **`package-lock.json`** liegt (im Repo für Root, `admin`, `portal`, `arbeitszeit-portal` vorhanden).

### Schritt 2.2a – Deutsche UI: Assistent „Builds und Bereitstellungen einrichten“

Im **ersten Einrichtungs-Assistenten** (Git-Repo verbinden) fehlt oft ein Feld **Bereitstellungsbefehl** – das ist **beabsichtigt / normal**.

- **So vorgehen:** nur **Build-Befehl**, **Build-Ausgabeverzeichnis** `dist`, **Stammverzeichnis** laut Tabelle; **Umgebungsvariablen** wie unten; dann **Speichern und bereitstellen**.
- Nach erfolgreichem Build lädt Cloudflare Pages den Inhalt von **`dist`** in der Regel **ohne** zusätzlichen Befehl (in der Praxis für Vico-Haupt-App verifiziert).
- **`CLOUDFLARE_API_TOKEN`** ist für diesen Weg **nicht** nötig (nur relevant, wenn ihr bewusst `wrangler pages deploy` in den Build einbindet).

**Falls** die Oberfläche später **doch** einen zweiten Befehl verlangt oder das Deployment ohne Dateien bleibt: **Einstellungen → Builds** prüfen. **Nicht** `npx wrangler deploy` verwenden (legt einen **Worker** unter `.workers.dev` an). Optional nur bei Bedarf: `npx wrangler pages deploy dist --project-name=…` plus API-Token mit **Cloudflare-Seiten: Bearbeiten** – siehe Fehlerbild „Authentication error“ in der Team-Doku.

### Schritt 2.3 – Node 20 für den Build

Ohne passende Node-Version schlagen Builds oft fehl.

- Entweder unter **Environment variables** (Build) für **Production** (und ggf. **Preview**):  
  **`NODE_VERSION`** = **`20`**
- Oder in der Build-Umgebung vergleichbare Option laut [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

*(Nach dem ersten Anlegen findet ihr Variablen unter **Projekt → Settings → Environment variables**.)*

### Schritt 2.4 – Umgebungsvariablen (mindestens für grünen Build)

Vite braucht für einen echten Production-Build typischerweise mindestens:

- **`VITE_SUPABASE_URL`**, **`VITE_SUPABASE_ANON_KEY`**
- Für Haupt-App, Portal, Arbeitszeitenportal zusätzlich: **`VITE_LICENSE_API_URL`** = `https://<lizenzportal-ref>.supabase.co/functions/v1` (ohne Slash am Ende)

**Admin (Lizenzportal-Backend):** `VITE_*` auf die **Lizenzportal-Supabase**, nicht auf die Mandanten-DB.

**Optional vor erstem grünen Deploy:** Platzhalter setzen und später durch `cf:apply-env` ersetzen – oder Env **vor** „Save and Deploy“ eintragen, wenn die UI das zulässt.

Siehe auch: **`.env.example`** in Root, `admin`, `portal`, `arbeitszeit-portal`.

### Schritt 2.5 – Deploy starten und Log prüfen

- **Save and Deploy** / **Speichern und bereitstellen**.
- **Build-Log** öffnen: bei Fehler **Root**, **Build command**, **`NODE_VERSION`**, **`VITE_*`** prüfen.
- Nach Erfolg: **Projekt-URL** notieren (`https://….pages.dev`) für [`Cloudflare-Go-Live-Abarbeitung.md`](./Cloudflare-Go-Live-Abarbeitung.md) Abschnitt 0.

---

## 3. Checkliste (abhaken)

- [ ] **Haupt-App** – Projekt angelegt, Build grün, URL notiert  
- [ ] **Lizenz-Admin** – Root `admin`, Build grün, URL notiert  
- [ ] **Kundenportal** – Root `portal`, Build grün, URL notiert  
- [ ] **Arbeitszeitenportal** – Root `arbeitszeit-portal`, Build grün, URL notiert  
- [ ] **Haupt-App:** `VITE_ARBEITSZEIT_PORTAL_URL` = URL des Arbeitszeitenportal-Projekts (Link in der App)  
- [ ] JSON für `cf:apply-env`: `projectName` pro App = exakte CF-Projektnamen ([`configs/vico-cloudflare-deployment.example.json`](../configs/vico-cloudflare-deployment.example.json))

---

## 4. SPA-Routing (Fallback)

Die Apps liefern über `public/_redirects` die Zeile `/* /index.html 200` ins **`dist`** (bereits im Repo). Kein zusätzlicher CF-Schritt nötig, sofern der Build diese Datei mit ausliefert.

---

## 5. Typische Fehler

| Symptom | Prüfen |
|---------|--------|
| Build: `npm ci` fehlgeschlagen | Root directory: wirklich `admin` / `portal` / …? `package-lock.json` im Ordner? |
| Node-Version zu alt | `NODE_VERSION=20` (Production + ggf. Preview) |
| Weiße Seite / 404 auf Unterpfaden | `_redirects` im gebauten `dist` vorhanden? |
| Lizenz/403 im Browser | `allowed_domains` + `VITE_LICENSE_API_URL` – erst nach Env + Lizenzportal-Stammdaten |

---

## Verwandte Doku

- [`Cloudflare-Umzug-Roadmap.md`](./Cloudflare-Umzug-Roadmap.md) – Teil B2  
- [`Cloudflare-Go-Live-Abarbeitung.md`](./Cloudflare-Go-Live-Abarbeitung.md) – Gesamtablauf  
