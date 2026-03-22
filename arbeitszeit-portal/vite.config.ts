import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { vicoVersionPlugin, getAppVersion, getAppReleaseLabel } from '../scripts/vite-plugin-version.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const appVersion = getAppVersion(__dirname)
const appReleaseLabel = getAppReleaseLabel(__dirname)

/** Fester Port für das Arbeitszeitenportal (Dev + Preview). Haupt-App 5173, Admin 5175, Kundenportal 5174. */
const PORT = 5176

/// <reference types="vitest" />
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  return {
  envDir: __dirname,
  test: {
    globals: true,
    environment: 'node',
  },
  server: {
    port: PORT,
    strictPort: true,
    open: true,
    host: true,
    fs: {
      allow: [__dirname, repoRoot],
    },
  },
  preview: {
    port: 4176,
    strictPort: false,
  },
  plugins: [react(), vicoVersionPlugin(__dirname)],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_RELEASE_LABEL__: JSON.stringify(appReleaseLabel),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ''),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 400,
  },
  }
})
