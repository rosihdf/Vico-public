import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { vicoVersionPlugin, getAppVersion, getAppReleaseLabel } from '../scripts/vite-plugin-version.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** Repo-Root: shared/, scripts/ liegen außerhalb von admin/ (Imports z. B. shared/ErrorBoundary.tsx). */
const repoRoot = path.resolve(__dirname, '..')
const appVersion = getAppVersion(__dirname)
const appReleaseLabel = getAppReleaseLabel(__dirname)

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
    port: 5175,
    strictPort: true,
    open: true,
    host: true,
    fs: {
      allow: [__dirname, repoRoot],
    },
  },
  preview: {
    port: 4175,
    strictPort: false,
  },
  plugins: [react(), vicoVersionPlugin(__dirname)],
  resolve: {
    alias: {
      // Imports aus ../shared: Node-Resolution startet bei shared/; ohne Alias findet Rollup
      // admin/node_modules nicht (Netlify-Build base = admin).
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@supabase/supabase-js': path.resolve(
        __dirname,
        'node_modules/@supabase/supabase-js'
      ),
    },
  },
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
