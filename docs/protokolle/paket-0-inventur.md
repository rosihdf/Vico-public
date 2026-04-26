# Protokoll: Paket 0 – Inventur (vor Rebrand / großen Releases)

**Stand:** April 2026  
**Ziel:** Einmalig erfassen, was es gibt — damit Umbenennung, Kommunikation und technische Änderungen nichts übersehen.

## 1. Codebase & Apps

- [ ] **Vier Frontends:** Haupt-App (Root-Vite), `portal/`, `admin/`, `arbeitszeit-portal/` — jeweils Build, `index.html`-Titel, sichtbare UI-Strings
- [ ] **Shared:** `shared/` (z. B. CSS-Primärfarbe, Mandant-Degraded, Lizenz-Features)
- [ ] **Supabase:** Mandanten-DB vs. Lizenzportal-Projekt; Edge Functions; benannte Assets in Storage
- [ ] **E2E / CI:** Smoke-Tests, erwartete Seitentitel (aktuell ggf. noch „Vico“)

## 2. Dokumentation

- [ ] **Kanonisch:** `Vico.md` (wird später ggf. umbenannt oder dupliziert als „Produktspec“ unter neuem Namen — erst nach Entscheidung)
- [ ] **Operativ:** `docs/Roadmap-Offene-Punkte.md`, Setup-/Cloudflare-/SQL-Dokumente
- [ ] **Entscheidungen:** `docs/entscheidungen/` (nummeriert, z. B. `0001-…`)

## 3. Extern sichtbar

- [ ] **Domains / Cloudflare Pages:** Projektnamen, Preview-URLs, ggf. `README`-Titel
- [ ] **Lizenzportal:** Mandantendarstellung, E-Mails/Vorlagen (falls Markenname)
- [ ] **Stores / PWA:** Kurzname, Manifest, Icons (falls vorhanden)
- [ ] **PDFs / Exporte:** Dateinamen, Kopfzeilen (`briefbogen`, Komponenten-PDF im Admin)

## 4. Ergebnis

- Kurzprotokoll: **Was** wurde inventarisiert, **welche** Fundstellen offen sind → [`rebranding-fundstellen.md`](rebranding-fundstellen.md) pflegen.  
- Abnahme: Product + Tech stimmen der Liste zu, bevor Paket 1 (String-/Asset-Migration) startet.
