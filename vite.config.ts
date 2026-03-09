/// <reference types="vitest" />
import { readFileSync, existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const appVersion = pkg.version ?? '0.0.1'

let releaseNotes: string[] = []
if (existsSync('./release-notes.json')) {
  try {
    const rn = JSON.parse(readFileSync('./release-notes.json', 'utf-8')) as Record<string, string[]>
    releaseNotes = rn[appVersion] ?? []
  } catch {
    // ignore
  }
}

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    open: true,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Vico Türen & Tore',
        short_name: 'Vico',
        description: 'Wartungs- und Mängeldokumentation für Türen und Tore',
        theme_color: '#5b7895',
        background_color: '#5b7895',
        display: 'standalone',
        start_url: '/',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
    {
      name: 'vico-version',
      generateBundle() {
        const versionPayload = JSON.stringify({
          version: appVersion,
          buildTime: new Date().toISOString(),
          releaseNotes,
        })
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: versionPayload,
        })
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  test: {
    globals: true,
    environment: 'node',
  },
})
