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
import { resolve4 } from 'node:dns/promises'

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

const runPsql = (dbUrl, sqlPath) => {
  const r = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  return r
}

const hasSupabaseDbHostname = (dbUrl) => {
  try {
    const parsed = new URL(dbUrl)
    return /^db\.[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname)
  } catch {
    return false
  }
}

const hasHostaddrParam = (dbUrl) => {
  try {
    const parsed = new URL(dbUrl)
    return parsed.searchParams.has('hostaddr')
  } catch {
    return false
  }
}

const shouldRetryWithIpv4 = (status, stderr, dbUrl) => {
  if (status === 0) return false
  if (!hasSupabaseDbHostname(dbUrl)) return false
  if (hasHostaddrParam(dbUrl)) return false
  const s = String(stderr ?? '')
  return (
    /Network is unreachable/i.test(s) ||
    /Cannot assign requested address/i.test(s) ||
    /No route to host/i.test(s) ||
    /connection to server at .* failed/i.test(s)
  )
}

const tryBuildIpv4HostaddrUrl = async (dbUrl) => {
  try {
    const parsed = new URL(dbUrl)
    if (!parsed.hostname || !parsed.hostname.startsWith('db.')) return null
    const ipv4 = await resolve4(parsed.hostname)
    if (!ipv4.length) return null
    parsed.searchParams.set('hostaddr', ipv4[0])
    return parsed.toString()
  } catch {
    return null
  }
}

const main = async () => {
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
    let r = runPsql(url, sqlPath)
    const stderr = String(r.stderr ?? '')
    if (shouldRetryWithIpv4(r.status, stderr, url)) {
      const retryUrl = await tryBuildIpv4HostaddrUrl(url)
      if (retryUrl) {
        console.warn('IPv6 nicht erreichbar – Retry mit hostaddr (IPv4).')
        r = runPsql(retryUrl, sqlPath)
      } else {
        console.warn(
          'IPv4-Hostaddr konnte nicht ermittelt werden (DNS resolve4 ohne Treffer). ' +
            'Der Host scheint nur IPv6 zu haben.'
        )
        console.warn(
          'Hinweis: In GitHub-Hosted Runnern fehlt häufig IPv6. ' +
            'Bitte in der URLs-Datei eine Supabase-Pooler-URL mit IPv4 verwenden (pooler.supabase.com) ' +
            'oder den Job auf einem Runner mit IPv6 ausführen.'
        )
      }
    }
    if (r.status !== 0) {
      console.error(`Fehler bei Mandant ${i + 1} (Exit ${r.status ?? 1}). Abbruch.`)
      failed = true
      break
    }
  }

  if (failed) process.exit(1)
  console.log('\nFertig: alle URLs erfolgreich.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
