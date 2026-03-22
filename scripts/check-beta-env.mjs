#!/usr/bin/env node
/**
 * Prüft für Haupt-App, Portal, Arbeitszeit-Portal und Admin, ob in .env die
 * für einen Betatest üblichen VITE_*-Variablen gesetzt sind.
 *
 * Nutzung: npm run check:beta-env
 * Hinweis: Liest nur .env (nicht .env.local) – siehe docs/Betatest-Vorbereitung.md
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/** @param {string} path */
const parseEnvFile = (path) => {
  if (!existsSync(path)) return null
  const raw = readFileSync(path, 'utf8')
  /** @type {Record<string, string>} */
  const out = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const isSet = (env, key) => {
  const v = env[key]
  return typeof v === 'string' && v.trim().length > 0
}

/** @type {{ name: string, rel: string, required: string[], recommended: string[] }[]} */
const apps = [
  {
    name: 'Haupt-App (Root)',
    rel: '.',
    required: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    recommended: ['VITE_LICENSE_API_URL'],
  },
  {
    name: 'Kundenportal',
    rel: 'portal',
    required: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    recommended: ['VITE_LICENSE_API_URL', 'VITE_LICENSE_NUMBER'],
  },
  {
    name: 'Arbeitszeit-Portal',
    rel: 'arbeitszeit-portal',
    required: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    recommended: ['VITE_LICENSE_API_URL', 'VITE_LICENSE_NUMBER'],
  },
  {
    name: 'Lizenz-Admin',
    rel: 'admin',
    required: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    recommended: [],
  },
]

let hasErrors = false

for (const app of apps) {
  const envPath = join(root, app.rel, '.env')
  const env = parseEnvFile(envPath)

  console.log(`\n── ${app.name} (${app.rel || '.'}/.env) ──`)

  if (env === null) {
    console.log('   ⚠ Keine .env-Datei – übersprungen (lokal ggf. .env anlegen oder .env.local manuell prüfen).')
    continue
  }

  for (const key of app.required) {
    if (!isSet(env, key)) {
      console.log(`   ✖ Fehlt (erforderlich): ${key}`)
      hasErrors = true
    } else {
      console.log(`   ✓ ${key}`)
    }
  }

  for (const key of app.recommended) {
    if (!isSet(env, key)) {
      console.log(`   ○ Empfohlen, leer: ${key}`)
    } else {
      console.log(`   ✓ ${key}`)
    }
  }
}

console.log('\n' + (hasErrors ? 'Ergebnis: Fehler – erforderliche Variablen fehlen.\n' : 'Ergebnis: OK (nur gesetzte .env-Dateien geprüft).\n'))

if (hasErrors) process.exit(1)
