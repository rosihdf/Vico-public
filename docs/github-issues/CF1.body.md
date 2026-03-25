## Ziel

Detailliert planen: **Umzug der vier Frontends von Netlify zu Cloudflare Pages** (ein Account, vier Projekte) und klären, welche Teile der **Lizenz-API** bei **Supabase Edge Functions** verbleiben bzw. dorthin verlagert werden statt **Pages Functions** zu nutzen.

## Vollständige Ausarbeitung

- **Entscheidungen & Kontext:** `docs/Cloudflare-Umzug-und-Supabase-Auslagerung.md`
- **Arbeits-Roadmap (Umprogrammierung → Go-Live):** `docs/Cloudflare-Umzug-Roadmap.md`

## Akzeptanz (Planungsphase)

- [ ] Variante A (Pages Functions) oder B (Supabase Edge für `/license` etc.) **festgelegt** oder bewusst parallel in Staging geprüft
- [ ] Staging-Deployments auf CF für mindestens eine App inkl. Lizenz-Flow **grün**
- [ ] Folge-Issues für Implementierung (Wrangler/Env-Skript, Code-Port) abgeleitet
