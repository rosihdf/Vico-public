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
| 2 – Mandanten wählen | Im LP **Rollout & Deploy** → **Go-Live** (alle oder Auswahl), **oder** Zuweisung pro Mandant, **oder** SQL-Bulk | Standardfall ohne SQL über die Rollout-Seite. |
| 3 – Hinweis bei Mandant | Meist automatisch nach Zuweisung + Reload; Cache kann bremsen | Lizenz-API + Banner; harter Reload hilft. |

---

## Nächste Produkt-Richtung (damit es wieder wie 1–4 wirkt)

- **Go-Live im LP:** Auf der Seite **Rollout & Deploy** (Lizenzportal-Admin) kann für ein **freigegebenes** Release optional zuerst der **Production-Deploy** angestoßen werden; darunter **Go-Live für Mandanten**: **alle** oder **Auswahl** – **ohne** SQL im Standardfall.
- Der **Rollout-Assistent (Checkliste)** und weitere Vereinfachungen ergänzen den Ablauf; Release weiterhin aus **Git-Tag / CI** füttern, **sichtbar** als Schritt „Update übernehmen“.

**Fallback** (ohne UI, z. B. Automatisierung): **`docs/sql/LP-rollout-all-tenants-latest-published.sql`** für Schritt **2 „alle“** nach einem freigegebenen Release.

---

*Verweis: technische Details `docs/Diagnose-App-Version-Rollout.md`, Planung `docs/Planung-Releases-GitHub-Lizenzportal.md`.*
