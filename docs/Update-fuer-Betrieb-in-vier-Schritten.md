# App-Update: Zielbild in vier Schritten

So soll sich der Ablauf **für dich** anfühlen:

| Schritt | Was du willst |
|--------|----------------|
| **1** | Update „zusammenstellen“ – erscheint im Lizenzportal als Release (Version, Notizen). |
| **2** | Im LP auswählen: **bestimmte Mandanten** oder **alle**. |
| **3** | Mandanten-Apps zeigen: **Neues Update – jetzt oder später neu laden** (Banner / Hinweis). |
| **4** | Fertig. |

Das ist das **richtige Zielbild**. Technisch steckt **eine** feste Grenze dahinter, die man nicht wegdiskutieren kann:

- **Neuer Programmcode** (JavaScript) liegt bei **Cloudflare Pages** – **ein** Build pro App-Typ (Haupt-App, Kundenportal, Arbeitszeitenportal) für **alle** Mandanten auf derselben URL.
- Das **Lizenzportal** steuert: **welches Release** die Lizenz-API meldet, **für wen**, und **wann** die Apps nachziehen sollen (`client_config_version`, Zuweisungen, Banner).

Ohne **einen** erfolgreichen **Deploy** nach dem Release gibt es **keinen** neuen Code – dann kann das LP nur **Anzeigen und Vorbereitung**, aber keine echte neue App-Version ausliefern.

---

## IST (kurz): was heute noch „dazwischen“ ist

| Dein Schritt | Heute oft noch nötig | Warum |
|--------------|----------------------|--------|
| 1 – Release im LP | SQL oder GitHub-Sync ins LP | Release-Datensatz + ggf. Default-Versionen in der DB. |
| (zwischen 1 und 2) | **GitHub → Cloudflare** einmal pro App | Liefert die **tatsächliche** neue Version (`version.json` / Bundle). |
| 2 – Mandanten wählen | Zuweisungen pro Mandant **oder** SQL „alle auf neuestes Release“ | Mehrere Klicks oder ein SQL-Lauf. |
| 3 – Hinweis bei Mandant | Meist automatisch nach Zuweisung + Reload; Cache kann bremsen | Lizenz-API + Banner; harter Reload hilft. |

---

## Nächste Produkt-Richtung (damit es wieder wie 1–4 wirkt)

- **Ein** geführter Ablauf im LP (Assistent): *Release → optional Deploy anstoßen → Mandanten wählen (Alle / Auswahl) → Go-Live* – **ohne** SQL für den Standardfall.
- Release weiterhin aus **Git-Tag / CI** füttern, aber **sichtbar** als ein Schritt „Update übernehmen“.

Bis das gebaut ist: die Datei **`docs/sql/LP-rollout-all-tenants-latest-published.sql`** ist der schnellste Weg für Schritt **2 „alle“** nach einem freigegebenen Release.

---

*Verweis: technische Details `docs/Diagnose-App-Version-Rollout.md`, Planung `docs/Planung-Releases-GitHub-Lizenzportal.md`.*
