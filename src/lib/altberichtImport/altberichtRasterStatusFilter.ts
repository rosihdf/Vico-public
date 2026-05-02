/**
 * Pure-Function-Filter für Block-Status-Texte (Raster-Workflow).
 *
 * Wird vom Raster-Service auf den Rohtext eines Positionsblocks angewendet,
 * **bevor** ein Mangel-Finding (`source: 'block_status'`) in `findings_json`
 * geschrieben wird.
 *
 * Filterregeln (in dieser Reihenfolge):
 * 1. Leerer Text → reject (keine Anzeige).
 * 2. „Kein Mangel"-Tokens (`mangelfrei`, `i.O.`, `OK`, `in Ordnung`,
 *    `ohne Befund`, `o.B.`) → reject (gewünschtes Verhalten: kein Finding,
 *    kein Hinweis).
 * 3. Reine Maße / Zahlen-Token (`875x2010`, `980 x 2000`, `12`, `120 mm`)
 *    → reject (über bestehenden C2-Filter).
 * 4. Dokumentkopf (`Wartung 2025`, `BV: …`, `Bearbeitete Person …`,
 *    Monatsnamen, Adress-Fragmente) → reject (über bestehenden C2-Filter).
 * 5. Übrigbleibender Text:
 *    - enthält typische Mangelbegriffe → `accept` (hohe Confidence).
 *    - sonst → `suspect` (zur manuellen Prüfung anzeigen).
 *
 * Wir benutzen für (3)/(4) den schon vorhandenen, gut getesteten
 * `textShouldBeExcludedFromAltberichtC2Import`/`normalizeAltberichtC2FindingText`-
 * Pfad — damit doppelt sichergestellt ist, dass der Block-Status weder als
 * automatischer noch produktiver Mangel durchrutscht, der ohnehin gefiltert würde.
 */

import {
  normalizeAltberichtC2FindingText,
  textShouldBeExcludedFromAltberichtC2Import,
} from './altberichtImportC2FindingFilter'

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

/**
 * Tokens, die als „Status ohne Mangel" gelten und niemals ein Finding erzeugen.
 * Bewusst eng gefasst — alles, was nicht eindeutig „Status: kein Mangel" ist,
 * geht in Filterstufe 3+.
 */
const NO_DEFECT_PATTERNS: ReadonlyArray<RegExp> = [
  /^mangel\s*frei\.?$/i,
  /^i\s*\.?\s*o\.?$/i,
  /^ok\.?$/i,
  /^in\s+ordnung\.?$/i,
  /^ohne\s+befund\.?$/i,
  /^o\s*\.?\s*b\.?$/i,
  /^keine?\s*m[äa]ngel\.?$/i,
  /^[—–-]+$/,
]

/**
 * Mangel-Schlagwörter wie im Parser (gleiche Klasse wie `RE_DEFECTISH` im
 * C2-Filter) — bewusst dupliziert, damit dieses Modul ohne Re-Export reine
 * Pure-Function-Logik bleibt und der C2-Filter unverändert bleibt.
 */
const RE_DEFECTISH =
  /mangel|defekt|undicht|fehlt|fehlen|beschädig|riss|dichtung|brand|gefahr|zulassung|laschen|mörtel|hinterfüllung|korros|schließ|schlies|nicht\s+in\s*ordnung|n\s*\.?\s*i\s*\.?\s*o\.?|kritisch|ersetz|nacharbeit|einrei|verzogen|lose|locker|blockier|klemmt|reparier|getauscht|ersetzt/i

/**
 * Status-Vorspann („Status:", „Bemerkung:" u. ä.) entfernen, damit der eigentliche
 * Befundtext bewertet wird, nicht das Label.
 */
const STATUS_LABEL_PREFIX = /^(status|bemerkung|anmerkung|prüf\s*ergebnis|ergebnis|kommentar)\s*[:\-–—]\s*/i

const stripStatusLabelPrefix = (value: string): string => {
  let v = norm(value)
  for (let guard = 0; guard < 3; guard += 1) {
    const before = v
    v = norm(v.replace(STATUS_LABEL_PREFIX, ''))
    if (v === before) break
  }
  return v
}

export type AltberichtRasterStatusFilterResult =
  | { kind: 'accept'; text: string }
  | { kind: 'suspect'; text: string; reason: string }
  | { kind: 'reject'; reason: string }

/**
 * Wendet alle Filterregeln auf einen Block-Status-Rohtext an. Pure Function,
 * keine Seiten­effekte.
 */
export const filterAltberichtRasterBlockStatusText = (
  raw: string
): AltberichtRasterStatusFilterResult => {
  const trimmed = stripStatusLabelPrefix(raw)
  if (!trimmed) return { kind: 'reject', reason: 'leer' }

  for (const pattern of NO_DEFECT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { kind: 'reject', reason: 'mangelfrei/iO/OK' }
    }
  }

  if (textShouldBeExcludedFromAltberichtC2Import(trimmed)) {
    return { kind: 'reject', reason: 'C2-Filter (Kopf/Maße/Adresse)' }
  }

  const normalized = normalizeAltberichtC2FindingText(trimmed)
  if (!normalized) return { kind: 'reject', reason: 'nach Normalisierung leer' }

  for (const pattern of NO_DEFECT_PATTERNS) {
    if (pattern.test(normalized)) {
      return { kind: 'reject', reason: 'mangelfrei/iO/OK (normalisiert)' }
    }
  }

  if (textShouldBeExcludedFromAltberichtC2Import(normalized)) {
    return { kind: 'reject', reason: 'C2-Filter (normalisiert)' }
  }

  /** Texte mit Mangelbegriff UND Reparatur-/Mangelfrei-Abschluss → prüfen, nicht als sicherer Mangel führen. */

  const MIXED_REPAIR_AFTER_DEFECT =
    /\b(?:wurde|wurden)\s+repariert\b.*\bmangelfrei\b|\bmangelfrei\b.*\b(?:wurde|jetzt|nun)\b|\bnun\s+mangelfrei\b|repariert[^\n.]{0,120}\b(?:mangelfrei|ohne\s+befund|in\s+ordnung)|blockiert[^\n.]{0,160}\b(?:repariert|mangelfrei)\b/i

  if (RE_DEFECTISH.test(normalized) && MIXED_REPAIR_AFTER_DEFECT.test(normalized)) {
    return {
      kind: 'suspect',
      text: normalized,
      reason: 'gemischter Status (Reparatur / mangelfrei)',
    }
  }

  if (RE_DEFECTISH.test(normalized)) {
    return { kind: 'accept', text: normalized }
  }

  if (normalized.length < 4) return { kind: 'reject', reason: 'zu kurz' }

  return {
    kind: 'suspect',
    text: normalized,
    reason: 'kein typisches Mangelwort',
  }
}

/**
 * Sources, unter denen der Raster-Workflow Findings in `findings_json` schreibt.
 * Beim erneuten Lauf werden **nur** diese Sources ersetzt — alle Parser-Findings
 * (`status`, `document_defect_list`, …) bleiben unangetastet.
 */
export const ALTBERICHT_RASTER_FINDING_SOURCE_ACCEPT = 'block_status' as const
export const ALTBERICHT_RASTER_FINDING_SOURCE_SUSPECT = 'block_status_review_required' as const

export const isAltberichtRasterFindingSource = (source: unknown): boolean =>
  source === ALTBERICHT_RASTER_FINDING_SOURCE_ACCEPT ||
  source === ALTBERICHT_RASTER_FINDING_SOURCE_SUSPECT
