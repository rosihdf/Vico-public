import { supabase } from './supabase'

const BUCKET = 'tenant_logos'
const MAX_BYTES = 2 * 1024 * 1024
const MAX_EDGE = 2048

/** Lädt Bild, skaliert (max Kante), konvertiert zu WebP und lädt in Storage. */
export const uploadTenantLogoWebP = async (
  tenantId: string,
  file: File
): Promise<{ publicUrl: string | null; error: string | null }> => {
  if (!tenantId?.trim()) return { publicUrl: null, error: 'Keine Mandanten-ID.' }
  if (file.size > MAX_BYTES) {
    return { publicUrl: null, error: `Datei zu groß (max. ${MAX_BYTES / 1024 / 1024} MB).` }
  }
  const path = `${tenantId}/logo.webp`

  try {
    const bitmap = await createImageBitmap(file)
    const w = bitmap.width
    const h = bitmap.height
    const ratio = Math.min(1, MAX_EDGE / Math.max(w, h))
    const cw = Math.round(w * ratio)
    const ch = Math.round(h * ratio)
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return { publicUrl: null, error: 'Canvas nicht verfügbar.' }
    ctx.drawImage(bitmap, 0, 0, cw, ch)
    bitmap.close()

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.88)
    )
    if (!blob || blob.size === 0) {
      return { publicUrl: null, error: 'WebP-Konvertierung fehlgeschlagen (Browser zu alt?).' }
    }

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: 'image/webp',
      cacheControl: '3600',
    })
    if (upErr) return { publicUrl: null, error: upErr.message }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return { publicUrl: data.publicUrl, error: null }
  } catch (e) {
    return { publicUrl: null, error: e instanceof Error ? e.message : 'Upload fehlgeschlagen.' }
  }
}

export const removeTenantLogoFromStorage = async (tenantId: string): Promise<{ error: string | null }> => {
  const path = `${tenantId}/logo.webp`
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return { error: error?.message ?? null }
}
