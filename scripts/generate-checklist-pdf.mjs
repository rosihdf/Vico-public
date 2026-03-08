#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { jsPDF } from 'jspdf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dataPath = join(root, 'src', 'lib', 'checklistData.json')
const outDir = join(root, 'public')
const outPath = join(outDir, 'Vico-Test-Checkliste.pdf')

const data = JSON.parse(readFileSync(dataPath, 'utf-8'))

const doc = new jsPDF({ format: 'a4', unit: 'mm' })
const pageW = doc.internal.pageSize.getWidth()
const margin = 15
let y = margin
const lineH = 6

const addText = (text, opts = {}) => {
  doc.setFontSize(opts.fontSize ?? 10)
  doc.setFont('helvetica', opts.fontStyle ?? 'normal')
  doc.text(text, margin, y)
  y += (opts.fontSize ?? 10) * 0.5 || lineH
}

addText(data.title, { fontSize: 16, fontStyle: 'bold' })
addText(data.subtitle, { fontSize: 10 })
y += 6

doc.setDrawColor(200, 200, 200)
doc.line(margin, y, pageW - margin, y)
y += 8

let currentCategory = ''
data.items.forEach((item) => {
  if (item.category !== currentCategory) {
    currentCategory = item.category
    addText(currentCategory, { fontSize: 10, fontStyle: 'bold' })
    y += 2
  }
  addText(`□ ${item.id}. ${item.label}`)
  y += 2
})

y += 10
addText('Datum: _______________', { fontSize: 9 })
addText('Unterschrift: _______________', { fontSize: 9 })

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
const output = doc.output('arraybuffer')
writeFileSync(outPath, Buffer.from(output))
console.log(`Checkliste erstellt: ${outPath}`)
