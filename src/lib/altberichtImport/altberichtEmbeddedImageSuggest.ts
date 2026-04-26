/**
 * Heuristische Staging-Position pro PDF-Seite (Vorschlag, kein hartes Commit).
 */

export type StagingRowForImageSuggest = {
  id: string
  file_id: string
  sequence: number
  source_refs_json: unknown
  media_hints_json: unknown
  findings_json: unknown
}

const pageNumbersFromSourceRefs = (refs: unknown): number[] => {
  if (!Array.isArray(refs)) return []
  const out: number[] = []
  for (const r of refs) {
    if (r && typeof r === 'object' && 'page' in r) {
      const p = (r as { page?: number }).page
      if (typeof p === 'number' && p >= 1) out.push(p)
    }
  }
  return out
}

const pageNumbersFromMediaHints = (hints: unknown): number[] => {
  if (!Array.isArray(hints)) return []
  const out: number[] = []
  for (const h of hints) {
    if (h && typeof h === 'object' && 'page' in h) {
      const p = (h as { page?: number }).page
      if (typeof p === 'number' && p >= 1) out.push(p)
    }
  }
  return out
}

const pageNumbersFromFindings = (findings: unknown): number[] => {
  if (!Array.isArray(findings)) return []
  const out: number[] = []
  for (const f of findings) {
    if (f && typeof f === 'object' && 'sourceRefs' in f) {
      const sr = (f as { sourceRefs?: unknown }).sourceRefs
      out.push(...pageNumbersFromSourceRefs(sr))
    }
  }
  return out
}

const rowMentionsPage = (row: StagingRowForImageSuggest, pageNumber: number): boolean => {
  const s = new Set([
    ...pageNumbersFromSourceRefs(row.source_refs_json),
    ...pageNumbersFromMediaHints(row.media_hints_json),
    ...pageNumbersFromFindings(row.findings_json),
  ])
  return s.has(pageNumber)
}

/**
 * Niedrigste `sequence` der Staging-Zeile derselben Datei, deren Quellenverweise die Seite nennen.
 * Ohne Treffer: `null` (kein stiller Fallback auf die erste Zeile).
 */
export const suggestStagingObjectIdForPage = (
  fileId: string,
  pageNumber: number,
  rows: StagingRowForImageSuggest[]
): string | null => {
  const forFile = rows
    .filter((r) => r.file_id === fileId)
    .sort((a, b) => a.sequence - b.sequence)
  for (const row of forFile) {
    if (rowMentionsPage(row, pageNumber)) return row.id
  }
  return null
}
