#!/usr/bin/env node
/**
 * Generiert Komponenten-und-Funktionen-Dokument als PDF.
 * Quelle: docs/Komponenten-und-Funktionen.md
 * Ausgabe: public/ArioVan-Komponenten-Funktionen.pdf
 *
 * Wird beim Admin-Build ausgeführt. Bei neuen Features docs/Komponenten-und-Funktionen.md ergänzen.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mdToPdf } from 'md-to-pdf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const mdPath = join(root, 'docs', 'Komponenten-und-Funktionen.md')
const outDir = join(root, 'public')
const outPath = join(outDir, 'ArioVan-Komponenten-Funktionen.pdf')

if (!existsSync(mdPath)) {
  console.warn(`Hinweis: ${mdPath} nicht gefunden – PDF wird nicht erstellt`)
  process.exit(0)
}

// md-to-pdf benötigt Chrome/Puppeteer. Bei Fehlern: npx puppeteer browsers install chrome

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

await mdToPdf(
  { path: mdPath },
  {
    dest: outPath,
    pdf_options: {
      format: 'A4',
      margin: { top: '25mm', right: '25mm', bottom: '25mm', left: '25mm' },
    },
  }
)

console.log(`Komponenten & Funktionen PDF erstellt: ${outPath}`)
