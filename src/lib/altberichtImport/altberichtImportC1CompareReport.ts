import type { Object as Obj } from '../../types/object'
import { getAltberichtCatalogFieldRaw, parseRauchmelderCountFromRaw } from './altberichtImportC1ObjectFields'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'
import type { AltberichtStagingRowInput } from './altberichtImportReviewTypes'
import {
  getEffectiveFloor,
  getEffectiveObjectName,
  getEffectiveObjectType,
  getEffectiveRoom,
} from './altberichtStagingValidation'

export type C1FieldCompareStatus = 'match' | 'missing_in_productive' | 'missing_in_staging' | 'mismatch'

export type C1FieldCompare = {
  label: string
  status: C1FieldCompareStatus
  left: string
  right: string
  statusLabel: 'passt' | 'fehlt' | 'abweichend' | 'n/v'
}

export type C1PositionCompare = {
  stagingId: string
  sequence: number
  committedObjectId: string | null
  objectMissing: boolean
  notYetImported: boolean
  fields: C1FieldCompare[]
  findingsLeft: string
}

const DASH = '—'

const rowToInput = (row: AltberichtImportStagingObjectRow): AltberichtStagingRowInput => ({
  bv_id: row.bv_id,
  object_name: row.object_name,
  object_type_text: row.object_type_text,
  floor_text: row.floor_text,
  room_text: row.room_text,
  review_bv_id: row.review_bv_id ?? null,
  review_object_name: row.review_object_name ?? null,
  review_object_type_text: row.review_object_type_text ?? null,
  review_floor_text: row.review_floor_text ?? null,
  review_room_text: row.review_room_text ?? null,
  review_object_id: row.review_object_id ?? null,
  review_status: row.review_status ?? 'draft',
})

const isBlank = (s: string | null | undefined): boolean => !s || s.trim() === '' || s === DASH

const normText = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()

const findStatus = (left: string, right: string): C1FieldCompareStatus => {
  if (isBlank(left) && isBlank(right)) return 'match'
  if (!isBlank(left) && isBlank(right)) return 'missing_in_productive'
  if (isBlank(left) && !isBlank(right)) return 'missing_in_staging'
  if (normText(left) === normText(right)) return 'match'
  return 'mismatch'
}

const findStatusNumeric = (rawLeft: string, rightNum: number | null | undefined): C1FieldCompareStatus => {
  const leftN = parseRauchmelderCountFromRaw(rawLeft)
  const r = rightNum ?? 0
  if (leftN === r) return 'match'
  if (leftN > 0 && r === 0) return 'missing_in_productive'
  if (leftN === 0 && r > 0) return 'missing_in_staging'
  return 'mismatch'
}

const findStatusWing = (fluegelRaw: string, right: number | null | undefined): C1FieldCompareStatus => {
  const t = fluegelRaw === DASH ? '' : fluegelRaw.trim()
  if (isBlank(t) && (right == null || right === 0)) return 'match'
  const m = t.match(/(\d{1,2})/)
  const ln = m && m[1] != null ? parseInt(m[1], 10) : NaN
  const r = right ?? 0
  if (!Number.isNaN(ln) && ln === r) return 'match'
  if (!Number.isNaN(ln) && r === 0) return 'missing_in_productive'
  if (Number.isNaN(ln) && r > 0) return 'missing_in_staging'
  if (!Number.isNaN(ln) && r > 0 && ln !== r) return 'mismatch'
  return 'mismatch'
}

const toStatusLabel = (s: C1FieldCompareStatus, notYetImported: boolean): C1FieldCompare['statusLabel'] => {
  if (notYetImported) return 'n/v'
  switch (s) {
    case 'match':
      return 'passt'
    case 'missing_in_productive':
      return 'fehlt'
    case 'missing_in_staging':
    case 'mismatch':
      return 'abweichend'
    default:
      return 'n/v'
  }
}

const findStatusJaNein = (leftJa: boolean, rightJa: boolean, notYetImported: boolean): C1FieldCompareStatus => {
  if (notYetImported) return 'match'
  if (leftJa === rightJa) return 'match'
  if (leftJa && !rightJa) return 'missing_in_productive'
  if (!leftJa && rightJa) return 'missing_in_staging'
  return 'mismatch'
}

const formatProductObjectType = (obj: Obj): string => {
  const parts: string[] = []
  if (obj.type_tuer) parts.push('Tür')
  if (obj.type_sektionaltor) parts.push('Sektionaltor')
  if (obj.type_schiebetor) parts.push('Schiebetor')
  const ft = obj.type_freitext?.trim()
  if (ft) parts.push(ft)
  return parts.length > 0 ? parts.join(', ') : DASH
}

const compactFindings = (row: AltberichtImportStagingObjectRow): string => {
  const j = row.findings_json
  if (!Array.isArray(j) || j.length === 0) return DASH
  const out: string[] = []
  for (const it of j) {
    if (it && typeof it === 'object' && 'text' in it) {
      const t = String((it as { text?: unknown }).text ?? '').trim()
      if (t) out.push(t)
    }
    if (out.length >= 5) break
  }
  if (out.length === 0) return DASH
  const joined = out.join(' · ')
  return joined.length > 280 ? `${joined.slice(0, 277)}…` : joined
}

/**
 * Sichtbarer Abgleich: effektive Staging/Review- und Katalogwerte vs. Produktivobjekt (nach C1).
 */
export const buildC1PositionCompare = (
  row: AltberichtImportStagingObjectRow,
  productive: Obj | null
): C1PositionCompare => {
  const input = rowToInput(row)
  const cat = row.catalog_candidates_json
  const committedId = row.committed_object_id?.trim() || null
  const notYetImported = !committedId

  const nameL = getEffectiveObjectName(input) || DASH
  const fl = getEffectiveFloor(input) || DASH
  const rl = getEffectiveRoom(input) || DASH
  const artL = getEffectiveObjectType(input) || DASH
  const fluegelL = getAltberichtCatalogFieldRaw(cat, 'fluegel') ?? DASH
  const anfL = getAltberichtCatalogFieldRaw(cat, 'anforderung') ?? DASH
  const herstL = getAltberichtCatalogFieldRaw(cat, 'hersteller') ?? DASH
  const schlL =
    getAltberichtCatalogFieldRaw(cat, 'schliessmittel_typ') ??
    getAltberichtCatalogFieldRaw(cat, 'schliessmittel') ??
    DASH
  const fsaHL = getAltberichtCatalogFieldRaw(cat, 'fsa_hersteller') ?? DASH
  const fsaTL = getAltberichtCatalogFieldRaw(cat, 'fsa_typ') ?? DASH
  const rauchL = getAltberichtCatalogFieldRaw(cat, 'rauchmelder') ?? DASH
  const rauchLN = parseRauchmelderCountFromRaw(rauchL)
  const festImplL = Boolean(
    (!isBlank(fsaHL) && fsaHL !== DASH) || (!isBlank(fsaTL) && fsaTL !== DASH) || rauchLN > 0
  )
  const festL = festImplL ? 'Ja' : 'Nein'

  const buildField = (label: string, l: string, r: string, st: C1FieldCompareStatus): C1FieldCompare => ({
    label,
    left: l,
    right: r,
    status: st,
    statusLabel: toStatusLabel(st, notYetImported),
  })

  const fields: C1FieldCompare[] = []

  if (productive) {
    const prName = productive.name?.trim() || DASH
    const prFloor = productive.floor?.trim() || DASH
    const prRoom = productive.room?.trim() || DASH
    const prType = formatProductObjectType(productive)
    const prWing = productive.wing_count != null && productive.wing_count > 0 ? String(productive.wing_count) : DASH
    const prAnf = productive.anforderung?.trim() || DASH
    const prMan = productive.manufacturer?.trim() || DASH
    const prSchl = productive.lock_type?.trim() || DASH
    const prFsaH = productive.hold_open_manufacturer?.trim() || DASH
    const prFsaT = productive.hold_open_type?.trim() || DASH
    const prRauch = String(productive.smoke_detector_count ?? 0)
    const prFest = productive.has_hold_open ? 'Ja' : 'Nein'
    const prId = productive.internal_id?.trim() || DASH
    const proposedId = row.proposed_internal_id?.trim() || DASH

    const push = (label: string, l: string, r: string, st: C1FieldCompareStatus) => {
      fields.push(buildField(label, l, r, st))
    }

    push('Position (Sequenz)', String(row.sequence), DASH, 'match')
    push('Objektname', nameL, prName, findStatus(nameL, prName))
    push(
      'Interne Kennung (OBJ-…)',
      proposedId,
      prId,
      isBlank(prId)
        ? proposedId === DASH
          ? 'match'
          : 'missing_in_productive'
        : findStatus(proposedId, prId)
    )
    push('Etage', fl, prFloor, findStatus(fl, prFloor))
    push('Raum', rl, prRoom, findStatus(rl, prRoom))
    push('Art / Typ', artL, prType, findStatus(artL, prType))
    push('Flügel', fluegelL, prWing, findStatusWing(fluegelL, productive.wing_count))
    push('Anforderung', anfL, prAnf, findStatus(anfL, prAnf))
    push('Hersteller', herstL, prMan, findStatus(herstL, prMan))
    push('Schließmittel-Typ (lock_type)', schlL, prSchl, findStatus(schlL, prSchl))
    push('FSA Hersteller', fsaHL, prFsaH, findStatus(fsaHL, prFsaH))
    push('FSA Typ', fsaTL, prFsaT, findStatus(fsaTL, prFsaT))
    push(
      'Rauchmelder (Anzahl)',
      isBlank(rauchL) && rauchLN === 0 ? DASH : String(rauchLN),
      prRauch,
      findStatusNumeric(rauchL || '0', productive.smoke_detector_count)
    )
    push('Feststellanlage', festL, prFest, findStatusJaNein(festImplL, productive.has_hold_open, notYetImported))
  } else {
    const pushL = (label: string, l: string) => {
      fields.push({
        label,
        left: l,
        right: DASH,
        status: committedId ? 'missing_in_productive' : 'match',
        statusLabel: notYetImported ? 'n/v' : committedId ? 'fehlt' : 'n/v',
      })
    }
    pushL('Position (Sequenz)', String(row.sequence))
    pushL('Objektname', nameL)
    pushL('Interne Kennung (OBJ-…)', row.proposed_internal_id?.trim() || DASH)
    pushL('Etage', fl)
    pushL('Raum', rl)
    pushL('Art / Typ', artL)
    pushL('Flügel', fluegelL)
    pushL('Anforderung', anfL)
    pushL('Hersteller', herstL)
    pushL('Schließmittel-Typ (lock_type)', schlL)
    pushL('FSA Hersteller', fsaHL)
    pushL('FSA Typ', fsaTL)
    pushL('Rauchmelder (Anzahl)', isBlank(rauchL) && rauchLN === 0 ? DASH : String(rauchLN))
    pushL('Feststellanlage (implizit aus FSA/RM)', festL)
  }

  const objectMissing = Boolean(committedId) && !productive

  return {
    stagingId: row.id,
    sequence: row.sequence,
    committedObjectId: committedId,
    objectMissing,
    notYetImported: !committedId,
    fields,
    findingsLeft: compactFindings(row),
  }
}

export const buildC1CompareReportForJob = (
  rows: AltberichtImportStagingObjectRow[],
  objectById: Map<string, Obj>
): C1PositionCompare[] =>
  rows.map((r) => {
    const oid = r.committed_object_id?.trim() || null
    const o = oid ? (objectById.get(oid) ?? null) : null
    return buildC1PositionCompare(r, o)
  })

/** Kompakte Zusammenfassung für die Experten-Abgleich-Zeile (eine Staging-Position). */
export type C1CompareSummary = {
  tone: 'ok' | 'warn' | 'bad' | 'neutral'
  headline: string
  subline?: string
  shortIssueLabels: string[]
}

const isMeaningfulField = (f: C1FieldCompare): boolean =>
  f.label !== 'Position (Sequenz)' && !f.label.startsWith('Position (')

/**
 * Liefert Kurztext + Ton für die einklappbare C1-Abgleichszeile.
 * „Nach Reparse“: erkennbar daran, dass `committed_object_id` fehlt → `notYetImported`.
 */
export const summarizeC1PositionCompare = (c: C1PositionCompare): C1CompareSummary => {
  if (c.notYetImported) {
    return {
      tone: 'neutral',
      headline: 'C1-Übernahme für diese Staging-Version ausstehend (noch kein Ziel-Objekt)',
      subline:
        'Ein erneutes Parsen (Reparse) setzt die Staging-Zeile in der Regel zurück: Der Abgleich bezieht sich erst wieder auf ein **Produktivobjekt**, nachdem die Zeile **erneut C1-committet** wurde. Bis dahin: nur linke Spalte (Quelle) – rechts (—) ist fachlich erwartbar.',
      shortIssueLabels: ['noch nicht (erneut) übernommen'],
    }
  }
  if (c.objectMissing) {
    return {
      tone: 'warn',
      headline: 'Produktivobjekt zu dieser committed_object_id nicht geladen',
      subline:
        'Bitte im Job „Stand aktualisieren“/Seite neu laden. Ohne geladenes Ziel-Objekt ist kein sinnvoller Rechtsvergleich möglich.',
      shortIssueLabels: ['Ziel-Objekt fehlt im Cache'],
    }
  }
  const rel = c.fields.filter((f) => isMeaningfulField(f))
  const fehlt = rel.filter((f) => f.status === 'missing_in_productive')
  const abw = rel.filter(
    (f) => f.status === 'mismatch' || f.status === 'missing_in_staging'
  )
  if (fehlt.length === 0 && abw.length === 0) {
    return {
      tone: 'ok',
      headline: 'Abgleich: alle geprüften Felder passen (Staging ↔ Produktiv)',
      subline: undefined,
      shortIssueLabels: [],
    }
  }
  const shortIssueLabels: string[] = [
    ...fehlt.map((f) => f.label),
    ...abw.map((f) => f.label),
  ]
  if (fehlt.length + abw.length > 3) {
    return {
      tone: 'bad',
      headline: `Abgleich: ${fehlt.length} fehlend im Produktiv, ${abw.length} abweichend (Details aufklappen)`,
      subline: ['Zuerst fehlend:', ...fehlt.map((f) => f.label), 'Dann abweichend:', ...abw.map((f) => f.label)]
        .filter(Boolean)
        .join(' · '),
      shortIssueLabels: shortIssueLabels.slice(0, 8),
    }
  }
  const parts: string[] = []
  if (fehlt.length)
    parts.push(
      `fehlt: ${fehlt
        .map((f) => f.label)
        .join(', ')}`
    )
  if (abw.length)
    parts.push(
      `abweichend: ${abw
        .map((f) => f.label)
        .join(', ')}`
    )
  return {
    tone: 'bad',
    headline: `Abgleich: ${parts.join(' · ')}`,
    subline: undefined,
    shortIssueLabels: shortIssueLabels.slice(0, 8),
  }
}
