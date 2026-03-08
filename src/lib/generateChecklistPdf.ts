import { jsPDF } from 'jspdf'

export type ChecklistItem = {
  id: string
  label: string
  category: string
}

export type ChecklistData = {
  title: string
  subtitle: string
  items: ChecklistItem[]
}

export const generateChecklistPdf = (data: ChecklistData): Blob => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin
  const lineH = 6

  const addText = (text: string, opts?: { fontSize?: number; fontStyle?: string }) => {
    doc.setFontSize(opts?.fontSize ?? 10)
    doc.setFont('helvetica', (opts?.fontStyle as 'normal' | 'bold') ?? 'normal')
    doc.text(text, margin, y)
    y += opts?.fontSize ? opts.fontSize * 0.5 : lineH
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

  return doc.output('blob')
}
