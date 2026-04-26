# Protokoll: Rebranding – Fundstellen (Vico → Ariovan)

**Stand:** April 2026  
**Hinweis:** Keine vollständige Liste; regelmäßig per Suche aktualisieren. Arbeitsname Zielmarke: **Ariovan** (siehe [`../entscheidungen/0001-arbeitsname-ariovan.md`](../entscheidungen/0001-arbeitsname-ariovan.md)).

## Schnellsuche (Repo-Root)

```bash
rg -i '\bVico\b' --glob '!**/node_modules/**' --glob '!**/dist/**'
rg 'vico' --glob '*.{ts,tsx,css,md,html,json}' --glob '!**/node_modules/**'
```

`vico` in **Kleinbuchstaben** trifft oft **technische** Bezeichner (`vicoCssPrimary`, `applyVicoPrimaryCssVars`, npm-Skript `generate-vico-pdf`) — getrennt von **nutzersichtbarem** „Vico“ planen.

## Bereits bekannte Stellen (Auszug)

| Bereich | Beispielpfad / Hinweis |
|---------|-------------------------|
| HTML-Titel Haupt-App | `index.html` → `<title>Vico</title>` |
| E2E | `e2e/smoke.spec.ts` — Erwartung Titel enthält „Vico“ |
| Admin-PDF-Download | `admin/src/lib/downloadKomponentenPdf.ts` — Dateiname `Vico-Komponenten-…` |
| Portal-Design | `portal/src/DesignContext.tsx` — Import `shared/vicoCssPrimary` |
| Shared-Farblogik | `shared/vicoCssPrimary` (Dateiname / API) |
| Doku & Spec | `Vico.md`, viele `docs/*.md` mit Verweis „Vico“ |
| NPM-Skripte | `package.json` — `generate-vico-pdf`, ggf. weitere |

## Nicht automatisch ersetzen (ohne Review)

- **Supabase-Projektnamen**, Cloudflare-Projekte, GitHub-Repo-URLs (Betrieb)  
- **Rechtliche** / Vertragsdokumente (`docs/Lizenzvertrag-Vico.md` o. Ä.) — nur nach juristischer Freigabe  
- **Kanalnamen** in Release-/Lizenzlogik, sofern extern konfiguriert

## Nächste Schritte

1. Paket 0 abschließen: [`paket-0-inventur.md`](paket-0-inventur.md)  
2. Branding-Parameter festhalten: [`../branding/ariovan-branding-v1.md`](../branding/ariovan-branding-v1.md)  
3. Migration in Issues zerlegen (UI-Strings → PDF → technische Umbenennung optional in eigener Phase)
