#!/usr/bin/env node
/**
 * Setzt Build-Umgebungsvariablen für drei Cloudflare-Pages-Projekte (Haupt-App, Portal, AZK)
 * anhand einer Mandanten-JSON (version 2) – analog zu netlify-apply-tenant-env.mjs.
 *
 * Voraussetzung: API-Token mit mindestens „Account – Cloudflare Pages – Edit“.
 *
 *   export CLOUDFLARE_API_TOKEN=...
 *   export CLOUDFLARE_ACCOUNT_ID=...   # aus Dashboard URL oder Workers/Pages Overview
 *   node scripts/cloudflare-apply-tenant-env.mjs path/zur/deployment.cf.json
 *   node scripts/cloudflare-apply-tenant-env.mjs path/zur/deployment.cf.json --dry-run
 *
 * Siehe: docs/Cloudflare-Mandanten-Env-Skript.md
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const API = 'https://api.cloudflare.com/client/v4'

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

const cfFetch = async (path, token, options = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const msg =
      data?.errors?.map((e) => e.message).join('; ') ||
      data?.message ||
      text ||
      res.statusText
    throw new Error(`HTTP ${res.status} ${path}: ${msg}`)
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'success') && data.success === false) {
    const msg = data?.errors?.map((e) => e.message).join('; ') || 'success: false'
    throw new Error(`${path}: ${msg}`)
  }
  return data
}

const upsertProductionEnvVars = async ({
  accountId,
  projectName,
  token,
  vars,
  markAnonKeyAsSecret,
  markLicenseApiKeyAsSecret,
  dryRun,
}) => {
  const enc = encodeURIComponent(projectName)
  const getPath = `/accounts/${encodeURIComponent(accountId)}/pages/projects/${enc}`
  const data = await cfFetch(getPath, token)
  const proj = data.result
  if (!proj?.deployment_configs?.production) {
    throw new Error(
      `Projekt "${projectName}": kein deployment_configs.production (Pages-Projekt mindestens einmal aus Dashboard/CI gebaut?)`
    )
  }

  const dc = structuredClone(proj.deployment_configs)
  if (!dc.production.env_vars) dc.production.env_vars = {}

  for (const [key, value] of Object.entries(vars)) {
    const isSecret =
      (key === 'VITE_SUPABASE_ANON_KEY' && markAnonKeyAsSecret) ||
      (key === 'VITE_LICENSE_API_KEY' && markLicenseApiKeyAsSecret)
    dc.production.env_vars[key] = {
      type: isSecret ? 'secret_text' : 'plain_text',
      value: String(value),
    }
  }

  if (dryRun) {
    console.log(`[dry-run] ${projectName}: ${Object.keys(vars).join(', ')}`)
    return
  }

  await cfFetch(getPath, token, {
    method: 'PATCH',
    body: JSON.stringify({ deployment_configs: dc }),
  })
  console.log(`OK PATCH deployment_configs.production.env_vars (${projectName})`)
}

const main = async () => {
  const { file, dryRun, force } = parseArgs()
  if (!file) {
    console.error(
      'Nutzung: node scripts/cloudflare-apply-tenant-env.mjs <deployment.cf.json> [--dry-run] [--force]'
    )
    process.exit(1)
  }

  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  if (!token) {
    console.error('Fehlt: CLOUDFLARE_API_TOKEN')
    process.exit(1)
  }
  if (!accountId) {
    console.error('Fehlt: CLOUDFLARE_ACCOUNT_ID')
    process.exit(1)
  }

  const raw = readFileSync(resolve(file), 'utf8')
  const cfg = JSON.parse(raw)

  if (cfg.version !== 2 || cfg.provider !== 'cloudflare_pages') {
    console.error('Nur version: 2 mit provider: "cloudflare_pages" wird unterstützt (siehe configs/vico-cloudflare-deployment.example.json).')
    process.exit(1)
  }

  const supabaseUrl = cfg.supabase?.url?.trim()
  const anonKey = cfg.supabase?.anonKey?.trim()
  const licenseApiUrl = cfg.licenseApiUrl?.trim()
  const licenseApiKey = (cfg.licenseApiKey ?? '').trim()

  if (!supabaseUrl || !anonKey || !licenseApiUrl) {
    console.error('Pflicht: supabase.url, supabase.anonKey, licenseApiUrl')
    process.exit(1)
  }

  if (!force && (isPlaceholder(anonKey) || isPlaceholder(supabaseUrl) || isPlaceholder(licenseApiUrl))) {
    console.error(
      'Platzhalter erkannt. Trage echte Werte ein oder nutze --force (nicht empfohlen).'
    )
    process.exit(1)
  }

  const projects = cfg.projects || {}
  const mainName = projects.main?.projectName?.trim()
  const portalName = projects.portal?.projectName?.trim()
  const azName = projects.arbeitszeit?.projectName?.trim()

  if (!mainName || !portalName || !azName) {
    console.error(
      'Pflicht: projects.main.projectName, projects.portal.projectName, projects.arbeitszeit.projectName (exakter Pages-Projektname)'
    )
    process.exit(1)
  }

  const includeLic = cfg.portalEnv?.includeLicenseNumber !== false
  const licNum = (cfg.portalEnv?.licenseNumber || '').trim()

  if (includeLic && !licNum && !force) {
    console.error(
      'portalEnv.licenseNumber fehlt (oder portalEnv.includeLicenseNumber: false für Host-Lookup).'
    )
    process.exit(1)
  }

  const opt = cfg.options || {}
  const markAnonKeyAsSecret = opt.markAnonKeyAsSecret !== false
  const markLicenseApiKeyAsSecret = opt.markLicenseApiKeyAsSecret !== false
  const effectiveDryRun = dryRun || opt.dryRun === true

  console.log(`Account: ${accountId}`)
  if (effectiveDryRun) console.log('*** DRY RUN ***')

  const mainVars = {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: anonKey,
    VITE_LICENSE_API_URL: licenseApiUrl.replace(/\/$/, ''),
  }
  if (licenseApiKey) mainVars.VITE_LICENSE_API_KEY = licenseApiKey

  const portalVars = {
    ...mainVars,
    ...(includeLic && licNum ? { VITE_LICENSE_NUMBER: licNum } : {}),
  }

  const ctx = {
    accountId,
    token,
    markAnonKeyAsSecret,
    markLicenseApiKeyAsSecret,
    dryRun: effectiveDryRun,
  }

  await upsertProductionEnvVars({ ...ctx, projectName: mainName, vars: mainVars })
  await upsertProductionEnvVars({ ...ctx, projectName: portalName, vars: portalVars })
  await upsertProductionEnvVars({ ...ctx, projectName: azName, vars: portalVars })

  console.log(
    effectiveDryRun
      ? 'Dry Run beendet.'
      : 'Fertig. In Cloudflare Pages: Production-Deploy neu auslösen (oder auf nächsten Git-Push warten).'
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
