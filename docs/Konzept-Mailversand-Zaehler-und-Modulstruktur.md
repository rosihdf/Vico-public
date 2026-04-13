# Konzept: Mailversand-Zaehler, Provider-Optionen und Modulstruktur im Lizenzportal

Stand: 2026-04-13

Umsetzungsstatus:
- [x] Phase 1.1 LP-UI Modulsortierung inkl. Eltern/Untermodule und Abhaengigkeits-Toggles im Mandantenformular.
- [x] Phase 1.2 Mail-Eventlog in Mandanten-DB
- [x] Phase 1.3 Monatsaggregation im Lizenzportal
- [x] Phase 1.4 Admin-Anzeige im LP

Implementierungsnotiz:
- Event-Logging ist in den relevanten Edge Functions aktiv (`maintenance_pdf`, `portal_notify`, `maintenance_digest`).
- Spiegelung ins Lizenzportal erfolgt ueber optionale Secrets `LP_SUPABASE_URL`, `LP_SERVICE_ROLE_KEY`, `LP_TENANT_ID`.

## 1) Beschlossene Produktentscheidungen

### 1.1 Zaehllogik Mailversand (Resend-Limit 3000/Monat)

- Gezaehlt wird **abrechnungsnah**: erfolgreiche Provider-Responses (`2xx`) als Verbrauch.
- Fehlerhafte Versandversuche werden **separat** erfasst (Transparenz/Fehlerquote), aber nicht als Verbrauch gezaehlt.

### 1.2 Datenhaltung (Kombi)

- **Mandanten-DB:** Detail-Events pro Versand (nahe am Versandprozess).
- **Lizenzportal:** aggregierte Monatszaehler pro Mandant (Monitoring/Steuerung).
- Zielbild: spaeter **read-only Transparenz in der Hauptapp**.

### 1.3 Absenderkennung

- Jetzt: pro Mandant vorbereiten mit
  - `from_name`
  - `from_email`
  - `reply_to`
- Fallback: wenn Mandantenwert fehlt/ungueltig, globales `RESEND_FROM`.

### 1.4 Provider-Strategie

- Jetzt Architektur als Adapter vorbereiten (`sendEmail(provider, payload)`), Versand weiterhin Resend.
- Spaeter erweiterbar fuer eigene Provider (z. B. SMTP/API).
- Credentials-Strategie: **Hybrid** (jetzt globale Secrets, spaeter optional verschluesselt pro Mandant).

### 1.5 Modulansicht im Lizenzportal

- Neusortierung in Gruppen:
  - **Main**
  - **Kundenportal**
  - **Arbeitszeit-Portal**
- Abhaengigkeiten als **Untermodule** gefuehrt.
- Toggle-Verhalten **hart gekoppelt**:
  - Eltern aus -> Kinder aus (und deaktiviert)
  - Kind an -> Eltern automatisch an

### 1.6 Datenmodell fuer Modullogik

- Kurzfristig: bestehende Feature-Keys behalten, UI-seitig gruppieren + Abhaengigkeitslogik.
- Langfristig optional: Migration auf hierarchische Keys.

## 2) Vorgeschlagene Modulgruppen und Abhaengigkeiten (UI)

## Main

- `kunden` (Eltern)
  - `wartungsprotokolle` (Kind von `kunden`)
    - `scan` (Kind von `wartungsprotokolle`)
  - `auftrag` (Kind von `kunden`)
  - `suche` (Kind von `kunden`)
- `historie` (System)
- `fehlerberichte` (System)
- `ladezeiten` (System)
- `beta_feedback` (optional systemnah)
- `einstellungen`, `profil` (systemweit; je nach Produktentscheidung auch als feste Basismodule fuehrbar)

## Kundenportal

- `kundenportal` (Eltern)
  - optionale spaetere Untermodule (falls getrennt eingefuehrt)

## Arbeitszeit-Portal

- `arbeitszeiterfassung` (Eltern)
  - `urlaub`
  - `standortabfrage`
  - `teamfunktion`

## 3) Umsetzungsplan in 3 Phasen

## Phase 1 (kurzfristig, risikoarm)

1. **LP-UI Modulsortierung**
   - Gruppen + Untermodule + harte Toggle-Abhaengigkeiten.
2. **Mail-Eventlog in Mandanten-DB**
   - Versandereignisse mit `provider`, `channel`, `status`, `tenant_id`, `created_at`.
3. **Monatsaggregation im Lizenzportal**
   - Monatszaehler (`sent_ok`, `sent_failed`) pro Mandant.
4. **Admin-Anzeige im LP**
   - "Monat gesendet: X/3000", Fehlerquote, letzte Aktualisierung.

## Phase 2 (Transparenz in Hauptapp)

1. Read-only Anzeige in Hauptapp (`Info`/`Einstellungen`):
   - Verbrauch `X/3000`
   - Erfolgreich/Fehler
   - optional Kanalaufschluesselung (PDF/Portal/Digest).
2. Optional Warnstufe:
   - erst ab stabilem Datenlauf (z. B. >80%).

## Phase 3 (Provider-Erweiterung)

1. Provider-Adapter produktiv nutzen (`resend` als Default).
2. Mandantenkonfig fuer `from_name`, `from_email`, `reply_to`.
3. Optional eigener Provider (SMTP/API):
   - zunaechst per globalen Secrets,
   - spaeter optional pro Mandant verschluesselt.

## 4) Empfohlene Datenfelder (Start)

## Mandanten-DB (Event)

- `email_delivery_events`
  - `id`
  - `tenant_id`
  - `provider` (`resend`, spaeter `smtp`, ...)
  - `channel` (`maintenance_pdf`, `portal_notify`, `maintenance_digest`, ...)
  - `status` (`ok`, `failed`)
  - `provider_message_id` (optional)
  - `error_code`, `error_text` (optional)
  - `created_at`

## Lizenzportal (Aggregation + Konfig)

- `tenant_email_monthly_usage`
  - `tenant_id`
  - `year_month` (z. B. `2026-04`)
  - `sent_ok`
  - `sent_failed`
  - `updated_at`
- Konfig an `tenants` oder separater Tabelle:
  - `mail_from_name`
  - `mail_from_email`
  - `mail_reply_to`
  - `mail_provider` (default `resend`)

## 5) Offene Punkte (bewusst noch offen)

- Exakter Speicherort fuer spaetere mandantenspezifische Provider-Credentials.
- Ob `einstellungen`/`profil` als harte Basismodule immer aktiv bleiben sollen.
- Ob `beta_feedback` unter Main oder als eigener Block gefuehrt wird.
