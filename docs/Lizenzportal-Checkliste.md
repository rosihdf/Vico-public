# Lizenzportal – Checkliste bei „Laden fehlgeschlagen“

## 1. Zwei getrennte Supabase-Projekte

| Projekt | Tabellen | Verwendung |
|---------|----------|------------|
| **Haupt-App** | customers, license, profiles, bvs, objects, … | Vico-App (Kunden, Wartung, etc.) |
| **Lizenzportal** | tenants, licenses, profiles, limit_exceeded_log | Admin-App (Mandanten verwalten) |

Die Admin-App muss mit dem **Lizenzportal** verbunden sein.

---

## 2. Schritte prüfen

### A) Lizenzportal-Supabase anlegen

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New Project**
2. Name z.B. „Vico Lizenzportal“
3. Region wählen, Passwort notieren
4. Warten bis Projekt bereit ist

### B) Schema ausführen

1. Im **Lizenzportal-Projekt**: **SQL Editor** → **New query**
2. Inhalt von `supabase-license-portal.sql` einfügen
3. **Run** klicken
4. Keine Fehler? → Tabellen `tenants`, `licenses`, `profiles` sollten existieren

### C) Admin `.env` konfigurieren

Datei: `admin/.env`

```
VITE_SUPABASE_URL=https://<PROJEKT-REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

- **Project URL** und **anon public** aus dem **Lizenzportal-Projekt** (Settings → API)
- Nicht die Keys der Haupt-App verwenden

### D) Dev-Server neu starten

Nach Änderung der `.env`:

```bash
# Admin stoppen (Ctrl+C), dann:
cd admin && npm run dev
```

---

## 3. Projekt prüfen

In der Fehlermeldung steht jetzt: **„Verbunden mit: xxx.supabase.co“**

- Stimmt `xxx` mit der Projekt-Referenz deines Lizenzportal-Projekts überein?
- Im Supabase Dashboard: Projekt öffnen → URL in der Adresszeile enthält die Projekt-Referenz

---

## 4. Tabellen prüfen

Im Lizenzportal-Supabase: **Table Editor**

- Sollte `tenants` anzeigen
- Sollte `licenses` anzeigen
- Sollte `profiles` anzeigen

Wenn nicht: `supabase-license-portal.sql` erneut ausführen.

---

## Profil prüfen (RLS-Fehler)

Wenn die Fehlermeldung **„permission denied“** oder **„row-level security“** enthält:

1. **Table Editor** → **profiles** öffnen
2. Ihre User-ID finden (E-Mail zuordnen) oder in **Authentication** → **Users** die ID kopieren
3. Prüfen: Hat die Zeile **role = admin**?
4. Falls nicht: **SQL Editor** ausführen:

```sql
-- User-ID aus Authentication → Users ersetzen
UPDATE public.profiles SET role = 'admin' WHERE id = 'IHRE-USER-UUID-HIER';
```
