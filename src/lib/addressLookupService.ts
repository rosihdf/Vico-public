/**
 * Adresssuche via OpenPLZ API (Deutschland)
 * https://www.openplzapi.org/de/
 */

const OPENPLZ_BASE = 'https://openplzapi.org/de'

/**
 * PLZ eingeben → Ort wird ermittelt (nur Hauptort, erste Locality)
 */
export const lookupPlz = async (plz: string): Promise<string | null> => {
  const clean = plz.replace(/\D/g, '').trim()
  if (clean.length !== 5) return null

  try {
    const res = await fetch(
      `${OPENPLZ_BASE}/Localities?postalCode=${encodeURIComponent(clean)}&pageSize=1`,
      { headers: { accept: 'application/json' } }
    )
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ name: string }>
    return data?.[0]?.name ?? null
  } catch {
    return null
  }
}

/**
 * Straßensuche: PLZ + mind. 1 Zeichen → Straßen unter dieser PLZ
 */
export const searchStreets = async (
  query: string,
  plz: string
): Promise<string[]> => {
  const q = query.trim()
  if (q.length < 1) return []
  const plzClean = plz.replace(/\D/g, '').trim()
  if (plzClean.length !== 5) return []

  try {
    const nameParam = encodeURIComponent(q)
    const res = await fetch(
      `${OPENPLZ_BASE}/Streets?postalCode=${plzClean}&name=${nameParam}&pageSize=20`,
      { headers: { accept: 'application/json' } }
    )
    if (!res.ok) return []
    const data = (await res.json()) as Array<{ name: string }>
    const seen = new Set<string>()
    return (data ?? [])
      .map((r) => r.name?.trim())
      .filter((name) => name && !seen.has(name) && (seen.add(name), true))
  } catch {
    return []
  }
}
