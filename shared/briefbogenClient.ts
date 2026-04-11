/**
 * Mandanten-Briefbogen: Storage + admin_config (Vico.md §11.2).
 * Client-Parameter als `unknown` + interner Cast: vermeidet TS-Konflikte bei parallelen
 * `node_modules/@supabase/supabase-js` (Haupt-App vs. Arbeitszeit-Portal).
 */
import type { BriefbogenDinMarginsMm } from './pdfBriefbogenLayout'
import {
  DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM,
  clampBriefbogenPdfMargins,
  briefbogenMarginsFitA4Portrait,
  briefbogenMarginsFitA4Landscape,
} from './pdfBriefbogenLayout'

export const BRIEFBOGEN_CONFIG_KEY = 'briefbogen_storage_path'

/** JSON in admin_config: { top, bottom, left, right } in mm (partial ok, fehlende Keys = Default). */
export const BRIEFBOGEN_PDF_MARGINS_KEY = 'briefbogen_pdf_margins_mm'

type Sb = import('@supabase/supabase-js').SupabaseClient

const asSb = (client: unknown): Sb => client as Sb

const LETTERHEAD_OBJECT_PATH = 'mandant/briefbogen'

const BRIEFBOGEN_MAX_BYTES = 15 * 1024 * 1024

type BriefbogenConfigValue = {
  storage_path: string
}

const parseConfigValue = (raw: unknown): string | null => {
  if (raw == null) return null
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (typeof raw === 'object' && raw !== null && 'storage_path' in raw) {
    const p = (raw as BriefbogenConfigValue).storage_path
    return typeof p === 'string' && p.trim() ? p.trim() : null
  }
  return null
}

export const fetchBriefbogenStoragePath = async (client: unknown): Promise<string | null> => {
  const sb = asSb(client)
  const { data, error } = await sb
    .from('admin_config')
    .select('value')
    .eq('key', BRIEFBOGEN_CONFIG_KEY)
    .maybeSingle()
  if (error || !data?.value) return null
  return parseConfigValue(data.value)
}

const bufferToImageDataUrl = (buf: ArrayBuffer, mime: string): Promise<string | null> =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(new Blob([buf], { type: mime || 'image/png' }))
  })

/** Raster-Erst- und Folgeseite für PDF-Hintergrund (Bild: beide gleich; PDF: optional 2. Seite). */
export type BriefbogenLetterheadPages = {
  firstPage: string | null
  followPage: string | null
}

export const fetchBriefbogenLetterheadPagesForPdf = async (
  client: unknown
): Promise<BriefbogenLetterheadPages | null> => {
  const sb = asSb(client)
  const path = await fetchBriefbogenStoragePath(client)
  if (!path) return null
  const { data: signed, error: signErr } = await sb.storage.from('briefbogen').createSignedUrl(path, 3600)
  if (signErr || !signed?.signedUrl) return null
  try {
    const res = await fetch(signed.signedUrl, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    const buf = await blob.arrayBuffer()
    const pathLower = path.toLowerCase()
    const mimePdf = blob.type === 'application/pdf' || blob.type === 'application/x-pdf'
    const { isPdfMagicBytes, rasterizePdfBriefbogenToLetterheadPages } = await import(
      './renderPdfFirstPageToPngDataUrl'
    )
    if (pathLower.endsWith('.pdf') || mimePdf || isPdfMagicBytes(buf)) {
      const pages = await rasterizePdfBriefbogenToLetterheadPages(buf)
      if (!pages?.firstPage) return null
      return pages
    }
    const imageUrl = await bufferToImageDataUrl(buf, blob.type || 'image/png')
    if (!imageUrl) return null
    return { firstPage: imageUrl, followPage: imageUrl }
  } catch {
    return null
  }
}

/** Nur Erstseite – Abwärtskompatibel; bei PDF mit 2 Seiten besser `fetchBriefbogenLetterheadPagesForPdf`. */
export const fetchBriefbogenDataUrlForPdf = async (client: unknown): Promise<string | null> => {
  const pages = await fetchBriefbogenLetterheadPagesForPdf(client)
  return pages?.firstPage ?? null
}

/** Kurz gültige Signed-URL für Vorschau (Einstellungen). */
export const createBriefbogenPreviewUrl = async (client: unknown): Promise<string | null> => {
  const sb = asSb(client)
  const path = await fetchBriefbogenStoragePath(client)
  if (!path) return null
  const { data, error } = await sb.storage.from('briefbogen').createSignedUrl(path, 600)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export const uploadBriefbogenFile = async (client: unknown, file: File): Promise<{ ok: boolean; error?: string }> => {
  const sb = asSb(client)
  if (file.size > BRIEFBOGEN_MAX_BYTES) {
    return { ok: false, error: 'Datei zu groß (max. 15 MB).' }
  }
  const nameLower = file.name.toLowerCase()
  const isPng = file.type === 'image/png' || nameLower.endsWith('.png')
  const isJpeg =
    file.type === 'image/jpeg' || file.type === 'image/jpg' || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')
  const isPdf = file.type === 'application/pdf' || nameLower.endsWith('.pdf')
  if (!isPng && !isJpeg && !isPdf) {
    return { ok: false, error: 'Bitte PNG-, JPEG- oder PDF-Datei wählen.' }
  }
  const ext = isPdf ? 'pdf' : isPng ? 'png' : 'jpg'
  const path = `${LETTERHEAD_OBJECT_PATH}.${ext}`

  await sb.storage.from('briefbogen').remove([
    `${LETTERHEAD_OBJECT_PATH}.png`,
    `${LETTERHEAD_OBJECT_PATH}.jpg`,
    `${LETTERHEAD_OBJECT_PATH}.pdf`,
  ])

  const contentType = isPdf
    ? 'application/pdf'
    : file.type || (isPng ? 'image/png' : 'image/jpeg')

  const { error: upErr } = await sb.storage.from('briefbogen').upload(path, file, {
    upsert: true,
    contentType,
  })
  if (upErr) {
    return { ok: false, error: upErr.message }
  }

  const { error: cfgErr } = await sb.from('admin_config').upsert(
    { key: BRIEFBOGEN_CONFIG_KEY, value: { storage_path: path } },
    { onConflict: 'key' }
  )
  if (cfgErr) {
    return { ok: false, error: cfgErr.message }
  }
  return { ok: true }
}

const numLike = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return null
}

const FOLLOW_PAGE_COMPACT_TOP_KEY = 'follow_page_compact_top'

const mergeMarginsWithDefaults = (raw: unknown): BriefbogenDinMarginsMm => {
  const d = DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM
  if (raw == null || typeof raw !== 'object') return { ...d }
  const o = raw as Record<string, unknown>
  const pick = (k: keyof BriefbogenDinMarginsMm): number => {
    const n = numLike(o[k as string])
    return n != null ? n : d[k]
  }
  return clampBriefbogenPdfMargins({
    top: pick('top'),
    bottom: pick('bottom'),
    left: pick('left'),
    right: pick('right'),
  })
}

const parseFollowPageCompactTop = (raw: unknown): boolean => {
  if (raw == null || typeof raw !== 'object') return false
  const v = (raw as Record<string, unknown>)[FOLLOW_PAGE_COMPACT_TOP_KEY]
  return v === true || v === 'true'
}

export type BriefbogenPdfTextLayout = {
  margins: BriefbogenDinMarginsMm
  /** Ab Seite 2: oberen Rand wie ohne Briefkopf (klein), wenn die Vorlage dort keinen Kopf hat. */
  followPageCompactTop: boolean
}

export const fetchBriefbogenPdfTextLayout = async (
  client: unknown
): Promise<BriefbogenPdfTextLayout> => {
  const sb = asSb(client)
  const { data, error } = await sb
    .from('admin_config')
    .select('value')
    .eq('key', BRIEFBOGEN_PDF_MARGINS_KEY)
    .maybeSingle()
  if (error || data?.value == null) {
    return {
      margins: { ...DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM },
      followPageCompactTop: false,
    }
  }
  return {
    margins: mergeMarginsWithDefaults(data.value),
    followPageCompactTop: parseFollowPageCompactTop(data.value),
  }
}

/** Nur Ränder (Kompatibilität); für Folgeseiten-Option bitte fetchBriefbogenPdfTextLayout. */
export const fetchBriefbogenPdfMarginsMm = async (
  client: unknown
): Promise<BriefbogenDinMarginsMm> => {
  const { margins } = await fetchBriefbogenPdfTextLayout(client)
  return margins
}

export const saveBriefbogenPdfTextLayout = async (
  client: unknown,
  layout: BriefbogenPdfTextLayout
): Promise<{ ok: boolean; error?: string }> => {
  const m = clampBriefbogenPdfMargins(layout.margins)
  if (!briefbogenMarginsFitA4Portrait(m) || !briefbogenMarginsFitA4Landscape(m)) {
    return {
      ok: false,
      error:
        'Ränder zu groß: Der Textbereich muss auf A4 Hoch- und Querformat passen (z. B. Summe oben+unten unter ca. 195 mm für Quer).',
    }
  }
  const value = {
    ...m,
    [FOLLOW_PAGE_COMPACT_TOP_KEY]: Boolean(layout.followPageCompactTop),
  }
  const sb = asSb(client)
  const { error } = await sb.from('admin_config').upsert(
    { key: BRIEFBOGEN_PDF_MARGINS_KEY, value },
    { onConflict: 'key' }
  )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Entfernt gespeicherte Korrektur → wieder reine Defaults. */
export const removeBriefbogenPdfMargins = async (
  client: unknown
): Promise<{ ok: boolean; error?: string }> => {
  const sb = asSb(client)
  const { error } = await sb.from('admin_config').delete().eq('key', BRIEFBOGEN_PDF_MARGINS_KEY)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export const removeBriefbogen = async (client: unknown): Promise<{ ok: boolean; error?: string }> => {
  const sb = asSb(client)
  const path = await fetchBriefbogenStoragePath(client)
  if (path) {
    const { error: rmErr } = await sb.storage.from('briefbogen').remove([path])
    if (rmErr) {
      return { ok: false, error: rmErr.message }
    }
  }
  const { error: delErr } = await sb.from('admin_config').delete().eq('key', BRIEFBOGEN_CONFIG_KEY)
  if (delErr) {
    return { ok: false, error: delErr.message }
  }
  return { ok: true }
}
