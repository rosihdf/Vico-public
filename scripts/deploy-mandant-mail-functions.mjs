#!/usr/bin/env node
/**
 * Deployt die drei mail-relevanten Mandanten-Edge-Functions aus supabase/functions/:
 * notify-portal-on-report, send-maintenance-reminder-digest, send-maintenance-report
 *
 * Im Repo liegt unter **supabase/functions/** oft ohne root-config.toml – dann z. B.:
 *
 *   npm run mandant:deploy:mail-functions -- --project-ref <MANDANT_REF>
 *
 * oder vorher im Repo-Root `supabase link` (sofern bei euch konfiguriert).
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const extraArgs = process.argv.slice(2)

const FUNCTIONS = ['notify-portal-on-report', 'send-maintenance-reminder-digest', 'send-maintenance-report']

const functionsDir = path.join(repoRoot, 'supabase', 'functions')
if (!fs.existsSync(functionsDir)) {
  console.error('Erwartet supabase/functions – Pfad:', functionsDir)
  process.exit(1)
}

const isWin = process.platform === 'win32'
const localSupabase = path.join(repoRoot, 'node_modules', '.bin', isWin ? 'supabase.cmd' : 'supabase')

const run = (command, args) => {
  const r = spawnSync(command, args, {
    cwd: repoRoot,
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
