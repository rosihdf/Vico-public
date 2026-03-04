# Netlify Deployment – Schritt für Schritt

## Schritt 1: Git-Repository

**Falls noch kein Git-Repo existiert:**

```bash
cd /Users/micha/Vico
git init
git add .
git commit -m "Update für Netlify"
```

**Falls Repo existiert, aber noch nicht gepusht:**

```bash
git add .
git commit -m "Update für Netlify"
```

**Neues GitHub-Repo erstellen (falls noch nicht vorhanden):**

1. https://github.com/new öffnen
2. Repository-Name wählen (z. B. `Vico` oder `vico-public`)
3. **Create repository** klicken

**Lokales Repo mit GitHub verbinden:**

```bash
git remote add origin https://github.com/DEIN-USERNAME/REPO-NAME.git
git branch -M main
git push -u origin main
```

---

## Schritt 2: Netlify-Site erstellen

1. **https://app.netlify.com** öffnen
2. Mit **GitHub** einloggen
3. **Add new site** → **Import an existing project**
4. **Deploy with GitHub** wählen
5. GitHub-Zugriff autorisieren (falls gefragt)
6. Dein **Vico-Repository** auswählen
7. **Configure Netlify** klicken

**Build-Einstellungen prüfen** (werden aus `netlify.toml` übernommen):

- **Branch:** `main`
- **Build command:** `npm run build`
- **Publish directory:** `dist`

8. **Deploy site** klicken

---

## Schritt 3: Umgebungsvariablen in Netlify

1. In Netlify deine **Site** öffnen
2. **Site configuration** → **Environment variables**
3. **Add a variable** → **Add a single variable**
4. **Beide Variablen** hinzufügen:

| Name | Wert |
|------|------|
| `VITE_SUPABASE_URL` | Deine Supabase-URL (aus `.env` oder Supabase Dashboard → Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Dein Supabase Anon Key (Supabase Dashboard → Settings → API) |

5. **Save** klicken
6. **Deploys** → **Trigger deploy** → **Deploy site** (damit der Build mit den Variablen neu läuft)

---

## Schritt 4: Supabase konfigurieren

1. Netlify-Site-URL notieren (z. B. `https://vico-xyz.netlify.app`)
2. **Supabase Dashboard** öffnen → **Authentication** → **URL Configuration**
3. Eintragen:
   - **Site URL:** `https://deine-site.netlify.app`
   - **Redirect URLs:** `https://deine-site.netlify.app/reset-password` hinzufügen
4. **Save** klicken

---

## Schritt 5: Testen

1. Netlify-Site im Browser öffnen
2. **Login** testen
3. **Passwort vergessen** testen (Redirect-URL muss in Supabase hinterlegt sein)

---

## Checkliste

- [ ] Git-Repo erstellt und gepusht
- [ ] Netlify-Site mit GitHub verbunden
- [ ] Build erfolgreich (grüner Haken)
- [ ] `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` in Netlify gesetzt
- [ ] Supabase: Site URL + Redirect URLs eingetragen
- [ ] Login und Passwort vergessen getestet

---

## Ab jetzt: Updates deployen

Bei jedem Push auf `main` baut Netlify automatisch neu:

```bash
git add .
git commit -m "Deine Änderung"
git push origin main
```
