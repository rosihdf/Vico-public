import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const appVersion = pkg.version ?? '0.0.1'

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
    open: true,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
  plugins: [
    react(),
    {
      name: 'vico-version',
      generateBundle(_, bundle) {
        const versionPayload = JSON.stringify({
          version: appVersion,
          buildTime: new Date().toISOString(),
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
})
