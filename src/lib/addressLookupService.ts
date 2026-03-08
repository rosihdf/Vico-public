/**
 * Adresssuche: PLZ → Ort, Straßen-Autocomplete (beides via Photon)
 * Photon liefert passendere Ergebnisse für deutsche Adressen.
 */

const PHOTON_BASE = 'https://photon.komoot.io/api'

export type PlzLookupResult = {
  placeName: string
  state?: string
}

export type StreetSuggestion = {
  street: string
  displayName: string
}

/**
 * PLZ eingeben → Ort wird ermittelt (Photon)
 */
export const lookupPlz = async (plz: string): Promise<PlzLookupResult | null> => {
  const clean = plz.replace(/\D/g, '').trim()
  if (clean.length < 4 || clean.length > 5) return null

  try {
    const params = new URLSearchParams({
      q: `${clean} Germany`,
      limit: '10',
      lang: 'de',
    })
    const res = await fetch(`${PHOTON_BASE}/?${params}`)
    if (!res.ok) return null

    const data = (await res.json()) as {
      features?: Array<{
        properties?: {
          postcode?: string
          city?: string
          town?: string
          village?: string
          state?: string
          countrycode?: string
        }
      }>
    }

    for (const f of data.features ?? []) {
      const props = f.properties
      if (!props || props.countrycode !== 'DE') continue
      const resultPostcode = props.postcode?.replace(/\s/g, '')
      if (resultPostcode !== clean) continue
      const city = props.city ?? props.town ?? props.village ?? props.state
      if (city) return { placeName: city, state: props.state }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Straßensuche mit Photon (bessere PLZ-Filterung für Deutschland)
 */
export const searchStreets = async (
  query: string,
  plz: string,
  city: string
): Promise<StreetSuggestion[]> => {
  const q = query.trim()
  if (q.length < 1) return []
  const plzClean = plz.replace(/\D/g, '').trim()
  if (plzClean.length !== 5 || !city.trim()) return []

  try {
    const searchQ = `${q} ${plzClean} ${city}`.trim()
    const params = new URLSearchParams({
      q: searchQ,
      limit: '15',
      lang: 'de',
    })

    const res = await fetch(`${PHOTON_BASE}/?${params}`)
    if (!res.ok) return []

    const data = (await res.json()) as {
      features?: Array<{
        properties?: {
          street?: string
          name?: string
          postcode?: string
          type?: string
        }
      }>
    }

    const seen = new Set<string>()
    const out: StreetSuggestion[] = []
    for (const f of data.features ?? []) {
      const props = f.properties
      if (!props) continue
      const resultPostcode = props.postcode?.replace(/\s/g, '')
      if (resultPostcode && resultPostcode !== plzClean) continue
      const street = props.street ?? (props.type === 'street' ? props.name : null)
      if (!street || seen.has(street)) continue
      seen.add(street)
      out.push({
        street,
        displayName: street,
      })
    }
    return out
  } catch {
    return []
  }
}

