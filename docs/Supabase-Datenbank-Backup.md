# Supabase Live-Datenbank – Backup / Export

Die **Daten** liegen nur bei Supabase (bzw. in deinen Deployments), **nicht** in Git. Ein manueller Export ist vor größeren Änderungen sinnvoll.

---

## Was automatisch nicht geht

Ein Assistent kann **nicht** in dein **Supabase-Dashboard** einloggen und kein Backup für dich klicken. Du führst einen der Wege unten **einmal selbst** aus (5–15 Min.).

---

## Option A – GitHub Action (empfohlen, falls eingerichtet)

Im Repo liegt **`.github/workflows/db-backup.yml`** („DB Backup“).

1. Auf **GitHub** → Repository **Vico-public** → **Actions**
2. Workflow **„DB Backup“** auswählen
3. **„Run workflow“** → Branch **main** → ausführen
4. Nach Lauf: **Artifacts** des Runs öffnen → **`.sql`-Dump** herunterladen

**Voraussetzung:** Secret **`SUPABASE_DB_URL`** ist gesetzt (PostgreSQL-URL, idealerweise **Pooler / Session mode**, siehe Kommentar in der YAML).

Ohne dieses Secret schlägt der Workflow mit einer klaren Fehlermeldung fehl – dann Option B oder C nutzen.

---

## Option B – Lokal mit `pg_dump` (immer möglich mit DB-Passwort)

1. **Supabase** → dein Projekt (Haupt-App) → **Project Settings** → **Database**
2. **Connection string** kopieren (**URI**), Passwort einsetzen.  
   Für GitHub/IPv4-Probleme oft der **Pooler** (Port **5432**, Session), nicht „Direct connection“, falls dein Netz kein IPv6 kann.
3. Lokal (Docker ohne lokale Postgres-Installation):

```bash
# Passwort und URL anpassen; Dateiname nach Wunsch
export SUPABASE_DB_URL="postgresql://postgres.[REF]:[DEIN_PASSWORT]@aws-0-[region].pooler.supabase.com:5432/postgres"

docker run --rm -e SUPABASE_DB_URL -v "$PWD:/out" -w /out postgres:17 \
  bash -c 'pg_dump "$SUPABASE_DB_URL" --no-owner --no-acl -F p -f "vico-backup-$(date +%Y%m%d).sql"'

ls -la vico-backup-*.sql
```

4. Die **`.sql`-Datei** an einen **sicheren Ort** legen (nicht ins Git committen).

**Lizenzportal (zweites Projekt):** denselben Ablauf mit der **URL des Lizenzportal-Projekts** wiederholen.

---

## Option C – Supabase Dashboard (je nach Plan)

- **Pro/Team** u. ä.: Im Dashboard gibt es oft **Backups / Point-in-Time Recovery** – dort siehst du automatische Snapshots.
- **Free:** Kein vollständiges „Backup herunterladen“ wie bei Pro; dafür **Option A oder B** nutzen.

---

## Sicherheit

- **Niemals** `SUPABASE_DB_URL` oder Datenbankpasswörter ins Repo committen.
- Dumps können **personenbezogene Daten** enthalten – verschlüsselt ablegen (z. B. passwortgeschütztes Archiv, nur auf deinem Rechner/Cloud mit Zugriffskontrolle).

---

## Referenz im Repo

- Automatisierung: **`.github/workflows/db-backup.yml`** (täglich per Cron + manuell)
- Konzept: **`Vico.md`** (Abschnitt zu Off-Site-Backup / GitHub Actions)

**Stand:** März 2026
