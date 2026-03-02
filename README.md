# Vico Türen & Tore

Web- und Mobile-App für Kunden-, BV- und Objektverwaltung mit Wartungsdokumentation.

## Struktur

```
Vico/
├── src/              # Web-App (Vite + React)
├── public/           # Web-Assets (logo, version.json)
├── mobile/           # Mobile-App (Expo + React Native)
├── supabase-complete.sql
└── Vico.md           # Detaillierte Dokumentation
```

## Entwicklung

### Web-App

```bash
npm run dev      # Dev-Server (http://localhost:5173)
npm run build    # Production-Build
npm run preview  # Build testen
```

### Mobile-App (Expo)

```bash
npm run mobile       # Expo starten + URL ausgeben
npm run mobile:url   # Nur URL für Expo Go
npm run mobile:ios   # iOS-Simulator
npm run mobile:android
```

## Tech Stack

- **Web:** Vite, React 18, TypeScript, TailwindCSS, React Router
- **Mobile:** Expo 54, React Native, React Navigation (Drawer + Tabs)
- **Backend:** Supabase (Auth, DB, Storage)
