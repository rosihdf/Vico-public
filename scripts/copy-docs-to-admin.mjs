#!/usr/bin/env node
/**
 * Kopiert Dokumentation (ArioVan-Dokumentation.pdf, BENUTZERANLEITUNG.md)
 * von public/ nach admin/public/ für den Lizenz-Admin.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const srcDir = join(root, 'public')
const destDir = join(root, 'admin', 'public')

if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })

const files = [
  ['BENUTZERANLEITUNG.md', 'BENUTZERANLEITUNG.md'],
  ['ArioVan-Dokumentation.pdf', 'ArioVan-Dokumentation.pdf'],
]

for (const [srcName, destName] of files) {
  const src = join(srcDir, srcName)
  const dest = join(destDir, destName)
  if (existsSync(src)) {
    copyFileSync(src, dest)
    console.log(`${srcName} nach admin/public/ kopiert`)
  } else {
    console.warn(`Hinweis: ${srcName} nicht gefunden in public/ – ggf. zuerst "npm run generate-vico-pdf", "npm run generate-komponenten-pdf" und "npm run build" ausführen`)
  }
}
