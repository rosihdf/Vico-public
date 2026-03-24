#!/usr/bin/env node
/**
 * Führt eine SQL-Datei nacheinander gegen mehrere Mandanten-Postgres-URLs aus (psql).
 *
 * Voraussetzung: PostgreSQL-Client (psql) im PATH.
 *
 * Nutzung:
 *   node scripts/apply-mandanten-sql.mjs docs/sql/mein-skript.sql --urls-file configs/mandanten-db-urls.local.txt
 *   node scripts/apply-mandanten-sql.mjs docs/sql/mein-skript.sql --urls-file configs/mandanten-db-urls.local.txt --dry-run
 *
 * Siehe: docs/sql/Mandanten-DB-Workflow.md
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const parseArgs = () => {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const urlsIdx = argv.indexOf('--urls-file')
  const urlsFile = urlsIdx >= 0 && argv[urlsIdx + 1] ? argv[urlsIdx + 1] : null
  const positional = argv.filter((a, i) => {
    if (a.startsWith('--')) return false
    if (urlsIdx >= 0 && (i === urlsIdx + 1 || i === urlsIdx)) return false
    return true
  })
  const sqlFile = positional[0] ?? null
  return { sqlFile, urlsFile, dryRun }
}

const loadUrls = (filePath) => {
  const raw = readFileSync(filePath, 'utf-8')
  const lines = raw.split(/\r?\n/)
  const urls = []
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    urls.push(t)
  }
  return urls
}

const main = () => {
  const { sqlFile, urlsFile, dryRun } = parseArgs()

  if (!sqlFile || !urlsFile) {
    console.error(
      'Nutzung: node scripts/apply-mandanten-sql.mjs <pfad-zur.sql> --urls-file <pfad-zur-url-liste> [--dry-run]'
    )
    process.exit(1)
  }

  const sqlPath = resolve(sqlFile)
  if (!existsSync(sqlPath)) {
    console.error(`SQL-Datei nicht gefunden: ${sqlPath}`)
    process.exit(1)
  }

  const urlsPath = resolve(urlsFile)
  if (!existsSync(urlsPath)) {
    console.error(`URL-Datei nicht gefunden: ${urlsPath}`)
    console.error('Hinweis: Vorlage configs/mandanten-db-urls.example.txt kopieren.')
    process.exit(1)
  }

  const urls = loadUrls(urlsPath)
  if (urls.length === 0) {
    console.error('Keine URLs in der Datei (nur Kommentare/Leerzeilen?).')
    process.exit(1)
  }

  const whichPsql = spawnSync('psql', ['--version'], { encoding: 'utf-8' })
  if (whichPsql.error || whichPsql.status !== 0) {
    console.error('psql nicht gefunden. Bitte PostgreSQL-Client installieren (z. B. brew install libpq).')
    process.exit(1)
  }

  console.log(`SQL-Datei: ${sqlPath}`)
  console.log(`Mandanten (URLs): ${urls.length}`)
  if (dryRun) {
    console.log('[DRY-RUN] Keine Ausführung.')
    urls.forEach((u, i) => {
      const safe = u.replace(/:[^:@/]+@/, ':****@')
      console.log(`  ${i + 1}. ${safe}`)
    })
    process.exit(0)
  }

  let failed = false
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const safe = url.replace(/:[^:@/]+@/, ':****@')
    console.log(`\n--- [${i + 1}/${urls.length}] ${safe} ---`)
    const r = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
      encoding: 'utf-8',
      stdio: ['ignore', 'inherit', 'inherit'],
    })
    if (r.status !== 0) {
      console.error(`Fehler bei Mandant ${i + 1} (Exit ${r.status}). Abbruch.`)
      failed = true
      break
    }
  }

  if (failed) process.exit(1)
  console.log('\nFertig: alle URLs erfolgreich.')
}

main()
