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
 * Portal-Protokoll (optional, GitHub Actions setzt Env):
 *   ROLLOUT_RUN_ID, ROLLOUT_CALLBACK_URL, ROLLOUT_CALLBACK_SECRET
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

const maskUrl = (dbUrl) => {
  try {
    return String(dbUrl).replace(/:[^:@/]+@/, ':****@')
  } catch {
    return '(ungültige URL)'
  }
}

const excerpt = (s, max = 3500) => {
  const t = String(s ?? '').replace(/postgresql:\/\/([^:]+):([^@]+)@/gi, 'postgresql://$1:****@')
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

const extractProjectRef = (dbUrl) => {
  try {
    const u = new URL(dbUrl)
    const host = u.hostname || ''
    const dm = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(host)
    if (dm) return dm[1]
    const user = decodeURIComponent(u.username || '')
    const um = /^postgres\.([a-z0-9]+)$/i.exec(user)
    if (um) return um[1]
    return null
  } catch {
    return null
  }
}

const runPsql = (dbUrl, sqlPath) => {
  const r = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stdout = String(r.stdout ?? '')
  const stderr = String(r.stderr ?? '')
  if (stdout) process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)
  return { status: r.status ?? 1, stdout, stderr }
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

const callbackEnabled = () =>
  Boolean(process.env.ROLLOUT_RUN_ID?.trim()) &&
  Boolean(process.env.ROLLOUT_CALLBACK_URL?.trim()) &&
  Boolean(process.env.ROLLOUT_CALLBACK_SECRET?.trim())

/**
 * @param {string} op
 * @param {Record<string, unknown>} data
 */
const postCallback = async (op, data) => {
  if (!callbackEnabled()) return { ok: true, skipped: true }
  const url = process.env.ROLLOUT_CALLBACK_URL.trim()
  const secret = process.env.ROLLOUT_CALLBACK_SECRET.trim()
  const runId = process.env.ROLLOUT_RUN_ID.trim()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rollout-Callback-Secret': secret,
      },
      body: JSON.stringify({ op, run_id: runId, ...data }),
    })
    const text = await res.text()
    if (!res.ok) {
      console.warn(`[rollout-callback] ${op} → HTTP ${res.status}: ${text.slice(0, 400)}`)
      return { ok: false, status: res.status, text }
    }
    return { ok: true }
  } catch (e) {
    console.warn(`[rollout-callback] ${op} → ${e instanceof Error ? e.message : String(e)}`)
    return { ok: false }
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

  const useCb = callbackEnabled()

  if (useCb) {
    const targetsPayload = urls.map((url, i) => ({
      target_index: i,
      project_ref: extractProjectRef(url),
      db_host_masked: maskUrl(url),
      status: 'queued',
    }))
    await postCallback('targets_replace', { targets: targetsPayload })
  }

  if (dryRun) {
    console.log('[DRY-RUN] Keine SQL-Ausführung gegen Mandanten-DBs.')
    urls.forEach((u, i) => {
      console.log(`  ${i + 1}. ${maskUrl(u)}`)
    })

    if (useCb) {
      const nowIso = new Date().toISOString()
      const skipNote = 'Dry-Run: SQL wurde nicht ausgeführt.'
      for (let i = 0; i < urls.length; i++) {
        await postCallback('target_update', {
          target_index: i,
          patch: {
            status: 'skipped',
            started_at: nowIso,
            finished_at: nowIso,
            stdout_excerpt: skipNote,
            psql_exit_code: null,
            error_excerpt: null,
          },
        })
      }
      await postCallback('run_finalize', {
        status: 'success',
        summary_json: {
          dry_run: true,
          urls_total: urls.length,
          skipped: urls.length,
          note: skipNote,
        },
      })
    }

    process.exit(0)
  }

  let okCount = 0
  let errCount = 0

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const safe = maskUrl(url)
    console.log(`\n--- [${i + 1}/${urls.length}] ${safe} ---`)

    const startedIso = new Date().toISOString()
    if (useCb) {
      await postCallback('target_update', {
        target_index: i,
        patch: {
          status: 'running',
          started_at: startedIso,
          finished_at: null,
          psql_exit_code: null,
          error_excerpt: null,
        },
      })
    }

    let r = runPsql(url, sqlPath)
    let stderr = String(r.stderr ?? '')
    if (shouldRetryWithIpv4(r.status, stderr, url)) {
      const retryUrl = await tryBuildIpv4HostaddrUrl(url)
      if (retryUrl) {
        console.warn('IPv6 nicht erreichbar – Retry mit hostaddr (IPv4).')
        r = runPsql(retryUrl, sqlPath)
        stderr = String(r.stderr ?? '')
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

    const finishedIso = new Date().toISOString()

    if (r.status === 0) {
      okCount++
      if (useCb) {
        await postCallback('target_update', {
          target_index: i,
          patch: {
            status: 'success',
            finished_at: finishedIso,
            psql_exit_code: 0,
            stdout_excerpt: excerpt(r.stdout || ''),
            error_excerpt: null,
          },
        })
      }
    } else {
      errCount++
      console.error(`Fehler bei Mandant ${i + 1} (Exit ${r.status ?? 1}).`)
      if (useCb) {
        await postCallback('target_update', {
          target_index: i,
          patch: {
            status: 'error',
            finished_at: finishedIso,
            psql_exit_code: r.status ?? 1,
            error_excerpt: excerpt(stderr || r.stdout || ''),
            stdout_excerpt: excerpt(r.stdout || ''),
          },
        })
      } else {
        process.exit(1)
      }
    }
  }

  if (useCb) {
    let finalStatus = 'success'
    if (errCount > 0 && okCount > 0) finalStatus = 'partial'
    else if (errCount > 0 && okCount === 0) finalStatus = 'error'
    await postCallback('run_finalize', {
      status: finalStatus,
      summary_json: {
        dry_run: false,
        urls_total: urls.length,
        success: okCount,
        errors: errCount,
      },
    })
  }

  if (errCount > 0) {
    console.error(`\nBeendet mit Fehlern: ${errCount} von ${urls.length} Mandanten.`)
    process.exit(1)
  }
  console.log('\nFertig: alle URLs erfolgreich.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
