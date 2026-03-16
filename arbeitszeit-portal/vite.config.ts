import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Fester Port für das Arbeitszeitenportal (Dev + Preview). Haupt-App 5173, Admin 5175, Kundenportal 5174. */
const PORT = 5176

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  return {
  envDir: __dirname,
  server: {
    port: PORT,
    strictPort: true,
    open: true,
    host: true,
  },
  preview: {
    port: 4176,
    strictPort: false,
  },
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ''),
  },
  }
})
