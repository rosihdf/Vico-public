type ObjectDisplayInput = {
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
  if (obj.internal_id?.trim()) return obj.internal_id
  return [obj.room, obj.floor, obj.manufacturer].filter(Boolean).join(' · ') || '–'
}
