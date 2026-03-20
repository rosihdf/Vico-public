# Noch zu erledigen – Übersicht

**Stand:** März 2025 (Entscheidungen Roadmap J: März 2026 ergänzt)  
**Quellen:** Vico.md Roadmap, Zeiterfassung-Offene-Punkte, Arbeitszeit-Umstrukturierung-Portal

### Getroffene Entscheidungen – Roadmap J (März 2026)

| Punkt | Entscheidung | Hinweis |
|-------|----------------|---------|
| **J1** Wartungserinnerungen | **A dann B:** zuerst In-App ausbauen (klarere Anzeige, Badge, Filter „fällig in X Tagen“), danach **E-Mail**-Versand. | Reihenfolge: schneller erster Meilenstein, E-Mail mit Provider/DSGVO. |
| **J2** Wartungsstatistik | **B:** KPIs/Tabellen **+ Diagramme + CSV-Export**; Datenquelle für Tabelle und Export **gemeinsam**. | |
| **J3** Export Buchhaltung | **C (später):** kein generischer Export; **kundenspezifisch** Schnittstelle (z. B. **SevDesk**-API serverseitig, Anforderungen mit Kunden klären). | Siehe Chat / SevDesk-API-Doku. |
| **J4** Zuletzt bearbeitet | **A jetzt:** MVP „Zuletzt bearbeitet“ auf Startseite. **B (Favoriten / „nur meine“)** bewusst **später**. | |
| **J5** Kundenfilter | ✅ **Erledigt** (März 2026): PLZ, Wartungsstatus, BV-Anzahl Min/Max in `Kunden.tsx` (Filter-Panel). | |
| **J6** Wartung MVP (Freigabe → Portal) | **Auf später / eigenes Thema:** Struktur und Ablauf (Freigabe-Workflow, Portal-Anbindung) **gesondert** planen, **wenn** die übrigen Roadmap-Punkte (J1–J2, J4, …) weitgehend fertig sind. Aktuell: Monteursbericht/Unterschriften vorhanden; Rest bewusst nicht priorisiert. | |
| **J7** Sammelpaket | **B (priorisierte Reihenfolge), ohne Kalender-Sync (iCal).** Umsetzungsreihenfolge: **(1) Mängel-Follow-up** → **(2) Bulk-Operationen** → **(3) Push-Benachrichtigungen Kundenportal**. **iCal:** nicht geplant in dieser Runde (optional später eigenes Thema). | Reihenfolge bei Bedarf anpassen. |
| **I2** Etikettendrucker | **B jetzt:** Abstraktion/Schnittstelle ausbauen, **ohne** fertigen Hardware-Druck. **Favorit:** **Bixolon** (Option z. B. „SPP-R200III / kompatible“). **Weitere Treiber:** bei Bedarf (Zebra/Brother …), Reihenfolge offen bis Kundenbedarf. **Einstellungen:** eigener Block **„Etikettendrucker“**; Auswahl **nur lokal pro Gerät** (z. B. Preferences); **PWA:** kein BT-Druck, nur Teilen o. Ä.; Druckerwahl nur sinnvoll wenn `isEtikettendruckerAvailable()`. **Pairing/MAC:** erst in Hardware-Phase (A), nicht in I2-B. | Hardware/Plugin folgt nach I2-Basis. |
| **Etikettendesign / QR** | Wie Druckvorlagen: **mandantenweites Layout** (1 Layout), **SW-Thermo** zuerst; **Presets max/mid/mini** (Bixolon 2″, siehe unten); **separates Etiketten-Logo** (`label_logo_storage_path` o. ä.). **Feldinhalte:** Details später. **Vorschau:** ja. **Kundenportal:** kein Etikettendruck. **Render:** **ein** farbfähiges Layout (Logo/Farben); Thermodruck = **Graustufen** derselben Vorlage. **A4-Farbbatch (später):** **eine PDF** mit vielen QR; Objekt-**Mehrfachauswahl** nur **Haupt-App**. **Berechtigung (Entscheidung A):** eigenes **Lizenz-Feature** (Arbeitsname z. B. `qr_batch_a4`) **pro Mandant/Lizenz** im Lizenzportal; **zusätzlich** nur **Rollen**, die der **Admin** für dieses Modul freigibt (Konfiguration im Admin/Lizenz-UI – Detail bei Umsetzung). **A4-Bögen:** Referenz-Artikel siehe Tabelle unten. **Rollen (Mobil):** Thermodirekt **58 mm** usw. siehe unten. | **Vico.md §11.4**; siehe Abschnitt „A4-Referenzetiketten“. |
| **PDF-Briefbogen** | **B:** Einheitliche Briefbogen-Logik auf **allen Ebenen** – **Haupt-App**, **Arbeitszeit-Portal-Exporte**, **Kundenportal** (`portal/`), ggf. weitere PDF-Generatoren; gemeinsame Hilfsfunktion + **ein** Speicherort pro Mandant (z. B. `briefbogen_storage_path` / Design-Config). **Upload (jetzt):** **A – eine Quelle** (Lizenzportal/Mandanten-Design **oder** Haupt-App Admin, nicht im Kundenportal); Portal nur Nutzung. **Später:** Verlagerung in **Mandanten-Self-Service**; Optionen offen: **einfacher Upload**, **kleiner Editor**, oder **Briefbogen-Generator** mit Platzhaltern aus Stammdaten – **gesondertes Detailthema** nach Abschluss der übrigen Entscheidungsrunde. | Siehe **Vico.md §11.2**. |
| **GPS Stempel-Ortung** | **C:** Debug **später** (nach Live-Gang erneut prüfen); **Beta-Kennzeichnung** in UI. | `shared/BetaBadge.tsx`, Arbeitszeit, Einstellungen, Portal Alle Zeiten (Hinweis). |
| **Standortabfrage (Recht / Go-Live)** | **B (minimal):** **Interne Checkliste** (§3a) abarbeiten, UI **Beta**, Feature nur mit **bewusstem** Lizenz-Flag `standortabfrage`. **Externe DS-Prüfung** nicht verpflichtend in dieser Runde. Thema **bleibt auf der Liste** (§3a, Merkliste), bis produktiv geklärt. | Portal `Standort.tsx`, Einstellungen, `CurrentLocationModal`. |
| **IONOS / Deploy** | **C (später):** Umzug bzw. produktives Hosting auf **IONOS Deploy Now** (o. Ä.) **bewusst zurückstellen**; vorerst weiter mit bestehender/lokaler Umgebung. Anleitung bleibt in `docs/Zeiterfassung-Offene-Punkte-und-IONOS.md` §7. | |

#### Bixolon 2″ – Referenzmaße für Presets **mini / mid / max** (Planung)

Bixolon-Mobile-Drucker der 2″-Klasse (z. B. SPP-R200III / SPP-R210) nutzen typisch **Rollenbreite 58 mm** (teilw. 50 mm); der **bedruckbare Bereich** liegt oft bei ca. **48 mm** Breite – Layout und QR müssen darin liegen, auch wenn das Trägermaterial breiter ist.

| Preset | Vorschlag Maße (B×H) | Nutzung |
|--------|----------------------|---------|
| **mini** | **50 × 25 mm** | Kompakt: kleiner QR, 1 Textzeile |
| **mid** | **50 × 30 mm** | Standardfeld: QR + 2 Zeilen |
| **max** | **58 × 40 mm** | Max. auf gängiger 58-mm-Rolle: größerer QR + mehr Text |

**Hinweis:** Konkrete Rollen/Etiketten je nach Lieferant leicht abweichend – Presets beim Kauf der **referenzierten Bixolon-Medien** verifizieren und ggf. auf **mm** in der Config feinjustieren.

#### A4-Referenzetiketten (Farbe, QR-Sammel-PDF) – Annäherung an Mobil-Presets

Für den **späteren** Batch-Export auf **A4** (Laser/Farbe) eignen sich handelsübliche Bögen, deren **Zellgröße** den Thermo-Presets **ähnelt** (exakt gleich ist selten nötig – Layout pro Artikel in Vico kalibrierbar).

| Preset (Mobil) | Ziel ca. | Beispiel **HERMA** (A4, wiederfindbar) | Alternativ **Avery** |
|----------------|----------|----------------------------------------|----------------------|
| **mini** (~50×25 mm) | klein, viele pro Blatt | **48,3 × 25,4 mm:** z. B. **5051**, **4608**, **10726** (Packungsgrößen unterscheiden sich) | **L4736REV-25:** **45,7 × 21,2 mm**, 48 Etiketten/Blatt (etwas kleiner) |
| **mid** (~50×30 mm) | Standard-Zelle | **52,5 × 29,7 mm:** z. B. **4610**, **4461**; Folie z. B. **4684** | Avery-Zweckform-Größen in gleicher Klasse (Hersteller-Vorlage wählen) |
| **max** (~58×40 mm) | größere Zelle | **63,5 × 38,1 mm:** z. B. **5029**, **4677**, **10301**, **10727**, **8632** (nicht exakt 58×40, aber nächstgrößeres Standardformat) | z. B. **L7163** (übliches 63,5×38,1-Raster) |

**Rollen für Bixolon (Thermodirekt):** Beim Etikettenhändler nach **„58 mm Breite, Thermodirekt, Höhe 25 / 30 / 40 mm, Kern 12 mm (bzw. laut Druckerhandbuch)“** fragen; **max. Rollendurchmesser** beachten (mobil begrenzt). Kein einzelner Hersteller-Artikel in der Suche verbindlich – **mit gekaufter Rolle** die mm in Vico abstimmen.

**Batch-Berechtigung (Umsetzung):** **Option A** – **Lizenz-Feature** (z. B. `qr_batch_a4`) **und** vom **Admin** festgelegte **erlaubte Rollen** (beides muss erfüllt sein). Umsetzung: Lizenzportal + Haupt-App.

---

### Planung: Resturlaub Vorjahr (VJ), Frist & Hinweispflicht (Urlaub)

**Hinweis:** Keine Rechtsberatung – verbindliche Klärung mit **Fachanwalt Arbeitsrecht** / Betriebsrat / Tarifvertrag.

#### Rechtliche Einordnung (kurz, für Produktentscheidungen)

- **BUrlG:** Regel ist, Jahresurlaub im Kalenderjahr zu nehmen; **Übertrag** ins Folgejahr nur ausnahmsweise bei **dringenden** betrieblichen oder **persönlichen** Gründen (§ 3 Abs. 1, § 7 Abs. 3 BUrlG). Übertragener Rest wird in der Praxis oft mit **31.03.** des Folgejahres in Verbindung gebracht – **konkrete Frist** kann durch **Tarifvertrag / Betriebsvereinbarung / Arbeitsvertrag** abweichen (günstiger für Arbeitnehmer möglich).
- **EU-Recht / Rechtsprechung (EuGH, BAG):** Urlaub ist Mindestrecht; **Verfall** und **Verjährung** von Urlaubsansprüchen setzen voraus, dass der **Arbeitgeber** den Arbeitnehmer **konkret** über **Bestand**, **Möglichkeit zur Erholung** und **Verfallsfolgen** informiert hat (**individuell**, nicht nur allgemeiner Verweis). Fehlt eine **nachweisbare** Hinweis-/Belehrungspraxis, können Ansprüche **fortbestehen** (Detail immer einzelfallabhängig).
- **Fazit für Vico:** Die Software soll **Resturlaub VJ** abbilden, **optionale Frist** (Mandant) unterstützen und **Hinweise** dokumentieren – **kein** automatisches „Urlaub verfällt heute“ ohne **rechtliche Prüfung** durch den Betreiber. **Beweislast** zur Hinweiserteilung liegt beim Arbeitgeber; sinnvoll sind **Audit-Logs** / **Nachweise** (siehe Umsetzung).

#### Ist-Stand im Code (Stand März 2026)

- Tabelle **`leave_entitlements`** (`user_id`, `year`, `days_total`, **`days_carried_over`**) existiert in `supabase-complete.sql`, wird bei Urlaubs-Stammdaten-Update aber noch mit **`0`** geführt.
- Portal **`Urlaub.tsx`:** „Resturlaub“ = nur **Jahresanspruch minus genehmigte Urlaubstage im gewählten Jahr** – **ohne** echtes **VJ** und ohne Frist.

#### Vorschlag Funktionsumfang

| Baustein | Inhalt |
|----------|--------|
| **Resturlaub VJ** | Pro Jahr/Mitarbeiter: `days_carried_over` aus Vorjahr **explizit** führen; Anzeige **„Resturlaub VJ“** getrennt vom **aktuellen Jahresrest**. |
| **Frist (optional, Mandant)** | z. B. `admin_config` oder Lizenz-Design: **„Resturlaub VJ bis (Datum)“** pro Kalenderjahr oder globaler Default (Vorschlag Default **31.03.** nur als Startwert, überschreibbar). |
| **Hinweis an Mitarbeiter** | In **Arbeitszeit-Portal** (und ggf. E-Mail später): sichtbarer Text mit **Tagen VJ**, **Fristdatum**, Standardformulierung „bitte rechtzeitig beantragen“ – Textvorlage **extern prüfen lassen**. |
| **Nachweis / Audit (empfohlen)** | Tabelle oder Einträge: **wann** welcher Nutzer welchen **Hinweis** (welche Tage, welche Frist) **in der App** gesehen hat (`acknowledged_at`), optional Export für HR. |
| **Kein blindes Verfallen** | App soll nach Frist **warnen** (Admin-Dashboard), aber **nicht** ohne Konzept **Tage automatisch löschen** – Verfall ist **Rechtsfolge**, nicht nur Datenbank-Delete. |

#### Getroffene Entscheidungen (März 2026)

| # | Thema | Entscheidung |
|---|--------|--------------|
| 1 | **Übertrag Resturlaub VJ** | **Automatik:** zum **01.01.** aus dem berechneten Rest des **Vorjahres** in `days_carried_over` (bzw. gleichwertige Logik) übernehmen. |
| 2 | **Frist Resturlaub VJ** | **Global** für den **ganzen Mandanten**; **zusätzlich** pro **Mitarbeiter** **überschreibbar** (optionaler Override in Stammdaten/Profil). |
| 3 | **Tarif / abweichende Frist** | In der Planung **keine** Sonderlogik für häufig abweichende TV-Fristen; Mandanten setzen Frist global bzw. pro Person. |
| 4 | **Nachweis Hinweis** | **In-App** inkl. **Bestätigung („verstanden“)** reicht für v1; **E-Mail/PDF-Archiv** als **Option** in der Planung **behalten**. |
| 5 | **Ausstehende Anträge** | **Ausstehende** Urlaubsanträge **reduzieren** die angezeigten **verfügbaren** Tage (Vorschau: „nach diesem Antrag noch X Tage“). Bei **Ablehnung** werden die Tage **wieder frei**. **Genehmigte** Anträge reduzieren endgültig; nur **Urlaub**-Typ (nicht Krank/sonstiges) gegen Urlaubskontingente rechnen, sofern nicht anders definiert. |
| 6 | **Verbrauchsreihenfolge (genehmigte Tage)** | Feste Reihenfolge: **(1)** **Zusatzurlaub**-Posten mit **frühestem Ablaufdatum** zuerst, **(2)** **Resturlaub VJ**, **(3)** **laufender Jahresurlaub** / Jahresanspruch. Innerhalb gleicher Kategorie nach **Ablaufdatum** bzw. **Frist** (FIFO). |
| 7 | **Mehrere Zusatzurlaubs-Posten** | **Ja:** **mehrere** Zusatzurlaubs-Blöcke pro Mitarbeiter (Tage + Ablaufdatum je Posten); UI und Datenmodell darauf auslegen. |
| 8 | **„Wie gesetzlicher Urlaubsanspruch“** | **Separater Topf** im System (**nicht** in `days_total` / Jahresanspruch **einschmelzen**). Wenn Option aktiv: **gleiche Regeln** wie normaler Urlaub (Hinweispflicht, Übertrag/Frist-Logik **parallel** auf diesen Topf). Anzeige kann **Summe** + **Aufschlüsselung** zeigen. |
| 9 | **Teilablehnung** | **Ja:** Urlaubsanträge **teilweise** genehmigen können; nur **genehmigte** Kalendertage belasten Kontingente / Pending; **nicht genehmigte** Tage bleiben **frei** (analog vollständiger Ablehnung). |

#### Zusatzurlaub (Planung – Entscheidungen eingearbeitet)

Viele Verträge: **gesetzlicher Mindesturlaub** + **X Tage Zusatzurlaub**, **bis Datum Y** zu nehmen, sonst Verfall (sachverhaltsabhängig – **Texte extern prüfen**).

| Feld / Logik | Beschreibung |
|--------------|--------------|
| **Zusatzurlaub** | Eigener **Bestand** (Tage) + **Ablaufdatum** pro **Posten**; **mehrere Posten** pro Mitarbeiter möglich (s. Entscheidung #7). |
| **Option „wie gesetzlicher Urlaubsanspruch“** | **Separater Topf**, **gleiche** Hinweis-/Übertrag-/Fristlogik wie Jahresurlaub wenn aktiv (s. Entscheidung #8). |
| **Hinweis / Verfall** | Analog zu Vico-Grundsatz oben: **kein** stillschweigendes Löschen ohne Betreiber-Konzept; **Warnungen** und dokumentierte Hinweise. |

---

## 1. Arbeitszeitenportal – Inhalte aufbauen ✅ erledigt (März 2025)

Das Portal läuft unter `arbeitszeit-portal/` (Port 5176). **Umsetzung abgeschlossen:**

| Seite | Status |
|-------|--------|
| **Alle Zeiten** | ✅ Benutzer-Dropdown, Tag/Woche/Monat, Zeiteinträge, Bearbeiten-Modal (Start/Ende, Grund). |
| **Log** | ✅ Filter (Zeitraum, Benutzer), Paginierung, Tabelle. |
| **Stammdaten AZK** | ✅ Liste Mitarbeiter, Soll Min/Monat pro Zeile bearbeiten und speichern. |
| **Übersicht** | ✅ Karten-Links zu den drei Bereichen. |

**Später:** Teamleiter-Rolle im Portal freischalten, sobald Rolle „teamleiter“ im Haupt-Projekt existiert (siehe §2). Optional: Soll Std/Woche oder Std/Tag in Stammdaten ergänzen.

---

## 2. Zeiterfassung – Konzeptionell & optional

| Thema | Offen | Priorität |
|-------|--------|-----------|
| **Rechte** | Rechte-Konzept ggf. überarbeiten (wer sieht/bearbeitet was). | Niedrig |
| **Rolle Teamleiter** | Eigene Rolle „teamleiter“: sieht/bearbeitet nur Zeiten des zugewiesenen Teams. Dafür: Zuordnung User → Teamleiter oder Team → Mitglieder im Schema/UI. | Optional |
| **Abwesenheits-Grund** | Optionaler Grund für Tage ohne Erfassung (Dienstreise, Homeoffice, Schulung). | Optional |
| **Freie Tage – Ereignis-Auswahl** | Bei Freie Tage (Betriebsferien, Brückentage): Auswahl vordefinierter Ereignisse/Typen statt nur Freitext. | Offen |
| **Soll täglich/wöchentlich** | Ort für tägliche/wöchentliche Soll-Arbeitszeit (z. B. „Soll Std/Woche“ in Stammdaten AZK); Monatssoll daraus berechnen oder weiter separat. | Optional |
| **Auftragszuordnung** | **Entscheidung:** entfernt (UI/Code) – **`Vico.md` §11.1** Punkt 7; operative Details `docs/Zeiterfassung-Offene-Punkte-und-IONOS.md`. | ✅ |

---

## 3. Ortung (GPS) – genaue Prüfung erforderlich

**Entscheidung (März 2026):** Gezieltes Debugging **zurückgestellt (C)**. UI kennzeichnet Stempel-Ortung als **Beta** (Haupt-App Arbeitszeit, Einstellungen, Hinweis im Arbeitszeit-Portal **Alle Zeiten**). **Erneute Prüfung nach Live-Gang**; in der **lokalen Entwicklungsumgebung** (Browser, HTTPS, Netzwerk) sind Abweichungen möglich.

**Problem (für spätere Analyse):** GPS-Einträge werden ggf. trotz Einwilligung nicht angezeigt.

**Zu prüfen:**

| Prüfpunkt | Beschreibung |
|-----------|-------------|
| **Browser-Berechtigung** | Standort-Zugriff in den Website-Einstellungen (Adressleiste → Schloss/Symbol) prüfen. |
| **HTTPS** | Dev-Server nutzt HTTPS (basicSsl). Bei Zugriff über IP: `https://192.168.x.x:5173` – Zertifikatswarnung bestätigen, dann funktioniert Standort. |
| **Datenbank-Spalten** | `time_entries` muss `location_start_lat`, `location_start_lon`, `location_end_lat`, `location_end_lon` haben (supabase-complete.sql Zeilen 566–569). |
| **Profil** | `profiles.gps_consent_at` gesetzt und `gps_consent_revoked_at` null? |
| **Browser-Konsole** | Bei Stempeln: `[Geolocation] Fehler: permission_denied | timeout | …`? |
| **Info-Toast** | Erscheint „Standort konnte nicht ermittelt werden“ → Ortung wird versucht, schlägt aber fehl. |

**Standortabfrage (employee_current_location):** Wenn „Standort senden“ funktioniert, aber im Arbeitszeitenportal nichts erscheint: Haupt-App und Portal müssen dieselbe Supabase nutzen. Häufig: **Ortung** (Stempeln) ≠ **Standortabfrage** – für die Standort-Seite muss die Einwilligung „Standortabfrage – Ihre Einwilligung“ in Einstellungen erteilt sein. Siehe `docs/Standort-Abfrage-Arbeitszeitenportal.md` § Fehlerbehebung.

**Referenz:** **`Vico.md` §11.7** (Ortung/GPS; ehem. ausführliches Doc unter `docs/`).

---

## 3a. Standortabfrage – Rechtliche Prüfung (DSGVO, gesetzliche Vorgaben)

**Entscheidung (März 2026):** **Option B** – zuerst **interne Checkliste** (Tabelle unten) und **Beta-Kennzeichnung** in der UI; **kein** vollständiger externer DS-Aufwand als Pflicht in dieser Runde. **Produktiver Einsatz** nur, wenn Betreiber/Kunde die Punkte bewusst freigibt; Feature über Lizenz **`standortabfrage`** steuerbar. Dieser Abschnitt **bleibt auf der Liste**, bis alles geklärt ist.

**Hinweis:** Die **Standortabfrage** (Mitarbeiter sendet manuell aktuellen Standort an Admin/Teamleiter) ist ein separates Feature zur Zeiterfassungs-Ortung (**§11.9**). Vor **produktivem** Einsatz sollten die gesetzlichen Vorgaben geprüft und umgesetzt werden.

| Prüfpunkt | Beschreibung |
|-----------|-------------|
| **Informationspflicht (Art. 13 DSGVO)** | Nutzer muss **vor** der ersten Nutzung informiert werden: Zweck, Rechtsgrundlage, Speicherdauer, Empfänger, Rechte, Widerruf, Verantwortlicher. |
| **Einwilligung** | Explizite Einwilligung erforderlich? Wenn ja: freiwillig, jederzeit widerrufbar, vor Nutzung einholen. |
| **Was vor DSGVO-Konformität?** | Informationsblatt/Modal mit allen Pflichtangaben; aktive Bestätigung (Checkbox + Button); Speicherung von Einwilligung (Zeitstempel); Widerrufsmöglichkeit in Einstellungen. |
| **Betriebsrat (BetrVG § 87 Abs. 1 Nr. 6)** | Mitbestimmung bei technischer Überwachung – ggf. Betriebsvereinbarung erforderlich. |
| **DSFA (Art. 35 DSGVO)** | Datenschutz-Folgenabschätzung bei systematischer Standorterfassung – hohes Risiko, in der Regel Pflicht. |
| **Speicherdauer** | Wie lange werden Standortdaten in `employee_current_location` aufbewahrt? Löschkonzept definieren. |

**Referenz:** `docs/Zeiterfassung-Ortung-GPS-Recht-und-Planung.md` (analog für Ortung; Standortabfrage hat eigenen Kontext: manuelle Abfrage vs. automatische Erfassung bei Stempeln).

| Offener Punkt | Optionen | Referenz |
|---------------|----------|----------|
| **Standortabfrage im Hintergrund** | Web/PWA: nicht möglich. Native App (Capacitor + Plugin): möglich, aber aufwändig. | `docs/Standort-Abfrage-Arbeitszeitenportal.md` § Offene Punkte |
| **Standortabfrage nur bei Arbeitszeit** | A) Jederzeit (aktuell). B) Nur wenn Mitarbeiter eingestempelt ist. | `docs/Standort-Abfrage-Arbeitszeitenportal.md` § Offene Punkte |

---

## 3b. Teamleiter nur für Admin sichtbar (ggf. später)

**Hinweis:** Einstellung war vorübergehend implementiert, wurde zurückgenommen. Bei Bedarf später wieder aufnehmen.

| Beschreibung |
|--------------|
| Wenn aktiv: Teamleiter werden in Benutzerlisten (z.B. Arbeitszeitenportal) nur dem Admin angezeigt, nicht anderen Teamleitern oder Mitarbeitern. |
| DB: `admin_config` mit key `teamleiter_visible_only_to_admin`; RPCs `get_teamleiter_visible_only_to_admin`, `set_teamleiter_visible_only_to_admin`. |
| Portal: Filter in AlleZeiten, Log, Urlaub, Stammdaten anwenden. |

---

## 4. Zeiterfassung – Feature-Liste

**Vollständige Liste:** `docs/Arbeitszeit-Feature-Liste.md`

**Priorität Hoch (empfohlene Reihenfolge):**
1. ✅ ArbZG-Vorschlag automatisch („Pause jetzt starten?“ bei >6 h)
2. ✅ Genehmigungsworkflow
3. ✅ Export CSV/Excel
4. ✅ „Vergessen auszustempeln“-Erinnerung
5. ✅ Pausen-Mindestdauer 15 Min

**Priorität Mittel/Niedrig:** siehe Feature-Liste – spätere Entscheidung über zusätzliche Realisierung.

---

## 5. Haupt-App – Aufräumen ✅ erledigt (März 2025)

In der Haupt-App wurde `Arbeitszeit.tsx` dauerhaft bereinigt (siehe `docs/Arbeitszeit-Umstrukturierung-Portal.md` §6):

- [x] Benutzer-Dropdown, Tabs Woche/Monat/Log, Bearbeiten-Modal entfernt – nur Tag-Ansicht mit Datumsauswahl.
- [x] Komponenten `Wochenansicht`, `Monatsansicht`, `LogAnsicht` gelöscht.
- [x] Imports und Aufrufe von `updateTimeEntryAsAdmin`, `fetchTimeEntryEditLog`, `fetchProfiles`, `fetchOrders`, `fetchOrdersAssignedTo`, `getProfileDisplayName` aus der Zeiterfassungs-Seite entfernt.

**Hinweis:** Auftragszuordnung bleibt per `SHOW_ORDER_ASSIGNMENT = false` ausgeblendet; bei `true` würde nur `startTimeEntry(userId, orderId)` genutzt (Orders-Fetch derzeit nicht eingebaut).

---

## 6. Roadmap Vico (A–J, Lizenzportal) – noch offen

Aus **Vico.md** §7.1 – Punkte **ohne** ✅ (bereits erledigt):

| Phase | Nr. | Offener Punkt | Aufwand |
|-------|-----|----------------|---------|
| **J** | J1 | Wartungsplanung / Erinnerungen (z. B. 30 Tage vorher), optional E-Mail | 3–5 T |
| **J** | J2 | Wartungsstatistik / Auswertung (pro Kunde/BV/Objekt, überfällige Wartungen) | 3–4 T |
| **J** | J3 | Export für Buchhaltung (CSV/Excel) | 2–3 T |
| **J** | J4 | Schnellzugriff / Zuletzt bearbeitet auf Startseite | 1–2 T |
| **J** | J5 | ✅ Erweiterte Filter Kundenliste (PLZ, Wartungsstatus, BV-Anzahl) | 2 T |
| **J** | J6 | ⏸️ **Zurückgestellt** – eigenes Konzept (Ablauf/Struktur) nach Rest der Roadmap; geschätzt 15–20 T wenn angegangen | 15–20 T |
| **J** | J7 | Geplant: **1)** Mängel-Follow-up **2)** Bulk **3)** Portal-Push — **ohne** iCal (siehe Entscheidungstabelle) | je 2–3 T |
| **J** | J9 | ✅ Ladezeiten-Monitoring / Performance-Dashboard (Admin) | 1–2 T |
| **J** | J10 | PDF-Ausgabe mit Mandanten-Briefbogen (Wartungsprotokolle, Zoll-Export etc. auf Firmenbriefbogen) | 1–2 T |

**Referenz J10:** **`Vico.md` §11.2** (Mandanten-Briefbogen für PDFs)

**Lizenzportal (operativ):** B3/L1 – separates Supabase-Projekt für Lizenzportal anlegen und Schema einspielen (falls noch nicht geschehen). L2/L3 ggf. bereits erledigt (laut Roadmap ✅).

---

## 7. IONOS Hosting & Projektüberarbeitung

**Entscheidung (März 2026):** **IONOS-Deploy zunächst nicht** (Option **C – später**); siehe Entscheidungstabelle oben. Die folgende Tabelle bleibt als **Referenz**, wenn ihr umzieht.

| Aufgabe | Beschreibung |
|---------|---------------|
| **IONOS Deploy** | Frontend (Haupt-App, Admin, Portal, Arbeitszeitenportal) per Deploy Now + GitHub; Env-Variablen setzen. Siehe `docs/Zeiterfassung-Offene-Punkte-und-IONOS.md` §7. |
| **Projektüberarbeitung** | Struktur prüfen, Ungenutztes entfernen, **Performance-Optimierung** (laut ursprünglicher Planung nach Abarbeitung der Zeiterfassung-Punkte). |

---

## 8. Merkliste – Operative Schritte (später ausführen)

| Aufgabe | Befehl / Hinweis |
|---------|------------------|
| **Supabase CLI installieren** | `sudo npm install -g supabase` (im eigenen Terminal ausführen, Passwort eingeben) |
| **Edge Function update-impressum deployen** | `cd supabase-license-portal && supabase functions deploy update-impressum --project-ref <projekt-ref>` (nach CLI-Install) |
| **RPC update_profile_soll_minutes** | In Supabase SQL Editor: Funktion `update_profile_soll_minutes` aus `supabase-complete.sql` ausführen, damit Sollwerte aus dem Arbeitszeitenportal in der Haupt-App ankommen |
| **Genehmigungsworkflow** | ✅ Erledigt – Spalten `approval_status`, `approved_by`, `approved_at` in `time_entries`; UI im Arbeitszeitenportal (AlleZeiten). |

---

## 9. Grenzüberschreitungen, Sollwerte, Saldo/Soll – Prüfung

| Thema | Status | Beschreibung |
|-------|--------|--------------|
| **Grenzüberschreitungen → Lizenzportal** | ✅ behoben | Netlify-Funktion `limit-exceeded` ergänzt (`admin/netlify/functions/limit-exceeded.ts`). Haupt-App und Kunden senden `reportLimitExceeded` an `{VITE_LICENSE_API_URL}/limit-exceeded`. Redirect in `netlify.toml` hinzugefügt. Nach Deploy: Grenzüberschreitungen landen in `limit_exceeded_log`. |
| **Sollwerte Arbeitszeit-Portal → Zeiterfassung** | ✅ behoben | RPC `update_profile_soll_minutes` (SECURITY DEFINER) umgeht RLS; Portal nutzt RPC statt direktem `profiles`-Update. Haupt-App: Profil wird bei Tab-Fokus neu geladen. **Wichtig:** Portal und Haupt-App müssen dieselbe DB nutzen (`VITE_SUPABASE_URL` = Haupt-App-Supabase, nicht Lizenzportal). |
| **Saldo und Soll (AZK-Box)** | ✅ geprüft | Berechnung korrekt: Soll aus Profil, Ist = Summe `calcWorkMinutes` für Monat, Saldo = Ist − Soll. `monthWorkMinutes` filtert nach `selectedDate.slice(0, 7)`, Daten werden für Monat geladen. |

**Referenz:** `src/Arbeitszeit.tsx`, `arbeitszeit-portal/src/lib/userService.ts`, `src/lib/userService.ts`, `src/lib/licensePortalApi.ts`.

**Später prüfen:**
- [ ] **Grenzüberschreitungen im Lizenzportal** – Prüfen, ob Meldungen ankommen: Edge Function `limit-exceeded` deployed? `VITE_LICENSE_API_URL` in Haupt-App gesetzt? Lizenz in `licenses` vorhanden? Siehe `docs/Lizenzportal-Setup.md` § Fehlerbehebung Grenzüberschreitungen.

---

## 10. Soll-Berechnung, Urlaub & Compliance (geplant)

**Vollständige Planung:** `docs/Arbeitszeit-Soll-Urlaub-Planung.md`  
**Rechtliche Prüfung:** `docs/Arbeitszeit-Rechtliche-Compliance.md`

| Phase | Inhalt |
|-------|--------|
| **Phase 1** | ✅ Soll-Berechnung: Feiertage, Bundesland, Arbeitstage, Std/Tag, mandantendefinierte freie Tage |
| **Phase 2** | ✅ Urlaubsverwaltung: Anträge, Genehmigung, Anspruch, Resturlaub, Abwesenheitsarten |
| **Phase 3** | ✅ Compliance: Export für Zollprüfung (CSV/PDF), Aufbewahrung (8 Jahre, UI-Hinweis), Urlaubsbescheinigung bei Austritt, Hinweis Aufzeichnung bis 7. Tag |

**Compliance-Empfehlungen (in Planung):**
- Export CSV/PDF für Zoll-/Mindestlohnprüfung
- Aufbewahrung: Keine automatische Löschung; Hinweis „mind. 8 Jahre“; optional konfigurierbare Retention-Policy
- Urlaubsbescheinigung bei Austritt (§ 6 Abs. 2 BUrlG)
- Hinweis „Aufzeichnung bis 7. Tag“ (MiLoG § 17)

---

## 11. Dokumentation – noch zu schreiben

| Thema | Ziel | Basis (bereits vorhanden) |
|-------|------|---------------------------|
| **Anleitung: App-Updates & getrennte Releases** | **Schritt-für-Schritt** für dich (und spätere Übergabe): wann `package.json`-Version und welches `release-notes.json`; **nur eine** Teil-App deployen; wann trotzdem **Supabase/Migration** dazu gehört; kurzes **Beispiel** (z. B. „nur Portal geändert“). Ziel: besseres Verständnis neben der technischen Doku. | **`docs/App-Updates-und-Versionierung.md`**, **`docs/Release-Checkliste.md`**, Code: `scripts/vite-plugin-version.mjs`, `shared/UpdateBanner.tsx` |

**Vorschlag Datei:** `docs/Anleitung-App-Updates-fuer-Betrieb.md` (oder Abschnitt in eurer internen Wiki/Benutzerdoku).

- [ ] Anleitung **App-Updates & Versionierung** ausarbeiten (siehe Tabelle oben).

---

## Empfohlene Reihenfolge

**Konsolidierter Roadmap-Vorschlag (Phasen 0–7, begründet):** **`docs/Roadmap-Abarbeitung-Vorschlag.md`** – daraus die nächsten Sprint-Ziele ableiten; die nummerierte Liste unten bleibt als **kurze** operative Checkliste.

1. **Grenzüberschreitungen** (§9): Netlify-Funktion ist implementiert – Admin deployen, damit Meldungen ans Lizenzportal gehen.
2. **Sollwerte & Saldo** (§9): Prüfen, ob Soll aus dem Arbeitszeit-Portal in der Zeiterfassung ankommt; Saldo-Berechnung verifizieren.
3. **Zeiterfassung Top-5** (§4): ✅ Alle erledigt – ArbZG-Vorschlag, Genehmigungsworkflow, Export CSV/Excel, Vergessen-Erinnerung, Pausen 15 Min (siehe Feature-Liste).
4. **Ortung (GPS) prüfen** (§3): Warum werden GPS-Einträge trotz Einwilligung nicht angezeigt? Checkliste durchgehen.
5. **Standortabfrage – Rechtliche Prüfung** (§3a): DSGVO-Informationspflicht, Einwilligung, DSFA, Betriebsrat – vor produktivem Einsatz prüfen.
6. **Arbeitszeitenportal befüllen** (§1): Alle Zeiten + Bearbeiten, Log, Stammdaten AZK – damit Admin/Teamleiter das Portal voll nutzen können.
7. **Auftragszuordnung** entscheiden (§2): einblenden oder aus Haupt-App/Portal-Code entfernen.
8. **Optional:** Haupt-App Aufräumen (§5), dann ggf. Teamleiter-Rolle und Soll Woche/Tag (§2).
9. **Roadmap J** und IONOS/Performance (§6, §7) nach Priorität.
10. **Anleitung App-Updates** (§11): verständliche Schritt-für-Schritt-Anleitung ergänzen, wenn du die nächsten Releases planst.
