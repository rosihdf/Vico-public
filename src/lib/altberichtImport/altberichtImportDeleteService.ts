import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase'

type FileStorageRow = {
  storage_bucket: string
  storage_path: string
  extracted_text_storage_path: string | null
}

/**
 * Löscht einen Import-Job inkl. abhängiger DB-Zeilen (FK `on delete cascade` auf
 * `altbericht_import_file`, Staging, Events). Vor dem Löschen werden bekannte
 * Storage-Objekte (Original-PDF, optional `extracted_text_storage_path` imselben Bucket) entfernt.
 * Wenn ein Storage-Remove fehlschlägt, wird der DB-Lauf dennoch versucht, damit die Oberfläche
 * nicht blockiert; verbleibende Dateien wären dann Waisen im Bucket.
 */
export const deleteAltberichtImportJob = async (
  jobId: string,
  client: SupabaseClient = supabase
): Promise<{ error: Error | null; storageRemoveErrors: string[] }> => {
  const storageRemoveErrors: string[] = []
  const { data: files, error: listErr } = await client
    .from('altbericht_import_file')
    .select('storage_bucket, storage_path, extracted_text_storage_path')
    .eq('job_id', jobId)
  if (listErr) {
    return { error: new Error(listErr.message), storageRemoveErrors }
  }
  const byBucket = new Map<string, Set<string>>()
  for (const f of (files ?? []) as FileStorageRow[]) {
    const bucket = f.storage_bucket?.trim() || 'altbericht-import-pdfs'
    if (!byBucket.has(bucket)) byBucket.set(bucket, new Set())
    if (f.storage_path?.trim()) byBucket.get(bucket)!.add(f.storage_path.trim())
    if (f.extracted_text_storage_path?.trim()) byBucket.get(bucket)!.add(f.extracted_text_storage_path.trim())
  }
  for (const [bucket, paths] of byBucket) {
    const list = [...paths]
    if (list.length === 0) continue
    const { error: remErr } = await client.storage.from(bucket).remove(list)
    if (remErr) storageRemoveErrors.push(`${bucket}: ${remErr.message}`)
  }

  const { error: delErr } = await client.from('altbericht_import_job').delete().eq('id', jobId)
  if (delErr) return { error: new Error(delErr.message), storageRemoveErrors }
  return { error: null, storageRemoveErrors }
}
