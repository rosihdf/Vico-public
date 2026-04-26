import type { Object as Obj } from '../../types/object'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'
import type { AltberichtParserFindingCandidateV1 } from './parserContractV1'

const isFindingRow = (x: unknown): x is AltberichtParserFindingCandidateV1 =>
  Boolean(x && typeof x === 'object' && typeof (x as { text?: unknown }).text === 'string')

/** Entspricht `parseAltberichtC2ImportedKeys` (ohne Abhängigkeit von schweren Modulen). */
const parseC2ImportedKeySet = (raw: unknown): Set<string> => {
  const out = new Set<string>()
  if (!Array.isArray(raw)) return out
  for (const x of raw) {
    if (typeof x === 'string' && x.trim()) out.add(x.trim())
  }
  return out
}

const parseFindingIndex = (key: string): number | null => {
  const m = /^f:(\d+)$/.exec(key.trim())
  if (!m) return null
  return parseInt(m[1]!, 10)
}

type ResolveResult = { ok: true; defectEntryId: string } | { ok: false; message: string }

/**
 * Löst den Stammdaten-`defects_structured`-Eintrag anhand C2-Key (f:N) + Finding-Text auf.
 * Voraussetzung: f:N muss in C2-Import-Keys vorkommen; Mangel-Text muss exakt (trim) an einem offenen Eintrag hängen.
 */
export const resolveStammdatenDefectEntryIdForC2Key = (
  object: Obj,
  staging: AltberichtImportStagingObjectRow,
  c2Key: string
): ResolveResult => {
  const k = c2Key.trim()
  if (!k) return { ok: false, message: 'Kein C2-Schlüssel (f:Index) gewählt.' }
  const idx = parseFindingIndex(k)
  if (idx == null) return { ok: false, message: 'C2-Schlüssel muss f:0, f:1, … lauten.' }

  const imported = parseC2ImportedKeySet(staging.c2_defects_imported_keys)
  if (!imported.has(k)) {
    return { ok: false, message: `Mangel ${k} ist noch nicht per C2 in die Stammdaten übernommen.` }
  }

  const raw = staging.findings_json
  if (!Array.isArray(raw) || !raw[idx]) {
    return { ok: false, message: 'Finding in der Staging-Zeile nicht gefunden (Index).'}
  }
  const item = raw[idx]
  if (!isFindingRow(item)) {
    return { ok: false, message: 'Ungültiger Finding-Datensatz in der Staging-Zeile.' }
  }
  const want = (item as AltberichtParserFindingCandidateV1).text.trim()
  if (!want) {
    return { ok: false, message: 'Finding-Text ist leer.' }
  }

  const structured = object.defects_structured
  if (!Array.isArray(structured)) {
    return { ok: false, message: 'Objekt hat keine strukturierten Mängel.' }
  }
  const openMatches = structured.filter(
    (e) => e && e.status === 'open' && (e.text ?? '').trim() === want
  )
  if (openMatches.length === 0) {
    return { ok: false, message: 'Kein offener Mangel mit passendem Text an der Tür – wurde der Text geändert?'}
  }
  if (openMatches.length > 1) {
    return { ok: false, message: 'Mehrdeutig: derselbe Mangel-Text mehrfach offen am Objekt.' }
  }
  return { ok: true, defectEntryId: openMatches[0]!.id }
}
