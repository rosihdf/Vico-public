# Roadmap: Weiterentwicklung & Mandanten-Onboarding

Dieses Dokument fasst **Strategie**, **Phasen** und den **aktuellen Umsetzungsstand** zusammen. Ergänzend: [`Netlify-README.md`](./Netlify-README.md), [`Netlify-Vier-Apps.md`](./Netlify-Vier-Apps.md).

---

## 1. Entwicklungsworkflow (ein Repo, Umgebungen statt Doppel-Code)

| Empfehlung | Begründung |
|------------|------------|
| **Ein Git-Repo**, Branches (`main`, `develop`, Feature) | Eine Codebasis, klare Releases |
| **Staging**: eigene Netlify-Site(s) + optional **Staging-Supabase** | Testen ohne Produktionsdaten |
| **Keine** zwei parallelen Projekt-Kopien ohne Merge-Disziplin | Vermeidet Drift und doppelte Schema-Pflege |
| **Netlify Branch Deploys** / Preview-URLs | Jeder Branch testbar ohne manuelles „Übertragen“ |

**Nicht Ziel:** Zwei manuelle 1:1-Kopien entwickeln und „irgendwann“ zusammenführen – hohes Risiko, fehlende Änderungen.

---

## 2. Mandanten-Onboarding – Vision & Stufen

**Vision:** Mandant anlegen → **möglichst wenig** manuelle Env-Eingabe; langfristig **Teilautomatisierung** (APIs, Skripte).

| Phase | Inhalt | Status |
|-----|--------|--------|
| **A** | **Deployment-Hilfe im Lizenzportal (Admin):** vorgefüllte Env-Blöcke + Checkliste pro Mandant (Copy-Paste für Netlify) | **Umgesetzt** – siehe Mandanten-Formular „Deployment / Netlify“ |
| **B** | **Lizenz-API „nach Host“** – Portale ohne `VITE_LICENSE_NUMBER`; Lookup über Domain im Lizenzportal | **Umgesetzt** – `GET …/license` ohne `licenseNumber` (Browser-Origin), siehe [`Netlify-README.md`](./Netlify-README.md) |
| **C** | **Skript / CI** (intern): Netlify-Env per API aus Export des Lizenzportals setzen | **Umgesetzt** – `scripts/netlify-apply-tenant-env.mjs`, Export im Mandanten-Formular, [`Netlify-Mandanten-Env-Skript.md`](./Netlify-Mandanten-Env-Skript.md), optional `.github/workflows/netlify-apply-env.example.yml` |
| **D** | **IaC** (Terraform/Pulumi) + Supabase-/DNS-APIs für „neue Instanz“ | Optional, hoher Aufwand |

---

## 3. Manuelle Schritte (bleiben vorerst)

- **Mandanten-Supabase-Projekt** anlegen (oder Architektur „eine DB“ – siehe `Vico.md`)
- **Netlify-Sites** verbinden, **DNS** beim Hoster
- **Secrets** (`anon`, Service Role nur serverseitig) – nie im Lizenzportal-UI für Mandanten-DB anzeigen

Die **Deployment-Hilfe** liefert **Platzhalter** und **Struktur**; echte Keys kommen aus dem Supabase-Dashboard des Mandanten.

---

## 4. Nächste technische Schritte (Priorität)

1. ~~**Host-basierte Lizenz-API**~~ – erledigt (Phase B).
2. ~~**Phase C** (Netlify-Env-Skript + Export)~~ – erledigt.
3. ~~**Staging** dokumentieren~~ – erledigt: [`Netlify-README.md`](./Netlify-README.md) (Abschnitt Staging), [`Netlify-Vier-Apps.md`](./Netlify-Vier-Apps.md) §9.5, [`Release-Checkliste.md`](./Release-Checkliste.md).
4. **Phase D** nur bei Bedarf (IaC, DNS/Supabase-Automatisierung).

---

## 5. Änderungshistorie

| Datum | Anpassung |
|-------|-----------|
| *(Git)* | Erste Version Roadmap + Deployment-Panel Admin |
| *(Git)* | Phase B: Lizenz-API Host-Lookup (Netlify + Edge, Portale optional ohne `VITE_LICENSE_NUMBER`) |
| *(Git)* | Phase C: `netlify-apply-tenant-env.mjs`, JSON/Text-Export im Admin, Doku |
| *(Git)* | Staging: Doku in Netlify-README, Netlify-Vier-Apps §9.5, Release-Checkliste |
