/**
 * Einfacher CSV-Parser: erste Zeile = Kopfzeilen, Rest = Datenzeilen.
 * Unterstützt Komma und Semikolon als Trennzeichen (wird aus der ersten Zeile erkannt).
 * Felder in Anführungszeichen erlaubt ("" = escaped quote).
 */
export const parseCsv = (text: string): { headers: string[]; rows: string[][] } => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }
  const delimiter = lines[0].includes(';') ? ';' : ','
  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let i = 0
    while (i < line.length) {
      if (line[i] === '"') {
        let val = ''
        i += 1
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') {
            val += '"'
            i += 2
          } else if (line[i] === '"') {
            i += 1
            break
          } else {
            val += line[i]
            i += 1
          }
        }
        result.push(val.trim())
      } else {
        const end = line.indexOf(delimiter, i)
        const slice = end === -1 ? line.slice(i) : line.slice(i, end)
        result.push(slice.trim())
        i = end === -1 ? line.length : end + 1
      }
    }
    return result
  }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)
  return { headers, rows }
}
