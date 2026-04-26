import { defineConfig, devices } from '@playwright/test'

/** Eigener Port, damit er nicht mit `vite preview` (4173) oder Dev-Server kollidiert. */
const E2E_PORT = 34173

/**
 * E2E-Tests gegen die gebaute App (statischer HTTP-Server, kein Vite-HTTPS).
 * Vor dem ersten Lauf: `npm run test:e2e:install`
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${E2E_PORT}`,
    ignoreHTTPSErrors: (process.env.PLAYWRIGHT_BASE_URL ?? '').startsWith('https:'),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        /** `-l` vor `dist`; `--no-port-switching` verhindert stillen Wechsel auf einen Zufallsport. */
        command: `npx serve -l ${E2E_PORT} -s --no-clipboard --no-port-switching dist`,
        url: `http://127.0.0.1:${E2E_PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
