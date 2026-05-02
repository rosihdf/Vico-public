#!/usr/bin/env node
/**
 * Generiert Vico-Dokumentation als PDF aus Vico.md
 * Ausgabe: public/ArioVan-Dokumentation.pdf
 */
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mdToPdf } from 'md-to-pdf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const mdPath = join(root, 'Vico.md')
const outDir = join(root, 'public')
const outPath = join(outDir, 'ArioVan-Dokumentation.pdf')

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

console.log(`ArioVan-Dokumentation erstellt: ${outPath}`)
