#!/usr/bin/env node
import { copyFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const src = join(root, 'BENUTZERANLEITUNG.md')
const dest = join(root, 'public', 'BENUTZERANLEITUNG.md')

if (existsSync(src)) {
  copyFileSync(src, dest)
  console.log('BENUTZERANLEITUNG.md nach public/ kopiert')
}
