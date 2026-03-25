import type { Object as Obj } from '../types'

type ObjectDisplayInput = {
  name?: string | null
  internal_id?: string | null
  room?: string | null
  floor?: string | null
  manufacturer?: string | null
}

/**
 * Anzeigename für ein Objekt (z. B. in Suche, Auftrag, Wartung, PDF, QR-Code)
 */
export const getObjectDisplayName = (obj: ObjectDisplayInput | null | undefined): string => {
  if (!obj) return '–'
  if (obj.name?.trim()) return obj.name
  if (obj.internal_id?.trim()) return obj.internal_id
  return [obj.room, obj.floor, obj.manufacturer].filter(Boolean).join(' · ') || '–'
}

type RoomFloorInput = {
  room?: string | null
  floor?: string | null
  manufacturer?: string | null
}

/**
 * Formatiert Raum/Etage mit Feldnamen (z.B. "Raum: 1", "Etage: 2")
 */
export const formatObjectRoomFloor = (obj: RoomFloorInput | null | undefined): string => {
  if (!obj) return '–'
  const parts: string[] = []
  if (obj.room?.trim()) parts.push(`Raum: ${obj.room.trim()}`)
  if (obj.floor?.trim()) parts.push(`Etage: ${obj.floor.trim()}`)
  if (parts.length) return parts.join(' · ')
  return obj.manufacturer?.trim() || '–'
}

/** Normalisiert JSON-Liste oder Legacy-Feld `accessories` (ein Text oder mehrere Zeilen). */
export const normalizeAccessoriesItemsFromRow = (
  items: unknown,
  legacyText: string | null | undefined
): string[] => {
  if (Array.isArray(items)) {
    const out = items
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean)
    if (out.length > 0) return out
  }
  const t = (legacyText ?? '').trim()
  if (!t) return []
  const lines = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  return lines.length > 0 ? lines : [t]
}

/** Formular: mindestens eine (leere) Zeile für neue Eingabe */
export const objectAccessoriesToFormLines = (obj: Pick<Obj, 'accessories_items' | 'accessories'>): string[] => {
  const lines = normalizeAccessoriesItemsFromRow(obj.accessories_items, obj.accessories)
  return lines.length > 0 ? lines : ['']
}

export const objectAccessoriesDisplayString = (
  obj: Pick<Obj, 'accessories_items' | 'accessories'>
): string => {
  const lines = normalizeAccessoriesItemsFromRow(obj.accessories_items, obj.accessories)
  if (lines.length === 0) return ''
  return lines.map((s) => `• ${s}`).join('\n')
}

export const accessoriesFormLinesToPayload = (
  lines: string[]
): { accessories_items: string[]; accessories: string | null } => {
  const trimmed = lines.map((s) => s.trim()).filter(Boolean)
  return {
    accessories_items: trimmed,
    accessories: trimmed.length > 0 ? trimmed.join('\n') : null,
  }
}
