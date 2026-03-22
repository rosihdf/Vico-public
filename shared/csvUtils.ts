/** CSV für Excel (DE): Semikolon-Trenner, Zellen escapen, UTF-8 BOM. */

export const escapeCsvCell = (val: string | number | null | undefined): string => {
  const s = String(val ?? '')
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export const prependUtf8Bom = (content: string): string => `\uFEFF${content}`

export const downloadTextFile = (filename: string, content: string, mimeType = 'text/csv;charset=utf-8'): void => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}
