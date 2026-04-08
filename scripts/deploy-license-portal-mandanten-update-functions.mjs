#!/usr/bin/env node
/**
 * Deployt ausschließlich die Edge Function **license** im Lizenzportal-Supabase.
 * Enthält Mandanten-Release-Payload (`mandantenReleases`), `appVersions`-Overlay, Lizenz/Design.
 *
 * Ausführung aus dem Repo-Root:
 *   npm run lp:deploy:mandanten-update
 *   npm run lp:deploy:mandanten-update -- --project-ref <ref>
 *
 * Voraussetzung: `supabase login` bzw. `SUPABASE_ACCESS_TOKEN` in der Umgebung (CI).
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const lpRoot = path.join(repoRoot, 'supabase-license-portal')
const extraArgs = process.argv.slice(2)

if (!fs.existsSync(path.join(lpRoot, 'supabase', 'config.toml'))) {
  console.error('Erwartet supabase-license-portal/supabase/config.toml – cwd:', lpRoot)
  process.exit(1)
}

const isWin = process.platform === 'win32'
const localSupabase = path.join(repoRoot, 'node_modules', '.bin', isWin ? 'supabase.cmd' : 'supabase')

const run = (command, args) => {
  const r = spawnSync(command, args, {
    cwd: lpRoot,
    stdio: 'inherit',
    env: process.env,
    // Windows: .cmd / npx zuverlässiger mit shell
    shell: isWin,
  })
  if (r.error) {
    return { ok: false, error: r.error }
  }
  return { ok: true, status: r.status ?? 1 }
}

let result
if (fs.existsSync(localSupabase)) {
  result = run(localSupabase, ['functions', 'deploy', 'license', ...extraArgs])
} else {
  console.warn('Hinweis: Lokales supabase-CLI nicht unter node_modules/.bin – nutze npx.')
  result = run('npx', ['--yes', 'supabase', 'functions', 'deploy', 'license', ...extraArgs])
}

if (!result.ok) {
  console.error(result.error?.message ?? 'supabase-Aufruf fehlgeschlagen')
  process.exit(1)
}
process.exit(result.status === 0 ? 0 : result.status)
