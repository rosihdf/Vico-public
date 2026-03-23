#!/usr/bin/env node
/**
 * Wendet Vite-/Netlify-Env-Variablen für Mandanten-Sites an (Phase C).
 *
 * Voraussetzung: Netlify Personal Access Token mit passenden Rechten.
 *
 * Nutzung:
 *   export NETLIFY_AUTH_TOKEN=...
 *   export NETLIFY_ACCOUNT_ID=...   # optional: sonst erste Account-ID aus /accounts
 *   node scripts/netlify-apply-tenant-env.mjs path/zur/deployment.json
 *   node scripts/netlify-apply-tenant-env.mjs path/zur/deployment.json --dry-run
 *
 * Siehe: docs/Netlify-Mandanten-Env-Skript.md
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const API = 'https://api.netlify.com/api/v1'

const isPlaceholder = (v) => {
  if (typeof v !== 'string' || !v.trim()) return true
  const s = v.trim()
  if (s.startsWith('<') && s.endsWith('>')) return true
  if (s.includes('REPLACE') || s === '<ANON-KEY>') return true
  return false
}

const parseArgs = () => {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const force = argv.includes('--force')
  const file = argv.find((a) => !a.startsWith('--'))
  return { file, dryRun, force }
}

const fetchJson = async (url, options) => {
  const res = await fetch(url, options)
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.message ? data.message : text
    throw new Error(`HTTP ${res.status} ${url}: ${msg}`)
  }
  return data
}

const resolveAccountId = async (token) => {
  const envId = process.env.NETLIFY_ACCOUNT_ID?.trim()
  if (envId) return envId
  const accounts = await fetchJson(`${API}/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error('Keine Accounts gefunden. Setze NETLIFY_ACCOUNT_ID.')
  }
  if (accounts.length > 1) {
    console.warn(
      '[netlify-apply] Mehrere Accounts – verwende ersten. Setze NETLIFY_ACCOUNT_ID für feste Zuordnung:',
      accounts.map((a) => a.slug || a.id).join(', ')
    )
  }
  return accounts[0].id
}

/**
 * Setzt oder legt eine Build-Env-Variable für eine Site an (context "all").
 */
const upsertSiteEnvVar = async ({ accountId, siteId, key, value, token, isSecret, dryRun }) => {
  const qp = new URLSearchParams({ site_id: siteId })
  const base = `${API}/accounts/${encodeURIComponent(accountId)}/env`
  const urlPatch = `${base}/${encodeURIComponent(key)}?${qp.toString()}`

  if (dryRun) {
    console.log(`[dry-run] ${key}=… (${siteId.slice(0, 8)}…)`)
    return
  }

  const patchRes = await fetch(urlPatch, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ context: 'all', value }),
  })

  if (patchRes.ok || patchRes.status === 201) {
    console.log(`OK PATCH ${key}`)
    return
  }

  const patchText = await patchRes.text()
  if (patchRes.status !== 404) {
    throw new Error(`PATCH ${key}: ${patchRes.status} ${patchText}`)
  }

  const createRes = await fetch(`${base}?${qp.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        key,
        scopes: ['builds'],
        values: [{ context: 'all', value }],
        is_secret: Boolean(isSecret),
      },
    ]),
  })

  const createText = await createRes.text()
  if (!createRes.ok) {
    throw new Error(`POST create ${key}: ${createRes.status} ${createText}`)
  }
  console.log(`OK CREATE ${key}`)
}

const applyForSite = async (ctx, siteId, vars, dryRun) => {
  const { accountId, token, markAnonKeyAsSecret } = ctx
  for (const [key, value] of Object.entries(vars)) {
    const isSecret = key === 'VITE_SUPABASE_ANON_KEY' && markAnonKeyAsSecret
    await upsertSiteEnvVar({
      accountId,
      siteId,
      key,
      value: String(value),
      token,
      isSecret,
      dryRun,
    })
  }
}

const main = async () => {
  const { file, dryRun, force } = parseArgs()
  if (!file) {
    console.error('Usage: node scripts/netlify-apply-tenant-env.mjs <deployment.json> [--dry-run] [--force]')
    process.exit(1)
  }

  const token = process.env.NETLIFY_AUTH_TOKEN?.trim()
  if (!token) {
    console.error('Fehlt: NETLIFY_AUTH_TOKEN')
    process.exit(1)
  }

  const raw = readFileSync(resolve(file), 'utf8')
  const cfg = JSON.parse(raw)

  if (cfg.version !== 1) {
    console.error('Nur version: 1 wird unterstützt.')
    process.exit(1)
  }

  const supabaseUrl = cfg.supabase?.url?.trim()
  const anonKey = cfg.supabase?.anonKey?.trim()
  const licenseApiUrl = cfg.licenseApiUrl?.trim()

  if (!supabaseUrl || !anonKey || !licenseApiUrl) {
    console.error('Pflicht: supabase.url, supabase.anonKey, licenseApiUrl')
    process.exit(1)
  }

  if (!force && (isPlaceholder(anonKey) || isPlaceholder(supabaseUrl) || isPlaceholder(licenseApiUrl))) {
    console.error(
      'Platzhalter in supabase/anonKey/licenseApiUrl erkannt. Trage echte Werte ein oder nutze --force (nicht empfohlen).'
    )
    process.exit(1)
  }

  const sites = cfg.sites || {}
  const mainId = sites.main?.siteId?.trim()
  const portalId = sites.portal?.siteId?.trim()
  const azId = sites.arbeitszeit?.siteId?.trim()

  if (!mainId || !portalId || !azId) {
    console.error('Pflicht: sites.main.siteId, sites.portal.siteId, sites.arbeitszeit.siteId (Netlify Site ID)')
    process.exit(1)
  }

  const includeLic = cfg.portalEnv?.includeLicenseNumber !== false
  const licNum = (cfg.portalEnv?.licenseNumber || '').trim()

  if (includeLic && !licNum && !force) {
    console.error('portalEnv.licenseNumber fehlt (oder setze portalEnv.includeLicenseNumber: false für Host-Lookup).')
    process.exit(1)
  }

  const opt = cfg.options || {}
  const markAnonKeyAsSecret = opt.markAnonKeyAsSecret !== false
  const effectiveDryRun = dryRun || opt.dryRun === true

  const accountId = await resolveAccountId(token)

  console.log(`Account: ${accountId}`)
  if (effectiveDryRun) console.log('*** DRY RUN ***')

  const ctx = { accountId, token, markAnonKeyAsSecret }

  const mainVars = {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: anonKey,
    VITE_LICENSE_API_URL: licenseApiUrl,
  }

  const portalVars = {
    ...mainVars,
    ...(includeLic && licNum ? { VITE_LICENSE_NUMBER: licNum } : {}),
  }

  await applyForSite(ctx, mainId, mainVars, effectiveDryRun)
  await applyForSite(ctx, portalId, portalVars, effectiveDryRun)
  await applyForSite(ctx, azId, portalVars, effectiveDryRun)

  console.log(effectiveDryRun ? 'Dry Run beendet.' : 'Fertig. In Netlify: Deploy neu auslösen (Clear cache optional).')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
