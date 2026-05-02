#!/usr/bin/env node
/**
 * Deployt die Lizenzadmin-Mail-Helfer:
 * **admin-send-test-email**, **admin-preview-mail-template**
 *
 *   npm run lp:deploy:admin-mail
 *   npm run lp:deploy:admin-mail -- --project-ref <ref>
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const lpRoot = path.join(repoRoot, 'supabase-license-portal')
const extraArgs = process.argv.slice(2)

const FUNCTIONS = ['admin-send-test-email', 'admin-preview-mail-template']

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
    shell: isWin,
  })
  if (r.error) return { ok: false, error: r.error, status: 1 }
  return { ok: true, status: r.status ?? 1 }
}

const supabaseBin = fs.existsSync(localSupabase) ? localSupabase : null

for (const fn of FUNCTIONS) {
  console.error(`\n--- Deploy ${fn} ---\n`)
  const args = supabaseBin
    ? ['functions', 'deploy', fn, ...extraArgs]
    : ['--yes', 'supabase', 'functions', 'deploy', fn, ...extraArgs]
  const cmd = supabaseBin ? supabaseBin : 'npx'
  const result = run(cmd, supabaseBin ? args : args)
  if (!result.ok) {
    console.error(result.error?.message ?? 'supabase-Aufruf fehlgeschlagen')
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status)
}

if (!supabaseBin) {
  console.warn('Hinweis: Lokales supabase-CLI nicht unter node_modules/.bin – nutze npx.')
}

process.exit(0)
