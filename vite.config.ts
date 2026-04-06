/// <reference types="vitest" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { vicoVersionPlugin, getAppVersion, getAppReleaseLabel } from './scripts/vite-plugin-version.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appVersion = getAppVersion(__dirname)
const appReleaseLabel = getAppReleaseLabel(__dirname)

export default defineConfig(() => ({
    envDir: __dirname,
    server: {
      port: 5173,
      strictPort: true,
      open: true,
      host: true,
    },
    preview: {
      port: 4173,
      strictPort: false,
    },
    plugins: [
      basicSsl(),
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        devOptions: { enabled: false },
        includeAssets: ['favicon.svg'],
        // Ohne mode: 'development' kann die SW-Generierung (terser) hängen und „Unable to write the service worker file“ auslösen.
        mode: 'development',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          injectionPoint: undefined, // Kein Precache – stattdessen Runtime-Caching (NetworkFirst) + Prefetch
        },
        manifest: {
          name: 'AMRtech Türen & Tore',
          short_name: 'AMRtech',
          description: 'Wartungs- und Mängeldokumentation für Türen und Tore',
          theme_color: '#5b7895',
          background_color: '#5b7895',
          display: 'standalone',
          start_url: '/',
        },
      }),
      vicoVersionPlugin(__dirname),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_RELEASE_LABEL__: JSON.stringify(appReleaseLabel),
      // VITE_* nicht per define überschreiben: sonst können leere Strings eingebacken werden,
      // wenn loadEnv zum Config-Zeitpunkt nicht wie erwartet greift (Login: „Supabase nicht konfiguriert“).
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'node',
      /** Eigene vite.config + Vitest in admin/ und arbeitszeit-portal/ */
      exclude: ['**/node_modules/**', '**/dist/**', 'admin/**', 'arbeitszeit-portal/**'],
    },
}))
