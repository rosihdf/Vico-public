#!/usr/bin/env node
/**
 * Generiert version.json für die Mobile-Web-Build.
 * Muss nach expo export ausgeführt werden.
 */

const fs = require('fs')
const path = require('path')

const mobilePkgPath = path.join(__dirname, '..', 'package.json')
const releaseNotesPath = path.join(__dirname, '..', '..', 'release-notes.json')
const distPath = path.join(__dirname, '..', 'dist')

const pkg = JSON.parse(fs.readFileSync(mobilePkgPath, 'utf-8'))
const version = pkg.version ?? '1.0.0'

let releaseNotes = []
if (fs.existsSync(releaseNotesPath)) {
  try {
    const rn = JSON.parse(fs.readFileSync(releaseNotesPath, 'utf-8'))
    releaseNotes = rn[version] ?? []
  } catch {
    // ignore
  }
}

const versionPayload = JSON.stringify({
  version,
  buildTime: new Date().toISOString(),
  releaseNotes,
})

if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true })
}

fs.writeFileSync(path.join(distPath, 'version.json'), versionPayload)
console.log('version.json erzeugt (v' + version + ')')
