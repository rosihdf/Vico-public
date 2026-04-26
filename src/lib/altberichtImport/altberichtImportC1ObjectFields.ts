import type { Object as Obj } from '../../types/object'
import { generateNewObjectInternalId } from '../objectUtils'

type ObjectInsert = Omit<Obj, 'id' | 'created_at' | 'updated_at'> & { updated_at?: string }

/**
 * Liest Staging-`catalog_candidates_json` (Parser: { field, raw }[]).
 * Bei mehrfachem Vorkommen (selten): erstes sinnvoll befülltes Vorkommen.
 */
export const getAltberichtCatalogFieldRaw = (
  catalog: unknown,
  field:
    | 'art'
    | 'fluegel'
    | 'anforderung'
    | 'hersteller'
    | 'schliessmittel_typ'
    | 'schliessmittel'
    | 'fsa_hersteller'
    | 'fsa_typ'
    | 'rauchmelder'
): string | null => {
  if (!Array.isArray(catalog)) return null
  for (const c of catalog) {
    if (!c || typeof c !== 'object') continue
    const f = (c as { field?: unknown }).field
    if (f !== field) continue
    const r = (c as { raw?: unknown }).raw
    if (typeof r === 'string') {
      const t = r.trim()
      if (t.length > 0) return t
    }
  }
  return null
}

const trimCap = (s: string, max: number): string => {
  if (s.length <= max) return s
  return s.slice(0, max).trim()
}

/**
 * WEG-/Altbericht: Flügelzahl als 1…32, sonst `null` (falsche/unklare Werte weglassen).
 */
export const parseWingCountFromFluegelRaw = (raw: string | null | undefined): number | null => {
  if (raw == null) return null
  const t = String(raw).trim()
  if (!t) return null
  const m = t.match(/(\d{1,2})/)
  if (!m || m[1] == null) return null
  const n = parseInt(m[1], 10)
  if (Number.isNaN(n) || n < 1 || n > 32) return null
  return n
}

/**
 * Rauchmelder-Anzahl aus Parser-Kandidat; 0…30, sonst 0 (kein Wert / ungültig).
 */
export const parseRauchmelderCountFromRaw = (raw: string | null | undefined): number => {
  if (raw == null) return 0
  const t = String(raw).trim()
  if (!t) return 0
  const n = parseInt(t, 10)
  if (Number.isNaN(n) || n < 0) return 0
  return Math.min(n, 30)
}

/**
 * Baut Typ-Checkboxen + Freitext aus `object_type_text` bzw. Review-Äquivalent.
 * Verhindert doppelte Anzeige „Tür“: Checkbox *Tür* + Freitext „Tür“ (nur Freitext leeren, wenn reine Türen-Lage).
 */
export const deriveC1ObjectTypeFields = (typeLabel: string): {
  type_tuer: boolean
  type_sektionaltor: boolean
  type_schiebetor: boolean
  type_freitext: string | null
} => {
  const t = typeLabel.trim()
  if (!t) {
    return { type_tuer: true, type_sektionaltor: false, type_schiebetor: false, type_freitext: null }
  }
  const n = t.toLowerCase()
  if (n.includes('sektional') || (n.includes('roll') && n.includes('tor')) || n === 'rolltor') {
    return {
      type_tuer: false,
      type_sektionaltor: true,
      type_schiebetor: false,
      type_freitext: t.length > 48 ? trimCap(t, 200) : null,
    }
  }
  if (n.includes('schieb') && n.includes('tor')) {
    return {
      type_tuer: false,
      type_sektionaltor: false,
      type_schiebetor: true,
      type_freitext: t.length > 48 ? trimCap(t, 200) : null,
    }
  }
  if (n === 'tür' || n === 'tuer' || n === 'door') {
    return { type_tuer: true, type_sektionaltor: false, type_schiebetor: false, type_freitext: null }
  }
  if (n === 'glas' || n === 'stahl' || n === 'holz' || n.startsWith('alu')) {
    return { type_tuer: true, type_sektionaltor: false, type_schiebetor: false, type_freitext: t }
  }
  if (/^glast(ü|u)r$/i.test(t)) {
    return { type_tuer: true, type_sektionaltor: false, type_schiebetor: false, type_freitext: t }
  }
  return { type_tuer: true, type_sektionaltor: false, type_schiebetor: false, type_freitext: t }
}

export const buildC1NewObjectInsertForStaging = (params: {
  bvId: string | null
  customerId: string | null
  name: string
  floor: string | null
  room: string | null
  typeLabel: string
  catalog: unknown
  /** Aus Staging/Persist; sonst wie manuelle Anlage {@link generateNewObjectInternalId}. */
  proposedInternalId?: string | null
}): ObjectInsert => {
  const { type_tuer, type_sektionaltor, type_schiebetor, type_freitext } = deriveC1ObjectTypeFields(
    params.typeLabel
  )
  const fl = getAltberichtCatalogFieldRaw(params.catalog, 'fluegel')
  const wing = parseWingCountFromFluegelRaw(fl)
  const hersteller = getAltberichtCatalogFieldRaw(params.catalog, 'hersteller')
  const schlTyp =
    getAltberichtCatalogFieldRaw(params.catalog, 'schliessmittel_typ') ??
    getAltberichtCatalogFieldRaw(params.catalog, 'schliessmittel')
  const anf = getAltberichtCatalogFieldRaw(params.catalog, 'anforderung')
  const fsaHersteller = getAltberichtCatalogFieldRaw(params.catalog, 'fsa_hersteller')
  const fsaTyp = getAltberichtCatalogFieldRaw(params.catalog, 'fsa_typ')
  const rauchRaw = getAltberichtCatalogFieldRaw(params.catalog, 'rauchmelder')
  const rauchCount = parseRauchmelderCountFromRaw(rauchRaw)
  const hasHoldOpen =
    Boolean(fsaHersteller) || Boolean(fsaTyp) || rauchCount > 0
  const holdOpenManufacturer = fsaHersteller ? trimCap(fsaHersteller, 200) : null
  const holdOpenType = fsaTyp ? trimCap(fsaTyp, 200) : null

  const internalId =
    params.proposedInternalId != null && String(params.proposedInternalId).trim() !== ''
      ? String(params.proposedInternalId).trim()
      : generateNewObjectInternalId()

  return {
    bv_id: params.bvId,
    customer_id: params.customerId,
    name: params.name,
    internal_id: internalId,
    door_position: null,
    internal_door_number: null,
    floor: params.floor,
    room: params.room,
    type_tuer,
    type_sektionaltor,
    type_schiebetor,
    type_freitext,
    wing_count: wing,
    anforderung: anf ? trimCap(anf, 500) : null,
    manufacturer: hersteller ? trimCap(hersteller, 500) : null,
    build_year: null,
    lock_manufacturer: null,
    lock_type: schlTyp ? trimCap(schlTyp, 200) : null,
    has_hold_open: hasHoldOpen,
    hold_open_manufacturer: holdOpenManufacturer,
    hold_open_type: holdOpenType,
    hold_open_approval_no: null,
    hold_open_approval_date: null,
    smoke_detector_count: rauchCount,
    smoke_detector_build_years: null,
    panic_function: null,
    accessories_items: null,
    accessories: null,
    maintenance_by_manufacturer: false,
    hold_open_maintenance: false,
    defects: null,
    defects_structured: null,
    remarks: null,
    maintenance_interval_months: null,
    last_door_maintenance_date: null,
    door_maintenance_date_manual: false,
    hold_open_last_maintenance_date: null,
    hold_open_maintenance_interval_months: null,
    hold_open_last_maintenance_manual: false,
    profile_photo_path: null,
    archived_at: null,
  }
}
