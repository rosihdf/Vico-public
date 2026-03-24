/**
 * Lokales Preset für QR-Etiketten (Roadmap I2) – wird von der nativen Druck-Schicht
 * (`etikettendrucker.ts`) und den Einstellungen genutzt. Kein Server-Sync (Gerätgebunden).
 */

const STORAGE_KEY = 'vico-etikett-preset-v1'

export type EtikettPresetId = 'mini_50x25' | 'herma_5051' | 'herma_4736' | 'custom_45x22'

export type EtikettPresetOption = {
  id: EtikettPresetId
  label: string
  widthMm: number
  heightMm: number
  description?: string
}

export const ETIKETT_PRESET_OPTIONS: EtikettPresetOption[] = [
  {
    id: 'mini_50x25',
    label: 'Universal mini (~50×25 mm)',
    widthMm: 50,
    heightMm: 25,
    description: 'Gängiges Klebeetikett, z. B. Vielzweck',
  },
  {
    id: 'herma_5051',
    label: 'HERMA 5051 (48,3×25,4 mm)',
    widthMm: 48.3,
    heightMm: 25.4,
  },
  {
    id: 'herma_4736',
    label: 'HERMA L4736REV-25 (45,7×21,2 mm)',
    widthMm: 45.7,
    heightMm: 21.2,
  },
  {
    id: 'custom_45x22',
    label: 'Kompakt (45×22 mm)',
    widthMm: 45,
    heightMm: 22,
  },
]

const DEFAULT_PRESET: EtikettPresetId = 'mini_50x25'

const isPresetId = (v: string): v is EtikettPresetId =>
  ETIKETT_PRESET_OPTIONS.some((o) => o.id === v)

export const getEtikettPresetId = (): EtikettPresetId => {
  if (typeof window === 'undefined') return DEFAULT_PRESET
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw && isPresetId(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_PRESET
}

export const setEtikettPresetId = (id: EtikettPresetId): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

export const getEtikettPresetDimensions = (): { widthMm: number; heightMm: number } => {
  const id = getEtikettPresetId()
  const opt = ETIKETT_PRESET_OPTIONS.find((o) => o.id === id)
  return { widthMm: opt?.widthMm ?? 50, heightMm: opt?.heightMm ?? 25 }
}
