# ArioVan

Web-App für Kunden-, BV- und Objektverwaltung mit Wartungsdokumentation.

[![Netlify Status](https://api.netlify.com/api/v1/badges/b2354e82-71db-46a7-b5c0-d30b0e5afdde/deploy-status)](https://app.netlify.com/projects/mobil-vico-test/deploys)

## Struktur

```
./
├── src/              # Web-App (Vite + React)
│   ├── components/   # AddressLookupFields, OrderCalendar
│   ├── lib/          # dataService, offlineStorage, Utils
│   └── types/        # TypeScript-Typen
├── public/           # Favicon, Logo, Web-App-Test-Checkliste-PDF
├── scripts/          # generate-checklist-webapp-pdf.mjs
├── supabase/         # Edge Functions
├── supabase-complete.sql
├── Vico.md           # Detaillierte Dokumentation (interner Dateiname)
└── BENUTZERANLEITUNG.md  # Benutzeranleitung
```

## Entwicklung

```bash
npm run dev      # Dev-Server (http://localhost:5173)
npm run build    # Production-Build
npm run preview  # Build testen
```

## Tech Stack

- **Web:** Vite, React 18, TypeScript, TailwindCSS, React Router
- **Backend:** Supabase (Auth, DB, Storage)
