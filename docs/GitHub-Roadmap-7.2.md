# Roadmap §7.2 → GitHub Issues / Project

Spiegelt die offenen Punkte aus **`Vico.md` §7.2** nach GitHub.

## Voraussetzungen

1. [GitHub CLI](https://cli.github.com/) installieren: `brew install gh`
2. Anmelden: `gh auth login`
3. Im Repo-Root: `./scripts/gh-roadmap-issues.sh`  
   Oder nur anzeigen (Dry-Run): `./scripts/gh-roadmap-issues.sh --dry-run`

Optional **Labels** einmalig anlegen (das Skript versucht sie anzulegen):

| Label | Farbe (Vorschlag) |
|-------|-------------------|
| `roadmap` | `#0366d6` |
| `lizenzportal` | `#5319E7` |
| `hauptapp` | `#0E8A16` |
| `mobile` | `#FBCA04` |

## GitHub Project (Board)

1. Repository → **Projects** → **New project** (Table oder Board).
2. Spalten z. B.: **Backlog** → **Bereit** → **In Arbeit** → **Erledigt**.
3. Nach dem Anlegen der Issues: Issues per Drag & Drop ins Projekt ziehen oder **Automation**: „Status“ aus dem Board mit Issues verknüpfen.

Alternativ: **Milestones** pro Quartal anlegen und Issues zuordnen.

## Issues (Referenz)

| ID | Titel (kurz) |
|----|----------------|
| L4 | Logo-Upload im Lizenzportal |
| J10 | Bug-Erfassungsmodul |
| J4 | Schnellzugriff / Zuletzt bearbeitet |
| J3 | Export Buchhaltung CSV/Excel |
| J2 | Wartungsstatistik |
| J1 | Wartungsplanung inkl. E-Mail |
| J6 | Umbau Wartung MVP (Freigabe, Portal, …) |
| J7 | Paket: Mängel-Follow-up, iCal, Bulk, Portal-Push |
| I2 | Optional: Bluetooth-Drucker QR-Etiketten |

Volltexte der Bodies liegen unter `docs/github-issues/*.body.md` (vom Skript verwendet).

## Manuell einzelnes Issue

```bash
gh issue create --title "[L4] Logo-Upload im Lizenzportal" --body-file docs/github-issues/L4.body.md --label "roadmap" --label "lizenzportal"
```

---

*Siehe auch: `Vico.md` §7.2, §9.4a (L4), §11.3 (J10), §11.4 (I2).*
