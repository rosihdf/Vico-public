# Zeiterfassung: Offene Punkte, Admin-Modul, IONOS Hosting

**Stand:** Februar 2025  
**Zweck:** Zentrale Liste aller noch offenen Punkte inkl. optionaler Komponenten; Schritte für IONOS-Hosting; Auftragszuordnung-Vermerk. Nach Freigabe schrittweise im Chat prüfen und umsetzen, danach Projektüberarbeitung (Struktur, Performance).

---

## 1. Rechte (Phase 1) – Überarbeitung

- **Aktuell:** User sieht nur eigene Zeiten; Admin sieht alle (User-Dropdown). Admin darf bearbeiten (mit Grund), User nicht.
- **Entscheidung:** Teamleiter-Rolle einführen – sieht/bearbeitet nur Zeiten des zugewiesenen Teams. Rollenname ggf. später umbenennen. Siehe `docs/Entscheidungen-Offene-Punkte.md` §5.

---

## 2. Phase 2 – Noch nicht umgesetzt

| Punkt | Beschreibung | Priorität |
|-------|---------------|-----------|
| **Rolle Teamleiter** | Eigene Rolle: sieht/bearbeitet nur Zeiten des zugewiesenen Teams. Aktuell: Teamleiter = Admin. | Optional |
| **Abwesenheits-Grund** | Optionaler Grund für Tage ohne Erfassung (Dienstreise, Homeoffice, Schulung). Eigenes Feld oder Tabelle. | Optional |
| **Ortung (GPS)** | Standort bei Start/Ende erfassen; Nutzer muss Informationspflicht erhalten und Einwilligung bestätigen; Anzeige im Zeiterfassungs-Portal. Rechtlich: DSGVO Art. 13, BDSG § 26, BetrVG § 87 Abs. 1 Nr. 6, DSFA. Siehe `docs/Zeiterfassung-Ortung-GPS-Recht-und-Planung.md`. | Geplant |

---

## 3. Arbeitszeitkonto (AZK) – Ergänzungen

- **Bereits umgesetzt:** `profiles.soll_minutes_per_month`, Anzeige Soll/Ist/Saldo in Monatsansicht, Admin setzt Soll in Benutzerverwaltung („Soll Min/Monat“).
- **Entscheidung:** **Option B – zusätzlich Soll pro Woche oder Tag.** Felder in Stammdaten AZK (Portal/Benutzerverwaltung); Monatssoll daraus berechnet oder separat. Siehe `docs/Entscheidungen-Offene-Punkte.md` §6.

---

## 4. Admin-Modul Zeiterfassung – Gliederung

- **Ziel:** Zeiterfassung unter Admin nach dem Prinzip **eines eigenen Moduls** gliedern: Stammdaten AZK, Bearbeitung, Übersicht aller Zeiten an einem Ort.
- **Aktuell:** Zeiterfassung lebt in der Haupt-App unter `/arbeitszeit`; Admin hat dort User-Dropdown, Bearbeiten-Modal, Tab Log. Soll-Minuten werden in der **Benutzerverwaltung** gepflegt.
- **Vorschlag:**
  - **Variante A (Haupt-App):** Unter `/arbeitszeit` für Admin eine klare Struktur: Tabs oder Bereiche z. B. „Meine Zeiten“ | „Alle Zeiten (Übersicht)“ | „Bearbeitung/Log“ | „Stammdaten AZK“. Stammdaten AZK = z. B. Soll pro User (evtl. täglich/wöchentlich), zentral in diesem Modul statt nur in Benutzerverwaltung.
  - **Variante B (eigenes Admin-Modul):** Separater Bereich nur für Admin (z. B. `/admin/arbeitszeit` oder Unterpunkt in Admin-App), in dem **nur** berechtigte Nutzer alle Zeiten sehen, bearbeiten, Stammdaten AZK pflegen und Log einsehen. Haupt-App `/arbeitszeit` bleibt für Mitarbeiter (nur eigene Zeiten, Start/Ende/Pause).
- **Zu prüfen:** Soll das „Admin-Modul Zeiterfassung“ in der **Haupt-App** (Route nur für Admin) leben oder in der **Admin-App** (Lizenzportal)? Technisch sind Haupt-App und Admin-App getrennt; Zeiterfassungs-Daten liegen in der Haupt-App-Supabase. Ein reines Admin-Modul „Zeiterfassung“ in der Admin-App würde bedeuten: Admin-App müsste auf Haupt-App-Supabase (oder eine API der Haupt-App) zugreifen. Daher spricht vieles dafür, das erweiterte Admin-Modul **in der Haupt-App** unter `/arbeitszeit` zu belassen und dort die Gliederung (Alle Zeiten, Bearbeitung, Log, Stammdaten AZK) umzusetzen.

---

## 5. Auftragszuordnung – Ausblenden und Lösch-Vermerk

- **Entscheidung:** Auftragszuordnung an der Zeiterfassung ist derzeit verwirrend und wird **ausgeblendet** (nicht gelöscht).
- **Technisch:** Code und Datenmodell (`order_id` in `time_entries`, Start mit optionalem Auftrag, Bearbeiten-Modal mit Auftrag, Anzeige in Tagesansicht) bleiben erhalten, werden aber in der UI **nicht angezeigt** (Feature-Flag/Konstante).
- **Entscheidung:** **Entfernen** – Code/UI für Auftragszuordnung in Haupt-App und Arbeitszeitenportal entfernen. Spalte `order_id` kann aus Kompatibilität bleiben. Siehe `docs/Entscheidungen-Offene-Punkte.md` §7.
- **Dateien/Stellen die betroffen sind (zum gezielten Löschen falls nicht gebraucht):**  
  `src/Arbeitszeit.tsx` (Dropdown Auftrag beim Start, Edit-Modal Auftrag, Anzeige „Auftrag: …“), `src/lib/timeService.ts` (Parameter `orderId` bei `startTimeEntry`, `updateTimeEntryAsAdmin`), `src/lib/offlineStorage.ts` (`order_id` in TimeOutboxItem), `src/lib/syncService.ts` (order_id beim Insert aus Outbox), `supabase-complete.sql` (RPC `update_time_entry_admin` Parameter `p_order_id`, Spalte `time_entries.order_id`). Schema/Spalte kann aus Kompatibilität bleiben.

---

## 6. Optionale Komponenten (Zeiterfassung)

| Komponente | Beschreibung | Status |
|------------|--------------|--------|
| §4 ArbZG >9 h | Hinweis 45 Min Pause bei >9 h Arbeitszeit | Nicht umgesetzt |
| Überlappende Einträge | Prüfung: kein zweiter aktiver Eintrag; bei neuem Start Hinweis oder automatisch beenden | Nicht umgesetzt |
| Pausen-Mindestdauer 15 Min | Konzept: Pausenblock mind. 15 Min; keine Frontend-Validierung | Nicht umgesetzt |
| Schnellzugriff PWA | Start/Ende vom Home-Screen (PWA vorhanden, kein eigener Shortcut) | Offen |
| Export CSV/Excel | Zeiterfassung exportieren (kann mit J3 Buchhaltung zusammengeführt werden) | Phase 3 |
| ArbZG-Vorschlag automatisch | „Pause jetzt starten?“ bei >6 h ohne Pause | Phase 3 |
| Genehmigungsworkflow | Teamleiter/Admin genehmigt Zeiten vor Abrechnung | Phase 3 |
| Admin-Export „Zeiterfassung sichern“ | Manueller Download aller Zeiten als CSV/JSON (Konzept 12.1) | Offen |

---

## 7. IONOS Hosting – Optionen und Schritte

### 7.1 Geeignetes Produkt: Deploy Now

- **IONOS Deploy Now** eignet sich für **statische Websites und SPAs** (React, Vite). Es gibt **keine Node.js-Laufzeit** – nur Build-Output wird ausgeliefert. Das passt zu Vico: `npm run build` erzeugt `dist/`, dieser Inhalt wird bereitgestellt.
- **Unterstützt:** React, Vue, Angular, Static Site Generators (z. B. Next.js static, Nuxt static). Vite-Build wird typisch über **npm run build** mit Output **dist/** konfiguriert.
- **Deployment:** Über **GitHub**: Repository mit IONOS Deploy Now verbinden → Framework wird erkannt → GitHub Actions Workflow wird erzeugt → bei jedem `git push` automatischer Build und Deploy.
- **Kosten:** Ca. 0–7 €/Monat je nach Plan.
- **Inklusive:** SSL/TLS, eigene Domain, Preview-URLs für Branches, DDoS-Schutz, Besucherstatistik.

### 7.2 Was wir dafür brauchen

1. **GitHub-Repository** mit dem Vico-Code (bereits vorhanden bzw. anzulegen).
2. **IONOS-Account** und **Deploy Now** aktivieren, GitHub anbinden.
3. **Projekt anlegen:** Repo auswählen, Build-Konfiguration prüfen:
   - **Build-Befehl:** `npm run build`
   - **Output-Verzeichnis:** `dist`
   - **Node-Version** ggf. in Workflow oder `.nvmrc` festlegen (z. B. 18 oder 20).
4. **Umgebungsvariablen:** Alle `VITE_*` Variablen (z. B. Supabase URL, Anon Key) in IONOS Deploy Now als **Secrets/Variables** für den Build eintragen, damit sie zur Build-Zeit verfügbar sind.
5. **Mehrere Apps (Haupt-App, Admin, Portal):** Drei getrennte Projekte in Deploy Now anlegen:
   - Projekt 1: Root (Haupt-App), **Root-Verzeichnis** = Repo-Root, Build = `npm run build`, Output = `dist`.
   - Projekt 2: Admin, **Root-Verzeichnis** = `admin` (oder Subdirectory), Build = `npm run build`, Output = `admin/dist` bzw. `dist` innerhalb von `admin`.
   - Projekt 3: Portal, **Root-Verzeichnis** = `portal`, Build = `npm run build`, Output = `portal/dist` bzw. `dist` innerhalb von `portal`.
   Alternativ: Monorepo-Setup mit einem Repo und drei Deploy-Now-Projekten, die jeweils auf ein anderes Verzeichnis zeigen (sofern IONOS das unterstützt).

### 7.3 Wichtige Hinweise

- **Backend/API:** Supabase läuft extern; die Apps sind reine Frontends. Kein eigener Node-Server auf IONOS nötig.
- **Admin-App** spricht mit **Lizenzportal-Supabase** (eigenes Projekt); **Haupt-App** und **Portal** mit **Haupt-Supabase**. Pro Deploy-Now-Projekt die passenden `VITE_*` Variablen setzen.
- **Dokumentation:** [Deploy Static Sites via GitHub | IONOS Deploy Now](https://docs.ionos.space/docs/deploy-static-sites), [Deploy Now Set Up and Manage Projects](https://www.ionos.com/help/hosting/deploy-now/deploy-now-set-up-and-manage-projects/).

### 7.4 Datenbank – wo läuft sie?

Vico nutzt **Supabase** nicht nur als reines PostgreSQL, sondern als **Backend-as-a-Service**: PostgreSQL + **Auth** (Login, Sessions, JWT) + **RLS** (Row Level Security) + **Realtime** (optional) + **Storage** + **Edge Functions** (z. B. Lizenz-API). Die Frontend-Apps rufen Supabase per HTTPS (REST/Realtime) auf.

| Variante | Beschreibung | Aufwand |
|----------|--------------|--------|
| **A (empfohlen)** | **Datenbank (und Auth/API) bleiben bei Supabase.** IONOS hostet nur die drei Frontend-Apps (Deploy Now). Die Apps verbinden sich mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` zu Supabase – alles läuft über das öffentliche Internet. Supabase kann in EU-Region betrieben werden (DSGVO). | Gering: nur Frontend deployen, Env-Variablen setzen. |
| **B** | **PostgreSQL zu IONOS DBaaS migrieren.** IONOS bietet [PostgreSQL DBaaS](https://cloud.ionos.de/managed/database) (EU, Backups, Skalierung). Dann fehlen aber: **Auth**, **Auto-API** (PostgREST), **Storage**, **Edge Functions**. Man müsste entweder: (1) weiter Supabase nur für Auth nutzen und eine eigene API (z. B. Node auf IONOS Cloud Server) schreiben, die auf IONOS-PostgreSQL zugreift, oder (2) Auth und komplette API selbst bauen. Schema-Migration von Supabase nach „rohem“ PostgreSQL ist möglich, der Rest ist Neuentwicklung. | Sehr hoch. |
| **C** | **Alles bei IONOS:** Frontend (Deploy Now) + optional **IONOS Cloud Server (VPS)** mit eigenem Backend (Node/Express), das eine **IONOS PostgreSQL-DB** (DBaaS) anspricht und Auth/API abbildet. Vico wäre dafür nicht vorgesehen – würde komplette Backend-Architektur bedeuten. | Sehr hoch, nur bei strikter Anforderung „alles bei IONOS“. |
| **D** | **Supabase Self-Host auf IONOS:** Supabase offiziell selbst hosten (Docker) auf einem **IONOS Cloud Server (VPS)**. Dann liegen Datenbank, Auth, API, Storage und Edge Functions auf deinem eigenen IONOS-Server – alles bei einem Anbieter, volle Kontrolle, EU-Standort. Siehe Abschnitt 7.5. | Mittel: Server einrichten, Docker + Supabase deployen, Backups/Updates selbst verantworten. |

**Praktisches Konzept (ohne Self-Host):** **Frontend auf IONOS (Deploy Now), Datenbank und Backend-Services bei Supabase Cloud.** So bleibt die bestehende Architektur erhalten. Wer „alles bei IONOS“ will ohne eigene Backend-Entwicklung: Option D (Supabase Self-Host auf IONOS).

### 7.5 Supabase Self-Host auf IONOS (Option D)

Supabase bietet eine **Self-Hosting-Lösung per Docker** ([Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)). Du betreibst die gleiche Stack-Kombination (PostgreSQL, PostgREST, GoTrue, Kong, Storage, etc.) auf eigenem Server – z. B. einem **IONOS Cloud Server**.

**Vorteile:** Alles bei IONOS (Frontend Deploy Now + ein Cloud Server für Supabase), Daten in deiner Infrastruktur (EU), keine Abhängigkeit von Supabase Cloud, gleiche API – Vico-Code bleibt unverändert, nur `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` zeigen auf deine Self-Host-URL.

**Anforderungen (laut Supabase/Docs):**

| Ressource | Minimum | Empfohlen (Produktion) |
|-----------|---------|-------------------------|
| RAM       | 4 GB    | 8 GB+                   |
| CPU       | 2 Cores | 4 Cores+                 |
| Disk      | 50 GB SSD | 80 GB+ SSD            |

Supabase läuft als **mehrere Docker-Container** (ca. 12 Services). IONOS Cloud bietet vCPU und RAM flexibel (z. B. 8 GB RAM, 4 vCPU) – passend für einen kleinen bis mittleren Self-Host.

**Schritte (Kurzüberblick):**

1. **IONOS Cloud Server** anlegen (Linux, z. B. Ubuntu), mind. 8 GB RAM, 4 vCPU, ausreichend SSD.
2. **Docker + Docker Compose** installieren.
3. **Supabase-Repo** klonen: `git clone --depth 1 https://github.com/supabase/supabase` (Ordner `docker` nutzen).
4. **Umgebung konfigurieren:** `.env` aus `.env.example` anlegen, **Secrets erzeugen** (z. B. `sh ./utils/generate-keys.sh`) – u. a. `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`.
5. **URLs setzen:** `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL` auf deine Domain zeigen (z. B. `https://api.deine-domain.de`).
6. **HTTPS:** Reverse Proxy (Nginx oder Caddy) mit Let’s Encrypt vor die Docker-Services; in Produktion ist HTTPS Pflicht (Auth/Cookies).
7. **Deploy:** `docker compose pull && docker compose up -d`.
8. **Schema/Data:** Dein bestehendes Schema (`supabase-complete.sql`, `supabase-license-portal.sql`) auf die Self-Host-Instanz anwenden (zwei getrennte Supabase-Instanzen für Haupt-App und Lizenzportal, oder eine Instanz mit zwei „Projekten“/Datenbanken – je nach gewählter Architektur).
9. **Frontend (Deploy Now):** `VITE_SUPABASE_URL` = deine Self-Host-API-URL (z. B. `https://api.deine-domain.de`), `VITE_SUPABASE_ANON_KEY` = der generierte Anon Key.

**Wichtig:**

- **Backups:** PostgreSQL-Backups selbst einrichten (z. B. cron + pg_dump oder Volume-Snapshots). Supabase Cloud macht das automatisch, Self-Host nicht.
- **Updates:** Supabase-Images und Schema-Updates selbst einspielen; Kompatibilität prüfen.
- **Lizenzportal:** Ihr habt zwei Supabase-Projekte (Haupt-App + Lizenzportal). Entweder zwei getrennte Self-Host-Instanzen auf zwei Servern (oder einem mit getrennten Compose-Stacks) oder eine Instanz mit zwei Datenbanken – Aufteilung muss geplant werden.
- **Edge Functions:** Laufen im Self-Host-Setup mit; Lizenz-API etc. müssen auf der Self-Host-Instanz deployt werden.

**Fazit:** Supabase Self-Host auf IONOS ist machbar und bringt „alles bei IONOS“ ohne die Vico-Architektur zu ändern. Der Aufwand liegt im Betrieb (Backups, Updates, Monitoring) und in der initialen Einrichtung (HTTPS, Domains, ggf. zwei Instanzen für Haupt + Lizenzportal).

### 7.6 Speicherkontingent – automatische Ermittlung (nach Umzug)

**Stand:** Auf IONOS-Umzug verschoben. Aktuell wird der Gesamtspeicher im Lizenzportal manuell gepflegt („Gesamtspeicher anpassen“). Nach dem Umzug zu IONOS soll das verfügbare Speicherkontingent automatisch aus der Datenbank bzw. Storage-API ausgelesen und in `platform_config` eingetragen werden – je nach gewählter Option (Supabase Self-Host, IONOS DBaaS, etc.) die passende API nutzen.

**Referenz:** docs/Entscheidungen-Offene-Punkte.md §11.

---

## 8. Nächste Schritte (Abarbeitung)

1. **Im Chat:** Alle Punkte aus diesem Dokument schrittweise durchgehen und ggf. sofort umsetzen (Rechte, AZK täglich/wöchentlich, Admin-Modul Gliederung, Auftragszuordnung ausblenden).
2. **Danach:** Komplette Projektüberarbeitung – Struktur prüfen, Ungenutztes entfernen, **High-Performance-Optimierung**.
3. **Auftragszuordnung:** Vor Release entscheiden – wieder einblenden oder gezielt löschen (siehe Abschnitt 5).
