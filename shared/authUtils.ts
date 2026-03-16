/** Gemeinsame Auth-Utilities für Admin und Arbeitszeitenportal */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Promise mit Timeout (reject bei Überschreitung). */
export const withTimeoutReject = <T>(
  p: Promise<T>,
  ms: number,
  errorMsg = 'Zeitüberschreitung'
): Promise<T> =>
  Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), ms)
    ),
  ])

/** Promise mit Timeout (gibt Fallback zurück bei Überschreitung). */
export const withTimeoutFallback = <T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms)
  })
  return Promise.race([promise, timeout]).then((result) => {
    clearTimeout(timeoutId!)
    return result
  })
}

/** Prüft, ob die aktuelle Rolle in allowedRoles ist. */
export const checkRole = async (
  supabase: SupabaseClient,
  allowedRoles: readonly string[]
): Promise<boolean> => {
  const { data, error } = await supabase.rpc('get_my_role')
  if (error || data == null) return false
  return allowedRoles.includes(data as string)
}
