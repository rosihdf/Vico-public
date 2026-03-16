/** Gemeinsamer Fehler-Report-Service für alle Vico-Apps */

import type { SupabaseClient } from '@supabase/supabase-js'

export type ErrorReportSource =
  | 'main_app'
  | 'portal'
  | 'admin'
  | 'zeiterfassung'
  | 'arbeitszeit_portal'

export type ErrorReportPayload = {
  message: string
  stack?: string | null
  path?: string | null
  source: ErrorReportSource
  userAgent?: string | null
}

const DEDUP_MS = 30000
const seenKeys = new Map<string, number>()

const getFingerprint = (message: string, stack?: string | null): string => {
  const firstLine = stack?.split('\n')[1]?.trim() ?? ''
  return `${message.slice(0, 200)}|${firstLine.slice(0, 150)}`
}

const shouldSkipDedup = (key: string): boolean => {
  const now = Date.now()
  if (seenKeys.has(key)) {
    const t = seenKeys.get(key)!
    if (now - t < DEDUP_MS) return true
  }
  seenKeys.set(key, now)
  for (const [k, t] of seenKeys) {
    if (now - t > DEDUP_MS) seenKeys.delete(k)
  }
  return false
}

/**
 * Erstellt einen Fehler-Reporter für die gegebene Supabase-Instanz.
 * Jede App ruft createErrorReporter(supabase) auf und nutzt reportError mit dem passenden source.
 */
export function createErrorReporter(supabase: SupabaseClient) {
  return {
    reportError: async (payload: ErrorReportPayload): Promise<void> => {
      const { message, stack, path, source, userAgent } = payload
      const trimmed = message?.trim()
      if (!trimmed) return

      const key = getFingerprint(trimmed, stack)
      if (shouldSkipDedup(key)) return

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return

        const pathVal =
          path ??
          (typeof window !== 'undefined'
            ? window.location.pathname + window.location.search
            : null)
        const ua =
          userAgent ??
          (typeof navigator !== 'undefined' ? navigator.userAgent : null)

        await supabase.rpc('report_app_error', {
          p_message: trimmed.slice(0, 2000),
          p_stack: stack?.slice(0, 8000) ?? null,
          p_path: pathVal?.slice(0, 2000) ?? null,
          p_source: source,
          p_user_agent: ua?.slice(0, 500) ?? null,
        })
      } catch {
        // Nicht erneut werfen, um Rekursion zu vermeiden
      }
    },
  }
}
