# GitHub Secrets für Vico

## Übersicht: Zwei Supabase-Projekte

| Workflow | Secrets | Supabase-Projekt |
|----------|---------|------------------|
| **Supabase Lizenzportal Keep-Alive** | `SUPABASE_LICENSE_PORTAL_URL`, `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` | Lizenzportal |
| **Supabase Keep-Alive** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Haupt-App (Mandanten-DB) |
| **Cleanup Demo Data** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Haupt-App (Mandanten-DB) |
| **DB Backup** | `SUPABASE_DB_URL` | Haupt-App (Mandanten-DB) |

Beide Projekte brauchen jeweils eigene Secrets. Wenn Cleanup oder Keep-Alive fehlschlägt: `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` für das **Haupt-Supabase** prüfen.

---

## Lizenzportal: Supabase Keep-Alive (Pause vermeiden)

Free-Tier-Projekte pausieren nach 7 Tagen Inaktivität. Der Workflow `.github/workflows/supabase-license-portal-keepalive.yml` hält das Lizenzportal-Supabase aktiv.

---

## Genaue Anleitung: Secrets anlegen

### Schritt 1: Supabase-URL ermitteln

1. Öffne [Supabase Dashboard](https://supabase.com/dashboard)
2. Wähle das **Lizenzportal-Projekt** (nicht das Mandanten-Projekt)
3. Die URL steht in der Adresszeile oder unter **Settings** → **General** → **Reference ID**
4. Die vollständige URL lautet: `https://<PROJECT-REF>.supabase.co`
   - Beispiel: `https://ojryoosqwfbzlmdeywzs.supabase.co`

### Schritt 2: Service-Role-Key kopieren

1. Im Supabase Dashboard: **Settings** (Zahnrad links unten)
2. **API** in der linken Seitenleiste wählen
3. Nach unten scrollen zu **Project API keys**
4. Den Key **`service_role`** finden (nicht `anon`)
5. Auf **Reveal** klicken und den Key kopieren
6. **Wichtig:** Dieser Key hat volle Rechte – niemals im Frontend oder öffentlich verwenden

### Schritt 3: GitHub Repository öffnen

1. Öffne dein Vico-Repository auf GitHub
2. Klicke auf **Settings** (Tab oben)
3. Links: **Secrets and variables** → **Actions**

### Schritt 4: Erstes Secret anlegen

1. Klicke auf **New repository secret**
2. **Name:** `SUPABASE_LICENSE_PORTAL_URL` (exakt so, Groß-/Kleinschreibung beachten)
3. **Secret:** Die Supabase-URL einfügen, z.B. `https://ojryoosqwfbzlmdeywzs.supabase.co`
4. **Add secret** klicken

### Schritt 5: Zweites Secret anlegen

1. Erneut **New repository secret**
2. **Name:** `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` (exakt so)
3. **Secret:** Den kopierten Service-Role-Key aus Schritt 2 einfügen
4. **Add secret** klicken

### Schritt 6: Prüfen (manueller Testlauf)

1. Im GitHub-Repository oben auf den Tab **Actions** klicken
2. In der linken Seitenleiste unter **All workflows** den Eintrag **Supabase Lizenzportal Keep-Alive** auswählen
3. Rechts oben auf den Button **Run workflow** klicken
4. Im Dropdown **Run workflow** erneut klicken (keine weiteren Optionen nötig)
5. Der Workflow startet – ein neuer Lauf erscheint in der Liste
6. Auf den Lauf klicken, um die Details zu sehen
7. **Erfolg:** Alle Schritte haben einen grünen Haken, in den Logs steht „Lizenzportal Supabase Keep-Alive erfolgreich“
8. **Fehler:** Rote Meldung – häufig „Fehlende Secrets“ oder „Ping fehlgeschlagen“:
   - Bei „Fehlende Secrets“: Beide Secrets prüfen (Namen exakt? Keine Leerzeichen am Anfang/Ende?)
   - Bei „Ping fehlgeschlagen“: Service-Role-Key prüfen (vollständig kopiert? Richtiges Projekt?)

---

## Übersicht der Secrets

| Name | Wert | Beschreibung |
|------|------|--------------|
| `SUPABASE_LICENSE_PORTAL_URL` | `https://<PROJECT-REF>.supabase.co` | Lizenzportal-Supabase URL |
| `SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY` | Service-Role-Key aus Supabase | Supabase Dashboard → Settings → API → `service_role` |

---

## Manueller Lauf

**Actions** → **Supabase Lizenzportal Keep-Alive** → **Run workflow**

Der Workflow läuft automatisch Mo + Do um 9:00 UTC.

---

## DB Backup: SUPABASE_DB_URL

Der Workflow **DB Backup** erstellt täglich um 3:00 UTC einen PostgreSQL-Dump. Er benötigt den Connection String der Datenbank.

### SUPABASE_DB_URL ermitteln

1. [Supabase Dashboard](https://supabase.com/dashboard) öffnen
2. **Haupt-Projekt** (Mandanten-DB) auswählen
3. Oben auf der Projektseite auf **Connect** klicken (grüner/grauer Button)
4. Im Modal erscheinen mehrere Verbindungsoptionen:
5. **Nicht** Direct connection – der nutzt IPv6, GitHub Actions unterstützt das nicht.
6. Stattdessen **Session** (oder **Transaction**) wählen – diese nutzen den Pooler (IPv4).
7. **URI** kopieren, `[YOUR-PASSWORD]` ersetzen durch das echte DB-Passwort:
   - **Settings** (Zahnrad links) → **Database** → **Database password** (Reset, falls vergessen)
8. Format Session: `postgres://postgres.[project-ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres`

**Wichtig:** `[YOUR-PASSWORD]` komplett durch das Passwort ersetzen – **ohne** die eckigen Klammern.  
Beispiel Session: `postgres://postgres.[project-ref]:[PASSWORT]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`  
**Sonderzeichen im Passwort:** URL-encoden (z.B. `@` → `%40`, `#` → `%23`).

### Secret anlegen

1. GitHub → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. **Name:** `SUPABASE_DB_URL`
4. **Secret:** Den vollständigen Connection String einfügen (mit echtem Passwort)
5. **Add secret** klicken

**Hinweis:** Ohne dieses Secret schlägt der Backup-Workflow fehl. Das Backup wird als GitHub Artifact gespeichert (90 Tage). Optional kann ein S3-Upload konfiguriert werden (siehe Workflow-Kommentare).
