/**
 * Liest die im Bildscan übersprungenen PDF-Seiten pro Datei aus den Import-Events.
 *
 * Quelle ist `altbericht_import_event` mit Code `import.parser.embedded_image_page_skipped`
 * (Payload `{ skippedPages: number[] }`). Pro Datei wird das jeweils **neueste** Skip-Event verwendet,
 * damit die UI auch nach Reparse mit Reuse den letzten Stand zeigt.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { ALTBERICHT_IMPORT_EVENT_PAGE_SKIPPED } from './altberichtImportConstants'

export type AltberichtSkippedPagesByFile = Map<string, number[]>

const MAX_SKIPPED_EVENT_FETCH = 500

const parseSkippedPagesPayload = (payload: unknown): number[] => {
  if (!payload || typeof payload !== 'object') return []
  const raw = (payload as { skippedPages?: unknown }).skippedPages
  if (!Array.isArray(raw)) return []
  const out = new Set<number>()
  for (const p of raw) {
    if (typeof p === 'number' && Number.isFinite(p) && p >= 1) out.add(Math.floor(p))
  }
  return [...out].sort((a, b) => a - b)
}

export const fetchAltberichtSkippedPagesByFileForJob = async (
  jobId: string,
  client: SupabaseClient
): Promise<{ pagesByFile: AltberichtSkippedPagesByFile; error: Error | null }> => {
  const { data, error } = await client
    .from('altbericht_import_event')
    .select('file_id, payload_json, created_at, code')
    .eq('job_id', jobId)
    .in('code', [ALTBERICHT_IMPORT_EVENT_PAGE_SKIPPED])
    .order('created_at', { ascending: false })
    .limit(MAX_SKIPPED_EVENT_FETCH)

  if (error) return { pagesByFile: new Map(), error: new Error(error.message) }

  const pagesByFile: AltberichtSkippedPagesByFile = new Map()
  const seen = new Set<string>()
  for (const raw of (data ?? []) as Array<{
    file_id?: string | null
    payload_json?: unknown
  }>) {
    const fid = raw.file_id?.trim() ?? ''
    if (!fid || seen.has(fid)) continue
    seen.add(fid)
    pagesByFile.set(fid, parseSkippedPagesPayload(raw.payload_json))
  }
  return { pagesByFile, error: null }
}

/**
 * Schnittmenge der Skipped-Pages der Datei mit den Seiten,
 * die in der Staging-Zeile (Quellen / Medien / Findings) erwähnt werden.
 */
export const getStagingRowSkippedPages = (
  rowMentionedPages: Set<number>,
  fileSkippedPages: number[]
): number[] => {
  if (rowMentionedPages.size === 0 || fileSkippedPages.length === 0) return []
  const out: number[] = []
  for (const p of fileSkippedPages) {
    if (rowMentionedPages.has(p)) out.push(p)
  }
  return out
}
