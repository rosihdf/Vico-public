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

/** Alle PDF-Seiten, die diese Staging-Zeile in Quellen/Medien/Findings nennt. */
export const collectPagesMentionedOnStagingRow = (row: StagingRowForImageSuggest): Set<number> =>
  new Set([
    ...pageNumbersFromSourceRefs(row.source_refs_json),
    ...pageNumbersFromMediaHints(row.media_hints_json),
    ...pageNumbersFromFindings(row.findings_json),
  ])

const rowMentionsPage = (row: StagingRowForImageSuggest, pageNumber: number): boolean =>
  collectPagesMentionedOnStagingRow(row).has(pageNumber)

/**
 * Quelle, aus der die Seitenzahlen einer Staging-Zeile aufgelöst wurden.
 * - `parser`: explizite Page-Anker aus source_refs/media_hints/findings.sourceRefs.
 * - `embedded`: distinct page_number aus eingebetteten Bildern (Expertenmodus, Bildscan vorhanden).
 * - `sequence`: heuristischer Fallback aus `row.sequence` – Reihenfolge der Position im Bericht.
 *   Wird in der UI als „vermutete Seite" gekennzeichnet, weil Position-Index ≠ Seitenzahl.
 * - `none`: keine Heuristik möglich (z. B. fehlende Sequenz).
 */
export type StagingRowPageHintSource = 'parser' | 'embedded' | 'sequence' | 'none'

export type StagingRowPageHints = {
  pages: number[]
  source: StagingRowPageHintSource
}

type EmbeddedPageHintInput = {
  file_id: string
  page_number: number
  linked_staging_object_id: string | null
  suggested_staging_object_id: string | null
  scan_meta_json?: unknown
}

/**
 * Bestimmt die Seitenzahl(en) für den Seitenfoto-Block einer Staging-Zeile mit klarer Quellen-Priorität.
 * Liefert immer mindestens eine Seite, sobald `row.sequence` gesetzt ist – damit der Standard-Modus auch
 * ohne Bildscan einen Seitenfoto-Block anbieten kann (Quelle = `sequence`, UI markiert als heuristisch).
 */
export const resolveStagingRowPageHints = (
  row: StagingRowForImageSuggest,
  embeddedImages: readonly EmbeddedPageHintInput[]
): StagingRowPageHints => {
  const fromParser = [...collectPagesMentionedOnStagingRow(row)].sort((a, b) => a - b)
  if (fromParser.length > 0) return { pages: fromParser, source: 'parser' }

  const fromEmbedded = new Set<number>()
  for (const im of embeddedImages) {
    if (im.file_id !== row.file_id) continue
    const raw = im.scan_meta_json
    if (raw && typeof raw === 'object' && (raw as { rasterSource?: unknown }).rasterSource === 'block_raw_crop') {
      continue
    }
    if (im.linked_staging_object_id !== row.id && im.suggested_staging_object_id !== row.id) continue
    if (typeof im.page_number === 'number' && im.page_number >= 1) fromEmbedded.add(im.page_number)
  }
  if (fromEmbedded.size > 0) {
    return { pages: [...fromEmbedded].sort((a, b) => a - b), source: 'embedded' }
  }

  if (typeof row.sequence === 'number' && row.sequence >= 1) {
    return { pages: [row.sequence], source: 'sequence' }
  }
  return { pages: [], source: 'none' }
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
