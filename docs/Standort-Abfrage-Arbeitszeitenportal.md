# Standort-Abfrage im Arbeitszeitenportal

## Wo können Admin bzw. Teamleiter den aktuellen Standort abfragen?

### Ort im Portal

- **Route:** `/standort`
- **Navigation:** Link „Standort“ in der Hauptnavigation (neben Übersicht, Alle Zeiten, Urlaub, Log, Stammdaten)
- **Sichtbarkeit des Links:** Der Nav-Link „Standort“ wird nur angezeigt, wenn das Lizenz-Feature `standortabfrage` aktiv ist (`features.standortabfrage === true`).

### Berechtigungen

| Rolle      | Zugriff auf /standort | Anzeige der Mitarbeiter-Standorte |
|------------|------------------------|------------------------------------|
| **Admin**  | Ja (wenn Feature aktiv)| Ja                                 |
| **Teamleiter** | Ja (wenn Feature aktiv) | Nur wenn Admin-Einstellung „Standortabfrage für Teamleiter erlaubt“ aktiv ist |

Die Admin-Einstellung wird in der **Haupt-App** unter **Einstellungen** gesetzt (nur sichtbar für Admin, wenn Lizenz-Feature `standortabfrage` aktiv ist). Technisch: `admin_config.standortabfrage_teamleiter_allowed`.

### Technische Details

- **Seite:** `arbeitszeit-portal/src/pages/Standort.tsx`
- **Layout/Nav:** `arbeitszeit-portal/src/components/Layout.tsx` (Zeile 30–32)
- **API:** `arbeitszeit-portal/src/lib/locationService.ts` → RPC `get_employee_locations`
- **RLS:** Die RLS-Policies auf `employee_current_location` prüfen `get_standortabfrage_teamleiter_allowed()` für Teamleiter.

### Ablauf

1. **Mitarbeiter** erteilt in den **Einstellungen** seine Einwilligung („Standortabfrage – Ihre Einwilligung“ → „Einwilligung erteilen“).
2. **Mitarbeiter** kann optional „Benachrichtigungen bei Standortanfrage (Push)“ aktivieren – dann erhält er bei einer Anfrage sofort eine Push-Benachrichtigung (auch wenn die App geschlossen ist).
3. **Mitarbeiter** sendet in der Zeiterfassung seinen Standort („Standort abfragen“ → „Standort senden“).
4. **Admin oder Teamleiter** öffnet das Arbeitszeitenportal und klickt auf „Standort“.
5. Es werden alle Mitarbeiter mit Einwilligung angezeigt (mit oder ohne bereits gesendeten Standort).
6. Bei Klick auf „Standort anfordern“ wird die Anfrage erstellt und – falls der Mitarbeiter Push aktiviert hat – eine Web-Push-Benachrichtigung gesendet.

### Fehlerbehebung: „Standort“-Link wird nicht angezeigt

| Ursache | Lösung |
|---------|--------|
| **Lizenz-API nicht konfiguriert** | In `arbeitszeit-portal/.env`: `VITE_LICENSE_API_URL` und `VITE_LICENSE_NUMBER` setzen. Ohne diese Werte: Fallback-Features (standortabfrage: true) für lokale Entwicklung. |
| **Lizenz hat standortabfrage: false** | Im Lizenzportal (Admin): Lizenz bearbeiten → „Standortabfrage“ aktivieren. Oder Lizenz einem Modell „Professional“/„Enterprise“ zuordnen (Features werden aus dem Modell übernommen). |
| **Lizenznummer falsch** | `VITE_LICENSE_NUMBER` muss exakt der `license_number` in der Tabelle `licenses` entsprechen. |

---

## Offene Punkte / Planung

### 1. Standortabfrage im Hintergrund (jederzeit abrufbar)

**Frage:** Kann die App im Hintergrund laufen, sodass die Standortabfrage jederzeit möglich ist (ohne dass der Mitarbeiter die App öffnen muss)?

| Variante | Machbarkeit | Hinweise |
|----------|-------------|----------|
| **Web/PWA** | ❌ Nicht möglich | Browser unterbrechen JavaScript, wenn Tab/App im Hintergrund ist. Die Geolocation-API ist nur bei sichtbarer Seite nutzbar. Service Worker haben keinen Zugriff auf Geolocation. |
| **Native App (Capacitor)** | ⚠️ Mit Plugin möglich | Plugins wie Background Geolocation können Standort im Hintergrund erfassen. Erfordert: Capacitor-App, Plugin-Integration, erweiterte Einwilligung, höherer Akkuverbrauch, DSGVO-Informationspflicht anpassen. |
| **Web Push als Kompromiss** | ⚠️ Teilweise | Push-Benachrichtigung kann den Mitarbeiter auffordern, die App zu öffnen. Kein echter Hintergrund-Standort, aber schnellere Reaktion als „beim nächsten Öffnen“. |

**Aktueller Stand:** Web Push ist implementiert. Mitarbeiter mit aktivierter Push-Option erhalten bei Standortanfrage sofort eine Benachrichtigung und können die App öffnen, um den Standort zu senden. Ohne Push: Standort wird beim nächsten Öffnen der App angefordert.

---

### 2. Standortabfrage nur während Arbeitszeit

**Frage:** Soll die Standortabfrage nur möglich sein, wenn der Mitarbeiter eingestempelt ist (aktiver Zeiteintrag ohne Ende)?

| Option | Beschreibung |
|--------|---------------|
| **A) Jederzeit** | Standortabfrage unabhängig von Stempelstatus (aktuelles Verhalten). |
| **B) Nur bei Arbeitszeit** | Admin kann nur Mitarbeiter anfordern, die aktuell eingestempelt sind. Oder: Anforderung wird nur erfüllt/angezeigt, wenn der Mitarbeiter beim Senden eingestempelt ist. |

**Technisch (Option B):** Prüfung in `request_employee_location` und/oder `get_employee_locations`: `exists (select 1 from time_entries where user_id = p_user_id and end is null)`.

---

## Web Push – Setup

Für Push-Benachrichtigungen bei Standortanfrage:

1. **VAPID-Keys generieren:**
   ```bash
   deno run https://raw.githubusercontent.com/negrel/webpush/master/cmd/generate-vapid-keys.ts
   ```
   Ausgabe: JSON (publicKey/privateKey) und Application Server Key (Base64).

2. **Haupt-App `.env`:**
   ```
   VITE_VAPID_PUBLIC_KEY=<Application Server Key aus Schritt 1>
   ```

3. **Supabase Edge Function Secrets:**
   - `VAPID_KEYS_JSON` = das JSON-Objekt aus Schritt 1 (erste Zeile der Ausgabe)

4. **Edge Function deployen:**
   ```bash
   supabase functions deploy send-standort-push
   ```

5. **Migration ausführen:** `push_subscriptions`-Tabelle und RPCs sind in `supabase-complete.sql` enthalten.

---

## Fehlerbehebung: Standort gesendet, aber nicht sichtbar

**Symptom:** Mitarbeiter hat Einwilligung erteilt und Standort manuell gesendet (oder nach Anfrage), aber der Standort erscheint im Arbeitszeitenportal unter „Standort“ nicht.

| Ursache | Lösung |
|---------|--------|
| **Haupt-App und Portal nutzen unterschiedliche Supabase** | Beide müssen dieselbe Datenbank nutzen. Prüfen: `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` in Haupt-App und `arbeitszeit-portal/.env` müssen identisch sein (gleiches Supabase-Projekt wie die Zeiterfassung). Siehe `docs/Noch-zu-erledigen.md` §9. |
| **Ortung vs. Standortabfrage – zwei verschiedene Einwilligungen** | **Ortung** (Einstellungen) = nur für Standort bei Stempeln (Start/Ende) → `time_entries`, sichtbar in „Alle Zeiten“. **Standortabfrage** = separate Einwilligung „Standortabfrage – Ihre Einwilligung“ in Einstellungen → `employee_current_location`, sichtbar auf „Standort“. Für die Standort-Seite muss die **Standortabfrage**-Einwilligung erteilt sein (nicht nur Ortung). |
| **Lizenz-Feature standortabfrage** | Die Einwilligung „Standortabfrage – Ihre Einwilligung“ erscheint nur, wenn die Lizenz das Feature `standortabfrage` hat. Im Lizenzportal (Admin): Lizenz bearbeiten → „Standortabfrage“ aktivieren. Ohne dieses Feature kann die Einwilligung nicht erteilt werden. |
| **Teamleiter sieht nur eigenes Team** | Wenn der Betrachter Teamleiter ist: Nur Mitarbeiter mit `team_id = Teamleiter.team_id` erscheinen. Admin sieht alle. Mitarbeiter ohne `team_id` erscheinen für Teamleiter nicht. Prüfen: `select id, email, team_id from profiles where role = 'mitarbeiter'` |
| **Mitarbeiter erscheint nicht in der Liste** | `profiles.standortabfrage_consent_at` muss gesetzt sein, `standortabfrage_consent_revoked_at` null. In Supabase SQL Editor prüfen: `select id, email, standortabfrage_consent_at, standortabfrage_consent_revoked_at from profiles where ...` |
| **„Keine Mitarbeiter mit Einwilligung“** | Mindestens ein Profil braucht `standortabfrage_consent_at is not null` und `standortabfrage_consent_revoked_at is null`. Einwilligung in der Haupt-App unter Einstellungen → Standortabfrage – Ihre Einwilligung erteilen. |
| **Zeit-Log vs. Standort** | Standort bei Stempeln (Start/Ende) geht in `time_entries` (location_start_*, location_end_*) und erscheint in „Alle Zeiten“. Die Seite „Standort“ liest aus `employee_current_location` – das ist ein separates Feature (manuelle Standortabfrage). Beide nutzen dieselbe DB. |
| **Browser-Berechtigung / HTTPS** | Standort-Erfassung erfordert HTTPS und Browser-Berechtigung. Bei lokaler Entwicklung: `https://localhost:5173` oder `https://192.168.x.x:5173` (Zertifikatswarnung bestätigen). |

### Diagnose (Supabase SQL Editor)

```sql
-- Profile mit Standortabfrage-Einwilligung
SELECT id, email, standortabfrage_consent_at, standortabfrage_consent_revoked_at
FROM profiles WHERE standortabfrage_consent_at IS NOT NULL AND standortabfrage_consent_revoked_at IS NULL;

-- Gesendete Standorte
SELECT * FROM employee_current_location;
```
