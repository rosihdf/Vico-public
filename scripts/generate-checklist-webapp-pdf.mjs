#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { jsPDF } from 'jspdf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dataPath = join(root, 'src', 'lib', 'checklistDataWebApp.json')
const outDir = join(root, 'public')
const outPath = join(outDir, 'AMRtech-WebApp-Test-Checkliste.pdf')

const data = JSON.parse(readFileSync(dataPath, 'utf-8'))

const doc = new jsPDF({ format: 'a4', unit: 'mm' })
const pageW = doc.internal.pageSize.getWidth()
const pageH = doc.internal.pageSize.getHeight()
const margin = 15
let y = margin
const lineH = 5

const addText = (text, opts = {}) => {
  doc.setFontSize(opts.fontSize ?? 9)
  doc.setFont('helvetica', opts.fontStyle ?? 'normal')
  doc.text(text, margin, y)
  y += (opts.fontSize ?? 9) * 0.5 || lineH
}

const CHECKBOX_SIZE = 4
const CHECKBOX_GAP = 2
const addCheckboxItem = (label) => {
  const textX = margin + CHECKBOX_SIZE + CHECKBOX_GAP
  doc.setDrawColor(0, 0, 0)
  doc.rect(margin, y - 3.5, CHECKBOX_SIZE, CHECKBOX_SIZE)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(label, textX, y)
  y += lineH + 2
}

const checkPageBreak = () => {
  if (y > pageH - 25) {
    doc.addPage()
    y = margin
  }
}

addText(data.title, { fontSize: 16, fontStyle: 'bold' })
addText(data.subtitle, { fontSize: 10 })
y += 6

doc.setDrawColor(200, 200, 200)
doc.line(margin, y, pageW - margin, y)
y += 8

let currentCategory = ''
data.items.forEach((item) => {
  checkPageBreak()
  if (item.category !== currentCategory) {
    currentCategory = item.category
    addText(currentCategory, { fontSize: 10, fontStyle: 'bold' })
    y += 2
  }
  addCheckboxItem(`${item.id}. ${item.label}`)
})

y += 10
checkPageBreak()
addText('Datum: _______________', { fontSize: 9 })
addText('Tester: _______________', { fontSize: 9 })
addText('Unterschrift: _______________', { fontSize: 9 })

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
const output = doc.output('arraybuffer')
writeFileSync(outPath, Buffer.from(output))
console.log(`Web-App-Checkliste erstellt: ${outPath}`)
