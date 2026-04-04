/**
 * §11.18: Mandanten-Supabase-Transport (fetch).
 * - WP-NET-01: Degraded bei Transport-Fehler / Erfolg zurücksetzen
 * - WP-NET-03: Lesen GET/HEAD mit 3s Timeout (§11.18#9)
 * - WP-NET-04: Schreiben POST/PATCH/PUT/DELETE mit 3 Retries à 500ms (§11.18#9); Outbox danach weiter in der App (dataService), nicht im fetch
 */

type Listener = () => void

let mandantDegraded = false
const listeners = new Set<Listener>()

/** §11.18#9 Lesen */
export const MANDANT_READ_TIMEOUT_MS = 3000

/** §11.18#9 Schreiben: Erstversuch + 3 Retries = 4 Versuche insgesamt. */
export const MANDANT_WRITE_ATTEMPT_COUNT = 4
export const MANDANT_WRITE_RETRY_DELAY_MS = 500

export const getMandantDegradedSnapshot = (): boolean => mandantDegraded

export const subscribeMandantDegraded = (cb: Listener): (() => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const emit = (): void => {
  for (const l of listeners) l()
}

export const reportMandantTransportFailure = (): void => {
  if (!mandantDegraded) {
    mandantDegraded = true
    emit()
  }
}

export const reportMandantTransportSuccess = (): void => {
  if (mandantDegraded) {
    mandantDegraded = false
    emit()
  }
}

/** Nur für Tests. */
export const resetMandantDegradedForTests = (): void => {
  mandantDegraded = false
  emit()
}

const normalizeSupabaseOrigin = (baseUrl: string): string => {
  const t = baseUrl.trim()
  if (!t) return ''
  try {
    const u = new URL(t)
    return u.origin
  } catch {
    return ''
  }
}

const resolveRequestUrl = (input: RequestInfo | URL, baseOrigin: string): string => {
  if (typeof input === 'string') {
    try {
      return new URL(input, baseOrigin).href
    } catch {
      return input
    }
  }
  if (input instanceof URL) return input.href
  return input.url
}

const isRequestToMandantOrigin = (requestUrl: string, mandantOrigin: string): boolean => {
  if (!mandantOrigin) return false
  try {
    return new URL(requestUrl).origin === mandantOrigin
  } catch {
    return requestUrl.startsWith(mandantOrigin)
  }
}

const getEffectiveMethod = (input: RequestInfo | URL, init?: RequestInit): string => {
  const fromInit = init?.method?.trim()
  if (fromInit) return fromInit.toUpperCase()
  if (typeof input !== 'string' && !(input instanceof URL)) {
    const m = input.method?.trim()
    if (m) return m.toUpperCase()
  }
  return 'GET'
}

const isReadLikeMethod = (m: string): boolean => m === 'GET' || m === 'HEAD'

/** Supabase-RPC ist POST, gilt fürs Timeout wie Lesen (keine Schreib-Retries). */
const isRpcPost = (m: string, requestUrl: string): boolean =>
  m === 'POST' && requestUrl.includes('/rest/v1/rpc/')

const isWriteLikeMethod = (m: string, requestUrl: string): boolean => {
  if (isRpcPost(m, requestUrl)) return false
  return m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE'
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

/** Kombiniert Nutzer-Abort mit Timeout (AbortSignal.any, Fallback nur Timeout). */
const mergeAbortWithTimeout = (
  userSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } => {
  const timeoutCtrl = new AbortController()
  const tid = globalThis.setTimeout(() => timeoutCtrl.abort(), timeoutMs)
  const clearT = () => globalThis.clearTimeout(tid)

  if (!userSignal) {
    return { signal: timeoutCtrl.signal, cleanup: clearT }
  }

  const Any = AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal
  }
  if (typeof Any.any === 'function') {
    return {
      signal: Any.any([timeoutCtrl.signal, userSignal]),
      cleanup: clearT,
    }
  }

  const onUserAbort = (): void => {
    timeoutCtrl.abort()
  }
  if (userSignal.aborted) {
    timeoutCtrl.abort()
    return { signal: timeoutCtrl.signal, cleanup: clearT }
  }
  userSignal.addEventListener('abort', onUserAbort, { once: true })
  return {
    signal: timeoutCtrl.signal,
    cleanup: () => {
      clearT()
      userSignal.removeEventListener('abort', onUserAbort)
    },
  }
}

/**
 * Wrappt fetch: bei erfolgreichem Response (kein throw) → Degraded beenden;
 * bei endgültigem Throw (Netzwerk, Timeout, …) → Degraded setzen.
 * HTTP-Status 4xx/5xx zählen als erfolgreiche Transport-Schicht (Server erreichbar).
 */
export const createMandantDegradedAwareFetch = (
  mandantSupabaseBaseUrl: string,
  innerFetch: typeof fetch = globalThis.fetch.bind(globalThis)
): typeof fetch => {
  const origin = normalizeSupabaseOrigin(mandantSupabaseBaseUrl)
  if (!origin) return innerFetch

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestUrl = resolveRequestUrl(input, origin)
    const track = isRequestToMandantOrigin(requestUrl, origin)
    const method = getEffectiveMethod(input, init)

    if (track && (isReadLikeMethod(method) || isRpcPost(method, requestUrl))) {
      const userSig = init?.signal ?? undefined
      const { signal: mergedSignal, cleanup } = mergeAbortWithTimeout(userSig, MANDANT_READ_TIMEOUT_MS)
      try {
        const res = await innerFetch(input, { ...init, signal: mergedSignal })
        cleanup()
        reportMandantTransportSuccess()
        return res
      } catch (e) {
        cleanup()
        reportMandantTransportFailure()
        throw e
      }
    }

    if (track && isWriteLikeMethod(method, requestUrl)) {
      let lastErr: unknown
      for (let attempt = 0; attempt < MANDANT_WRITE_ATTEMPT_COUNT; attempt++) {
        if (attempt > 0) await delay(MANDANT_WRITE_RETRY_DELAY_MS)
        try {
          const res = await innerFetch(input, init)
          reportMandantTransportSuccess()
          return res
        } catch (e) {
          lastErr = e
        }
      }
      reportMandantTransportFailure()
      throw lastErr
    }

    try {
      const res = await innerFetch(input, init)
      if (track) reportMandantTransportSuccess()
      return res
    } catch (e) {
      if (track) reportMandantTransportFailure()
      throw e
    }
  }
}
