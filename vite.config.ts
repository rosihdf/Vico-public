/// <reference types="vitest" />
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'))
const appVersion = pkg.version ?? '0.0.1'

let releaseNotes: string[] = []
if (existsSync(path.join(__dirname, 'release-notes.json'))) {
  try {
    const rn = JSON.parse(readFileSync(path.join(__dirname, 'release-notes.json'), 'utf-8')) as Record<string, string[]>
    releaseNotes = rn[appVersion] ?? []
  } catch {
    // ignore
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  return {
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
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: false },
        includeAssets: ['favicon.svg'],
        // Ohne mode: 'development' kann die SW-Generierung (terser) hängen und „Unable to write the service worker file“ auslösen.
        mode: 'development',
        manifest: {
          name: 'AMRtech Türen & Tore',
          short_name: 'AMRtech',
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
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ''),
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
    },
  }
})
