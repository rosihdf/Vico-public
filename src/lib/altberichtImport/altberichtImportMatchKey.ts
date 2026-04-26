import type { Object as Obj } from '../../types/object'
import { getAltberichtCatalogFieldRaw } from './altberichtImportC1ObjectFields'
import type { AltberichtParserStagingObjectV1 } from './parserContractV1'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'
import type { AltberichtStagingRowInput } from './altberichtImportReviewTypes'
import {
  getEffectiveBvId,
  getEffectiveFloor,
  getEffectiveObjectName,
  getEffectiveObjectType,
  getEffectiveRoom,
} from './altberichtStagingValidation'

const norm = (s: string | null | undefined): string =>
  (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Wie im C1-Abgleich (`formatProductObjectType`), danach normalisiert für den Schlüssel
 * (Alignment mit `getEffectiveObjectType` / Review-Text).
 */
const formatObjectTypeLabelForKey = (o: Pick<Obj, 'type_tuer' | 'type_sektionaltor' | 'type_schiebetor' | 'type_freitext'>): string => {
  const parts: string[] = []
  if (o.type_tuer) parts.push('Tür')
  if (o.type_sektionaltor) parts.push('Sektionaltor')
  if (o.type_schiebetor) parts.push('Schiebetor')
  const ft = o.type_freitext?.trim()
  if (ft) parts.push(ft)
  return parts.length > 0 ? parts.join(', ') : ''
}

const stagingRowToInput = (row: AltberichtImportStagingObjectRow): AltberichtStagingRowInput => ({
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

/**
 * Persistenter Schlüssel pro Parser-Position (inkl. Sequenz), für Audit/Debug und Importzeilen erkennbar.
 * Kein harter Duplikatschutz.
 */
export const buildImportMatchKeyFromParserObject = (o: AltberichtParserStagingObjectV1): string => {
  const cat = o.catalogCandidates
  const anf = getAltberichtCatalogFieldRaw(cat, 'anforderung')
  const herst = getAltberichtCatalogFieldRaw(cat, 'hersteller')
  return [
    'mk1',
    norm(o.customerText ?? null),
    norm(o.siteText ?? null),
    o.bvId ?? '',
    String(o.sequence),
    norm(o.floorText ?? null),
    norm(o.roomText ?? null),
    norm(o.objectName),
    norm(o.objectTypeText),
    norm(anf),
    norm(herst),
  ].join('|')
}

/**
 * Inhaltlicher Fingerprint **ohne** Sequenz: gleiche Logik-Seite (Review-effektiv + Katalog) wie
 * {@link buildAltberichtDuplicateCheckKeyForObject} – für weiche „bereits vorhanden?“-Hinweise.
 */
export const buildAltberichtDuplicateCheckKeyFromStaging = (
  row: AltberichtImportStagingObjectRow,
  reviewCustomerId: string
): string | null => {
  const c = String(reviewCustomerId).trim()
  if (!c) return null
  const input = stagingRowToInput(row)
  const cat = row.catalog_candidates_json
  const bv = getEffectiveBvId(input) ?? ''
  const anf = getAltberichtCatalogFieldRaw(cat, 'anforderung')
  const herst = getAltberichtCatalogFieldRaw(cat, 'hersteller')
  const floor = getEffectiveFloor(input) || (row.floor_text?.trim() ?? '')
  const room = getEffectiveRoom(input) || (row.room_text?.trim() ?? '')
  return [
    'dup1',
    c,
    bv,
    norm(getEffectiveObjectName(input)),
    norm(getEffectiveObjectType(input)),
    norm(floor),
    norm(room),
    norm(anf),
    norm(herst),
  ].join('|')
}

export const buildAltberichtDuplicateCheckKeyForObject = (o: Obj, reviewCustomerId: string): string | null => {
  const c = String(reviewCustomerId).trim()
  if (!c) return null
  const cust = o.customer_id ?? null
  if (cust == null || String(cust) !== c) return null
  return [
    'dup1',
    c,
    o.bv_id ?? '',
    norm(o.name),
    norm(formatObjectTypeLabelForKey(o)),
    norm(o.floor),
    norm(o.room),
    norm(o.anforderung),
    norm(o.manufacturer),
  ].join('|')
}

export type AltberichtSoftDuplicateHint = { id: string; label: string }

/**
 * Weiche Dublettenwarnung: gleicher fachlicher Schlüssel wie ein Produktivobjekt (Kunde+BV+Name+Typ+Ort+Anf+Herst.),
 * ohne blockierend zu sein.
 */
export const listAltberichtSoftDuplicateHints = (
  row: AltberichtImportStagingObjectRow,
  allObjects: Obj[],
  objectLabel: (o: Obj) => string
): AltberichtSoftDuplicateHint[] => {
  if (row.committed_at) return []
  const linked = row.review_object_id?.trim()
  if (linked) return []
  const cust = row.review_customer_id?.trim()
  if (!cust) return []
  const key = buildAltberichtDuplicateCheckKeyFromStaging(row, cust)
  if (!key) return []
  const out: AltberichtSoftDuplicateHint[] = []
  for (const o of allObjects) {
    if (o.archived_at) continue
    if (o.id === linked) continue
    const ok = buildAltberichtDuplicateCheckKeyForObject(o, cust)
    if (ok != null && ok === key) {
      out.push({ id: o.id, label: objectLabel(o) })
    }
  }
  return out
}
