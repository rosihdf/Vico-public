import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

/** @param {string} appRoot */
export const getAppVersion = (appRoot) => {
  const pkg = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf-8'))
  return pkg.version ?? '0.0.1'
}

/** Optional: `package.json` → `vico.releaseLabel` (z. B. „Beta“), erscheint in `version.json` und UI. */
export const getAppReleaseLabel = (appRoot) => {
  try {
    const pkg = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf-8'))
    const label = pkg.vico?.releaseLabel
    return typeof label === 'string' ? label.trim() : ''
  } catch {
    return ''
  }
}

/** @param {string} appRoot */
export const vicoVersionPlugin = (appRoot) => {
  const appVersion = getAppVersion(appRoot)
  const releaseLabel = getAppReleaseLabel(appRoot)
  let releaseNotes = []
  const rnPath = path.join(appRoot, 'release-notes.json')
  if (existsSync(rnPath)) {
    try {
      const rn = JSON.parse(readFileSync(rnPath, 'utf-8'))
      releaseNotes = rn[appVersion] ?? []
    } catch {
      // ignore
    }
  }
  return {
    name: 'vico-version',
    generateBundle() {
      const versionPayload = JSON.stringify({
        version: appVersion,
        buildTime: new Date().toISOString(),
        releaseNotes,
        ...(releaseLabel ? { releaseLabel } : {}),
      })
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: versionPayload,
      })
    },
  }
}
