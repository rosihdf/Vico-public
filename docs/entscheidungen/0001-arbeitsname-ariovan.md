# ADR 0001: Arbeitsname „Ariovan“

**Status:** Akzeptiert (Arbeitsstand)  
**Datum:** 2026-04-18  
**Kontext:** Produkt und Repository sind historisch unter dem Namen **Vico** dokumentiert und im UI teils sichtbar. Für Markenarbeit, Kommunikation und schrittweise Umbenennung wird ein einheitlicher **Arbeitsname** benötigt.

## Entscheidung

- Der **Arbeitsname** für Produkt/Marke in neuer Doku und künftigen nutzersichtigen Texten ist **Ariovan**.
- **`Vico.md`** und bestehende Verweise bleiben vorerst **unverändert**, bis eine gesonderte Entscheidung Spec-Datei umbenennt oder splittet (Breaking Change für Links und Gewohnheit).
- Technische Identifiers (Funktionsnamen, alte Skripte, Repo-Pfade) werden **nicht** in einem Rutsch umbenannt; das erfolgt paketweise mit Regressionstests.

## Konsequenzen

- Neue Struktur unter `docs/roadmap/`, `docs/protokolle/`, `docs/entscheidungen/`, `docs/branding/` nutzt **Ariovan** dort, wo es um Marke/Kommunikation geht.
- Rebranding-Fundstellen werden in [`../protokolle/rebranding-fundstellen.md`](../protokolle/rebranding-fundstellen.md) gesammelt.

## Offen (nicht Teil dieser ADR)

- Finale Markenrechtslage, Schreibweise, Domains, Logo-Releases  
- Ob `Vico.md` offiziell zu `Ariovan.md` wird oder ein Duplikat/Redirect-Konzept nötig ist
