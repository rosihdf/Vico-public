import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/// <reference types="vitest" />
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  server: {
    port: 5174,
    strictPort: true,
    open: true,
  },
  preview: {
    port: 4174,
    strictPort: false,
  },
  plugins: [react()],
})
