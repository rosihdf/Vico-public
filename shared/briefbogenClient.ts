/**
 * Mandanten-Briefbogen: Storage + admin_config (Vico.md §11.2).
 * Client-Parameter als `unknown` + interner Cast: vermeidet TS-Konflikte bei parallelen
 * `node_modules/@supabase/supabase-js` (Haupt-App vs. Arbeitszeit-Portal).
 */
export const BRIEFBOGEN_CONFIG_KEY = 'briefbogen_storage_path'

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

/** Data-URL für jsPDF (PNG/JPEG), oder null wenn nicht konfiguriert / nicht ladbar. PDF: erste Seite → PNG. */
export const fetchBriefbogenDataUrlForPdf = async (client: unknown): Promise<string | null> => {
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
    const { isPdfMagicBytes, renderPdfFirstPageToPngDataUrl } = await import('./renderPdfFirstPageToPngDataUrl')
    if (pathLower.endsWith('.pdf') || mimePdf || isPdfMagicBytes(buf)) {
      return await renderPdfFirstPageToPngDataUrl(buf)
    }
    return await bufferToImageDataUrl(buf, blob.type || 'image/png')
  } catch {
    return null
  }
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
