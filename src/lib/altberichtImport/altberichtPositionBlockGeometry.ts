/**
 * Block-Geometrie pro Position: aus pdf.js TextContent ableiten, in welchem
 * vertikalen Bereich einer PDF-Seite eine Position liegt. Ermöglicht Block-
 * Ausschnitte ohne globalen Operator-Scan und ohne ganzes Seitenbild.
 *
 * Heuristik: Position-Anker im Text (z. B. „Pos. 3", „3. Bezeichnung", „Position 3")
 * werden über alle Seiten gesucht. Zu jeder Sequenz gehört ein Anker-Item mit
 * y-Koordinate. Block-Box = [yTop = anker.y, yBottom = nächster Anker.y oder
 * Seitenende]. Y-Werte sind in PDF-Koordinaten (Origin unten links).
 *
 * Robustheit: Das ganze Modul ist read-only und nimmt fehlende/abweichende
 * Anker tolerant hin. Bei Unsicherheit wird `null` zurückgegeben — der Aufrufer
 * fällt dann auf Seitenfoto/Sequenz-Heuristik zurück.
 */

export type AltberichtPositionBlockBox = {
  sequence: number
  pageNumber: number
  /** y-Koordinate Block-Oberkante (PDF-Coords, oberer Rand des Blocks). */
  yTop: number
  /** y-Koordinate Block-Unterkante (PDF-Coords, unterer Rand). */
  yBottom: number
  /** Seitenbreite in Punkten (PDF-Coords). */
  pageWidth: number
  /** Seitenhöhe in Punkten (PDF-Coords). */
  pageHeight: number
}

type GeoTextItem = {
  text: string
  /** PDF-Y des Item-Baselines (Origin unten links). */
  baselineY: number
  /** Höhe des Items in PDF-Coords. */
  height: number
}

const ANCHOR_PATTERNS: ReadonlyArray<RegExp> = [
  /^pos\.?\s*(\d{1,3})\b/i,
  /^position\s*(\d{1,3})\b/i,
  /^(\d{1,3})\.\s+\S/,
]

const matchSequenceFromAnchor = (raw: string): number | null => {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return null
  for (const pat of ANCHOR_PATTERNS) {
    const m = pat.exec(text)
    if (!m) continue
    const n = Number(m[1])
    if (Number.isFinite(n) && n >= 1 && n <= 999) return n
  }
  return null
}

const collectAnchorYByPage = (
  itemsByPage: ReadonlyArray<{
    pageNumber: number
    pageWidth: number
    pageHeight: number
    items: ReadonlyArray<GeoTextItem>
  }>
): { sequence: number; pageNumber: number; y: number }[] => {
  const seenSequences = new Set<number>()
  const anchors: { sequence: number; pageNumber: number; y: number }[] = []
  for (const p of itemsByPage) {
    /**
     * Items werden in einer ungeordneten Reihenfolge geliefert; sortieren nach y absteigend
     * (= obere Items zuerst), damit das erste Vorkommen pro Sequenz tatsächlich am Blockanfang sitzt.
     */
    const sorted = [...p.items].sort((a, b) => b.baselineY - a.baselineY)
    for (const it of sorted) {
      const seq = matchSequenceFromAnchor(it.text)
      if (seq == null) continue
      if (seenSequences.has(seq)) continue
      seenSequences.add(seq)
      anchors.push({ sequence: seq, pageNumber: p.pageNumber, y: it.baselineY })
    }
  }
  return anchors
}

/**
 * Liefert Block-Bounding-Boxen pro erkannte Position (per Anker im Text).
 * Pro Seite ist die Box vertikal auf [vorheriger-Anker, anker] (in PDF-Coords) bezogen.
 */
export const buildAltberichtPositionBlockBoxes = (
  pages: ReadonlyArray<{
    pageNumber: number
    pageWidth: number
    pageHeight: number
    items: ReadonlyArray<GeoTextItem>
  }>
): AltberichtPositionBlockBox[] => {
  const anchors = collectAnchorYByPage(pages)
  if (anchors.length === 0) return []
  const pageMeta = new Map(
    pages.map((p) => [p.pageNumber, { pageWidth: p.pageWidth, pageHeight: p.pageHeight }])
  )
  const sortedBySequence = [...anchors].sort((a, b) => a.sequence - b.sequence)

  return sortedBySequence.map((anchor, idx) => {
    const meta = pageMeta.get(anchor.pageNumber)
    const pageWidth = meta?.pageWidth ?? 595
    const pageHeight = meta?.pageHeight ?? 842
    const yTop = Math.min(pageHeight, anchor.y + 18)
    const next = sortedBySequence[idx + 1]
    /**
     * yBottom = y des nächsten Ankers, **wenn** er auf derselben Seite liegt; sonst Seitenende (0).
     * Anker liegen im PDF-Koordinatensystem (Origin unten links), also yTop > yBottom.
     */
    const yBottom = next && next.pageNumber === anchor.pageNumber ? Math.max(0, next.y - 2) : 0
    return {
      sequence: anchor.sequence,
      pageNumber: anchor.pageNumber,
      yTop,
      yBottom: Math.min(yBottom, yTop),
      pageWidth,
      pageHeight,
    }
  })
}

export type AltberichtPositionBlockBoxLookup = {
  bySequence: Map<number, AltberichtPositionBlockBox>
}

export const buildAltberichtPositionBlockBoxLookup = (
  boxes: ReadonlyArray<AltberichtPositionBlockBox>
): AltberichtPositionBlockBoxLookup => ({
  bySequence: new Map(boxes.map((b) => [b.sequence, b])),
})

export type GeoTextItemForTest = GeoTextItem
export const __testing = { collectAnchorYByPage, matchSequenceFromAnchor }
