/**
 * Mapping von Altbericht-Import Service-Codes auf UI-Toast-Typen.
 *
 * Ziel: Erfolge (z. B. `imported`, `committed`) erscheinen grün, idempotente
 * Wiederholungen (`already_imported`, `already_committed`, `no_changes`) neutral,
 * Warnungen (`skipped`, `partial`, `fallback`) gelb, Fehler (`failed`,
 * `invalid_input`, `no_object` …) rot. Vermeidet rote Erfolgsmeldungen, die
 * früher durch den implizit-roten `showToast`-Default entstanden sind.
 */

import type { ToastType } from '../../ToastContext'

const SUCCESS_CODES = new Set<string>([
  'imported',
  'committed',
  'saved',
  'reused',
  'parsed',
  'uploaded',
  'row_success',
  'job_completed',
])

const INFO_CODES = new Set<string>([
  'already_imported',
  'already_committed',
  'no_changes',
  'up_to_date',
  'skipped_idempotent',
])

const WARNING_CODES = new Set<string>([
  'partial',
  'partially_completed',
  'skipped',
  'skipped_ineligible',
  'needs_review',
  'page_skipped',
  'image_scan_timeout',
  'fallback',
  'fallback_used',
  'duplicate_linked',
])

const ERROR_CODES = new Set<string>([
  'failed',
  'load_failed',
  'render_failed',
  'upload_failed',
  'parser_failed',
  'commit_failed',
  'c2_failed',
  'readiness_failed',
  'invalid_input',
  'no_object',
  'object_archived',
])

/**
 * Liefert den passenden Toast-Typ für einen Service-Result-Code.
 * Unbekannte / leere Codes → neutral (`'info'`), damit nichts mehr versehentlich rot wird.
 */
export const altberichtToastTypeForCode = (code: string | null | undefined): ToastType => {
  const c = (code ?? '').trim()
  if (!c) return 'info'
  if (SUCCESS_CODES.has(c)) return 'success'
  if (INFO_CODES.has(c)) return 'info'
  if (WARNING_CODES.has(c)) return 'warning'
  if (ERROR_CODES.has(c)) return 'error'
  return 'info'
}

/**
 * Liefert den passenden Toast-Typ für eine Bulk-Operation (Job-Commit, Listen-Commit, …) anhand der
 * Trefferzahlen aus den Einzelresultaten:
 *
 * - mind. ein Erfolg + mind. ein Fehler → Warnung (Teilerfolg)
 * - nur Fehler → Fehler
 * - mind. ein Erfolg, keine Fehler → Erfolg
 * - nur idempotent übersprungen → Info
 * - sonst (alles 0) → Info
 */
export const altberichtBulkResultToastType = (params: {
  ok: number
  bad: number
  skipped: number
}): ToastType => {
  const { ok, bad } = params
  if (bad > 0 && ok > 0) return 'warning'
  if (bad > 0) return 'error'
  if (ok > 0) return 'success'
  return 'info'
}
