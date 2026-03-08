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
