/**
 * Vorsichtige Matching-Vorschläge für Altbericht-Staging (nur Leselogik / JSON-Payload).
 * Keine automatische Übernahme in der UI.
 */
import type { BV } from '../../types/bv'
import type { Object as Obj } from '../../types/object'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'

export const ALTBERICHT_MATCH_PAYLOAD_VERSION = 'altbericht-match/1' as const

export type AltberichtMatchKind = 'bv' | 'object'

export type AltberichtMatchCandidateV1 = {
  kind: AltberichtMatchKind
  id: string
  label: string
  score: number
  reasons: string[]
}

export type AltberichtMatchPayloadV1 = {
  version: typeof ALTBERICHT_MATCH_PAYLOAD_VERSION
  computed_at: string
  bv_candidates: AltberichtMatchCandidateV1[]
  object_candidates: AltberichtMatchCandidateV1[]
}

export const isAltberichtMatchPayloadV1 = (raw: unknown): raw is AltberichtMatchPayloadV1 =>
  Boolean(raw && typeof raw === 'object' && (raw as AltberichtMatchPayloadV1).version === ALTBERICHT_MATCH_PAYLOAD_VERSION)

const MAX_BV = 5
const MAX_OBJ = 5
const MIN_SCORE_BV = 38
const MIN_SCORE_OBJ = 40
const MIN_SCORE_TOP_BV_FOR_OBJECTS = 48

export const normalizeForAltberichtMatch = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tokenSet = (s: string): Set<string> =>
  new Set(
    normalizeForAltberichtMatch(s)
      .split(' ')
      .filter((t) => t.length > 1)
  )

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const x of a) {
    if (b.has(x)) inter += 1
  }
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

const scoreBvAgainstText = (
  bv: BV,
  siteText: string,
  customerText: string
): { score: number; reasons: string[] } => {
  const reasons: string[] = []
  const bvNorm = normalizeForAltberichtMatch(bv.name)
  const siteN = normalizeForAltberichtMatch(siteText)
  const custN = normalizeForAltberichtMatch(customerText)
  const hay = normalizeForAltberichtMatch(`${bv.name} ${bv.city ?? ''} ${bv.street ?? ''}`)

  if (siteN.length >= 3 && siteN === bvNorm) {
    return { score: 100, reasons: ['BV-Name entspricht Standort-Text'] }
  }
  if (siteN.length >= 3 && (bvNorm.includes(siteN) || siteN.includes(bvNorm))) {
    reasons.push('Standort-Text und BV-Name überlappen')
    return { score: 88, reasons }
  }
  if (custN.length >= 3 && hay.includes(custN)) {
    reasons.push('Kunden-Text kommt in BV-Adressfeldern vor')
    return { score: 72, reasons }
  }

  const needleTokens = tokenSet(`${siteText} ${customerText}`)
  const bvTokens = tokenSet(`${bv.name} ${bv.city ?? ''}`)
  const jac = jaccard(needleTokens, bvTokens)
  if (jac >= 0.35) {
    reasons.push(`Token-Überlappung (${Math.round(jac * 100)}%)`)
    return { score: Math.round(40 + jac * 45), reasons }
  }
  if (jac >= 0.2) {
    reasons.push(`Schwache Token-Überlappung (${Math.round(jac * 100)}%)`)
    return { score: Math.round(35 + jac * 20), reasons }
  }
  return { score: 0, reasons: [] }
}

const objectTypeHint = (o: Obj): string => {
  if (o.type_freitext?.trim()) return o.type_freitext.trim()
  const parts: string[] = []
  if (o.type_tuer) parts.push('Tür')
  if (o.type_sektionaltor) parts.push('Sektionaltor')
  if (o.type_schiebetor) parts.push('Schiebetor')
  return parts.join(', ')
}

const scoreObjectAgainstRow = (
  o: Obj,
  objectNameGuess: string,
  objectTypeGuess: string
): { score: number; reasons: string[] } => {
  const reasons: string[] = []
  const nameN = normalizeForAltberichtMatch(objectNameGuess)
  const on = normalizeForAltberichtMatch(o.name ?? '')
  const oid = normalizeForAltberichtMatch(o.internal_id ?? '')
  const typeG = normalizeForAltberichtMatch(objectTypeGuess)
  const typeO = normalizeForAltberichtMatch(objectTypeHint(o))

  if (nameN.length >= 2 && on.length >= 2 && (on === nameN || on.includes(nameN) || nameN.includes(on))) {
    reasons.push('Objektname ähnlich')
    let score = 85
    if (typeG.length >= 2 && typeO.length >= 2 && (typeO.includes(typeG) || typeG.includes(typeO))) {
      reasons.push('Objekttyp ähnlich')
      score = 95
    }
    return { score, reasons }
  }
  if (nameN.length >= 2 && oid.length >= 2 && (oid === nameN || oid.includes(nameN))) {
    reasons.push('Interne ID ähnlich')
    return { score: 78, reasons }
  }
  const jac = jaccard(tokenSet(objectNameGuess), tokenSet(`${o.name ?? ''} ${o.internal_id ?? ''}`))
  if (jac >= 0.25) {
    reasons.push(`Name/ID Token-Ähnlichkeit (${Math.round(jac * 100)}%)`)
    return { score: Math.round(42 + jac * 40), reasons }
  }
  return { score: 0, reasons: [] }
}

export const collectAltberichtNameSuggestions = (row: AltberichtImportStagingObjectRow): string[] => {
  const out = new Set<string>()
  const add = (t: string | null | undefined) => {
    const x = t?.trim()
    if (x && x.length > 0) out.add(x)
  }
  add(row.object_name)
  add(row.review_object_name)
  const cat = row.catalog_candidates_json
  /** Strukturierte Parser-Felder fließen nicht doppelt in Namensvorschläge (stehen in Objekttyp/Katalog) */
  const nameHintCatalogSkip = new Set([
    'art',
    'fluegel',
    'anforderung',
    'hersteller',
    'schliessmittel',
    'schliessmittel_typ',
    'status',
  ])
  if (Array.isArray(cat)) {
    for (const c of cat) {
      if (c && typeof c === 'object' && 'raw' in c) {
        const field = (c as { field?: unknown }).field
        if (typeof field === 'string' && nameHintCatalogSkip.has(field)) continue
        const raw = (c as { raw?: unknown }).raw
        if (typeof raw === 'string') add(raw)
      }
    }
  }
  return [...out].slice(0, 12)
}

const effectiveBvId = (row: AltberichtImportStagingObjectRow): string | null =>
  row.review_bv_id ?? row.bv_id ?? null

const objectNameGuess = (row: AltberichtImportStagingObjectRow): string =>
  (row.review_object_name?.trim() || row.object_name?.trim() || '').trim()

const objectTypeGuess = (row: AltberichtImportStagingObjectRow): string =>
  (row.review_object_type_text?.trim() || row.object_type_text?.trim() || '').trim()

/**
 * Erzeugt Payload für `match_candidates_json` (rein funktional).
 */
export const buildAltberichtMatchPayload = (
  row: AltberichtImportStagingObjectRow,
  allBvs: BV[],
  allObjects: Obj[]
): AltberichtMatchPayloadV1 => {
  const siteText = row.site_text ?? ''
  const customerText = row.customer_text ?? ''
  const custId = row.review_customer_id ?? null
  const bvPool = custId ? allBvs.filter((b) => b.customer_id === custId) : allBvs

  const bvScored = bvPool
    .map((bv) => {
      const { score, reasons } = scoreBvAgainstText(bv, siteText, customerText)
      return {
        kind: 'bv' as const,
        id: bv.id,
        label: bv.name,
        score,
        reasons,
      }
    })
    .filter((c) => c.score >= MIN_SCORE_BV)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_BV)

  let bvForObjects = effectiveBvId(row)
  if (!bvForObjects && bvScored.length > 0 && bvScored[0]!.score >= MIN_SCORE_TOP_BV_FOR_OBJECTS) {
    bvForObjects = bvScored[0]!.id
  }

  const nameG = objectNameGuess(row)
  const typeG = objectTypeGuess(row)

  let objectScored: AltberichtMatchCandidateV1[] = []
  if (bvForObjects && (nameG.length >= 2 || typeG.length >= 2)) {
    const objs = allObjects.filter((o) => o.bv_id === bvForObjects)
    objectScored = objs
      .map((o) => {
        const { score, reasons } = scoreObjectAgainstRow(o, nameG, typeG)
        const label = [o.internal_id, o.name].filter(Boolean).join(' · ') || o.id.slice(0, 8)
        return {
          kind: 'object' as const,
          id: o.id,
          label,
          score,
          reasons,
        }
      })
      .filter((c) => c.score >= MIN_SCORE_OBJ)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_OBJ)
  }

  return {
    version: ALTBERICHT_MATCH_PAYLOAD_VERSION,
    computed_at: new Date().toISOString(),
    bv_candidates: bvScored,
    object_candidates: objectScored,
  }
}
