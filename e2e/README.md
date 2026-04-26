# End-to-End-Tests (Playwright)

## Einmalig

```bash
npm run test:e2e:install
```

Installiert den Chromium-Browser für Playwright.

## Ausführen

```bash
npm run test:e2e
```

Führt `npm run build` aus, startet einen statischen HTTP-Server (`serve` auf Port 4173) und läuft die Tests in `e2e/`.

## Port

Standard ist **http://127.0.0.1:34173** (statischer `serve` über `dist`), damit nicht mit **4173** (`vite preview`) kollidiert.

## Bereits laufender Server

Wenn die App woanders erreichbar ist (z. B. manuelles `npm run dev`):

```bash
PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e:only
```

Dann wird **kein** `webServer` gestartet; bei selbstsigniertem HTTPS die Playwright-Konfiguration um `ignoreHTTPSErrors: true` ergänzen (siehe `playwright.config.ts`).

## Berichte

Nach einem Lauf mit HTML-Reporter: Ordner `playwright-report/` (lokal öffnen: darin `index.html`).
