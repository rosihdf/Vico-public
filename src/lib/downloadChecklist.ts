import { generateChecklistPdf } from './generateChecklistPdf'
import type { ChecklistData } from './generateChecklistPdf'
import checklistDataWebApp from './checklistDataWebApp.json'

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const downloadWebAppChecklist = () => {
  const blob = generateChecklistPdf(checklistDataWebApp as ChecklistData)
  triggerDownload(blob, 'Vico-WebApp-Test-Checkliste.pdf')
}
