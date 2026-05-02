import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_BUFFER_ENTRIES = 4

const lruOrder: string[] = []
const buffers = new Map<string, ArrayBuffer>()

const touch = (key: string): void => {
  const i = lruOrder.indexOf(key)
  if (i >= 0) lruOrder.splice(i, 1)
  lruOrder.push(key)
}

/**
 * LRU pro PDF-Pfad (Bucket+Key). Reduziert parallele Storage-Downloads und Speicherdruck
 * gegenüber dauerhaftem Vorhalten aller Dokumente.
 */
export const getAltberichtImportPdfBufferCached = async (
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<ArrayBuffer | null> => {
  const key = `${bucket}:${path}`
  const hit = buffers.get(key)
  if (hit) {
    touch(key)
    /** Kopie vermeiden: Caller nutzt read-only ohne Mutation des Buffers nicht nötig; pdf.js kopiert bei getDocument oft intern. */
    return hit.slice(0)
  }
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) return null
  const raw = await data.arrayBuffer()
  buffers.set(key, raw)
  touch(key)
  while (buffers.size > MAX_BUFFER_ENTRIES) {
    const oldest = lruOrder.shift()
    if (oldest) buffers.delete(oldest)
  }
  return raw.slice(0)
}

export const clearAltberichtImportPdfBufferCache = (): void => {
  buffers.clear()
  lruOrder.length = 0
}
