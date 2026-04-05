#!/usr/bin/env node
/**
 * Schreibt bzw. aktualisiert einen App-Release in der Lizenzportal-DB (Entwurf).
 *
 * Erwartet Tag-Konvention: <kanal>/<semver>, z. B. main/1.4.0, kundenportal/v2.1.0, arbeitszeit/0.9.0
 * Kanal-Aliase: arbeitszeit → arbeitszeit_portal, arbeitszeit_portal
 *
 * Umgebung:
 * - SUPABASE_LICENSE_PORTAL_URL
 * - SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY
 * - GITHUB_SYNC_TAG (Pflicht)
 * - GITHUB_REPOSITORY, GITHUB_SYNC_RELEASE_BODY, GITHUB_SYNC_RELEASE_NAME, GITHUB_SYNC_HTML_URL,
 *   GITHUB_SYNC_TARGET_COMMITISH, GITHUB_WORKFLOW_RUN_URL (optional)
 *
 * Nutzung: von GitHub Actions (release: published / workflow_dispatch) oder lokal mit exportierter Env.
 */

import { createClient } from '@supabase/supabase-js'

/** @param {string} msg */
const die = (msg) => {
  console.error(msg)
  process.exit(1)
}

const CHANNEL_MAP = {
  main: 'main',
  kundenportal: 'kundenportal',
  arbeitszeit: 'arbeitszeit_portal',
  arbeitszeit_portal: 'arbeitszeit_portal',
}

const parseTag = (rawTag) => {
  const tag = rawTag.trim()
  const slash = tag.indexOf('/')
  if (slash <= 0) {
    die(
      `Ungültiger Tag "${tag}". Erwartet: Kanal/Version, z. B. main/1.2.0 oder kundenportal/v1.0.0`
    )
  }
  const prefix = tag.slice(0, slash).trim().toLowerCase()
  const versionPart = tag.slice(slash + 1).trim()
  const semver = versionPart.replace(/^v+/i, '').trim()
  if (!semver) die(`Keine Version im Tag: ${tag}`)
  const channel = CHANNEL_MAP[prefix]
  if (!channel) {
    die(
      `Unbekannter Kanal "${prefix}". Erlaubt: main, kundenportal, arbeitszeit, arbeitszeit_portal`
    )
  }
  return { channel, semver, tag }
}

const url = process.env.SUPABASE_LICENSE_PORTAL_URL?.trim()
const serviceKey = process.env.SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY?.trim()
const syncTag = process.env.GITHUB_SYNC_TAG?.trim()

if (!url || !serviceKey) {
  die('SUPABASE_LICENSE_PORTAL_URL und SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY müssen gesetzt sein.')
}
if (!syncTag) die('GITHUB_SYNC_TAG (Tag-Name) fehlt.')

const { channel, semver, tag } = parseTag(syncTag)

const ciMetadata = {
  source: 'github',
  repository: process.env.GITHUB_REPOSITORY?.trim() || null,
  tag,
  html_url: process.env.GITHUB_SYNC_HTML_URL?.trim() || null,
  workflow_run_url: process.env.GITHUB_WORKFLOW_RUN_URL?.trim() || null,
  target_commitish: process.env.GITHUB_SYNC_TARGET_COMMITISH?.trim() || null,
  synced_at: new Date().toISOString(),
}

const title = (process.env.GITHUB_SYNC_RELEASE_NAME || '').trim() || null
const notes = (process.env.GITHUB_SYNC_RELEASE_BODY || '').trim() || null

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: existing, error: selErr } = await supabase
  .from('app_releases')
  .select('id,status')
  .eq('channel', channel)
  .eq('version_semver', semver)
  .maybeSingle()

if (selErr) die(`Abfrage app_releases: ${selErr.message}`)

const now = new Date().toISOString()

if (existing && existing.status === 'published') {
  const { error: upErr } = await supabase
    .from('app_releases')
    .update({ ci_metadata: ciMetadata, updated_at: now })
    .eq('id', existing.id)
  if (upErr) die(`Update (published): ${upErr.message}`)
  console.log(
    `Release ${channel} ${semver} ist bereits freigegeben — nur ci_metadata aktualisiert (id=${existing.id}).`
  )
  process.exit(0)
}

const baseRow = {
  channel,
  version_semver: semver,
  release_type: 'feature',
  title,
  notes,
  module_tags: [],
  incoming_enabled: false,
  incoming_all_mandanten: false,
  force_hard_reload: false,
  ci_metadata: ciMetadata,
  status: 'draft',
  created_by: null,
  updated_at: now,
}

if (existing?.id) {
  const { error } = await supabase.from('app_releases').update(baseRow).eq('id', existing.id)
  if (error) die(`Update Entwurf: ${error.message}`)
  console.log(`Entwurf aktualisiert: ${channel} ${semver} (id=${existing.id})`)
} else {
  const { data: ins, error } = await supabase.from('app_releases').insert(baseRow).select('id').single()
  if (error) die(`Insert: ${error.message}`)
  console.log(`Entwurf angelegt: ${channel} ${semver} (id=${ins?.id})`)
}
