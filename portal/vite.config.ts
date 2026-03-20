import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { vicoVersionPlugin, getAppVersion } from '../scripts/vite-plugin-version.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appVersion = getAppVersion(__dirname)

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
    port: 5174,
    strictPort: true,
    open: true,
    host: true,
  },
  preview: {
    port: 4174,
    strictPort: false,
  },
  plugins: [react(), vicoVersionPlugin(__dirname)],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ''),
  },
  }
})
