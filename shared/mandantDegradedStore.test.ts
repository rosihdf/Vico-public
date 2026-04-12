import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getMandantDegradedSnapshot,
  reportMandantTransportFailure,
  reportMandantTransportSuccess,
  resetMandantDegradedForTests,
  createMandantDegradedAwareFetch,
  MANDANT_READ_TIMEOUT_MS,
  MANDANT_WRITE_ATTEMPT_COUNT,
  MANDANT_DEGRADED_FAILURE_THRESHOLD,
  MANDANT_DEGRADED_FAILURE_WINDOW_MS,
} from './mandantDegradedStore'

beforeEach(() => {
  resetMandantDegradedForTests()
})

describe('mandantDegradedStore', () => {
  it('einzelner Failure setzt noch kein Degraded', () => {
    reportMandantTransportFailure()
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('zwei Failures im Fenster setzen Degraded', () => {
    reportMandantTransportFailure()
    reportMandantTransportFailure()
    expect(getMandantDegradedSnapshot()).toBe(true)
  })

  it('Success setzt zurück und leert Fehlerfenster', () => {
    reportMandantTransportFailure()
    reportMandantTransportFailure()
    expect(getMandantDegradedSnapshot()).toBe(true)
    reportMandantTransportSuccess()
    expect(getMandantDegradedSnapshot()).toBe(false)
    reportMandantTransportFailure()
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('Fehler außerhalb des Fensters zählen nicht mehr (gleitend)', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'))
      reportMandantTransportFailure()
      vi.setSystemTime(new Date('2026-01-01T12:00:46.000Z'))
      reportMandantTransportFailure()
      expect(getMandantDegradedSnapshot()).toBe(false)
      reportMandantTransportFailure()
      expect(getMandantDegradedSnapshot()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('fetch-Wrap: erfolgreiche Response beendet Degraded', async () => {
    reportMandantTransportFailure()
    reportMandantTransportFailure()
    const inner = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    const wrapped = createMandantDegradedAwareFetch('https://abc.supabase.co', inner as typeof fetch)
    await wrapped('https://abc.supabase.co/rest/v1/foo')
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('fetch-Wrap: zwei Throws setzen Degraded', async () => {
    const inner = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const wrapped = createMandantDegradedAwareFetch('https://abc.supabase.co', inner as typeof fetch)
    await expect(wrapped('https://abc.supabase.co/rest/v1/foo')).rejects.toThrow(TypeError)
    expect(getMandantDegradedSnapshot()).toBe(false)
    await expect(wrapped('https://abc.supabase.co/rest/v1/foo')).rejects.toThrow(TypeError)
    expect(getMandantDegradedSnapshot()).toBe(true)
  })

  it('fetch-Wrap: andere Origin wird nicht getrackt', async () => {
    const inner = vi.fn().mockRejectedValue(new Error('fail'))
    const wrapped = createMandantDegradedAwareFetch('https://abc.supabase.co', inner as typeof fetch)
    await expect(wrapped('https://other.example.com/x')).rejects.toThrow('fail')
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('HTTP-Fehlercode wirft nicht: Transport gilt als erfolgreich', async () => {
    const inner = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }))
    const wrapped = createMandantDegradedAwareFetch('https://abc.supabase.co', inner as typeof fetch)
    const res = await wrapped('https://abc.supabase.co/rest/v1/foo')
    expect(res.status).toBe(500)
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('GET: Lese-Timeout (Abort) setzt Degraded erst nach zwei Timeouts', async () => {
    vi.useFakeTimers()
    try {
      const inner = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((resolve, reject) => {
          const sig = init?.signal
          if (!sig) {
            resolve(new Response())
            return
          }
          const onAbort = (): void => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          }
          if (sig.aborted) {
            onAbort()
            return
          }
          sig.addEventListener('abort', onAbort, { once: true })
        })
      })
      const wrapped = createMandantDegradedAwareFetch('https://abc.supabase.co', inner as typeof fetch)
      const p1 = wrapped('https://abc.supabase.co/rest/v1/foo', { method: 'GET' })
      const e1 = expect(p1).rejects.toMatchObject({ name: 'AbortError' })
      await vi.advanceTimersByTimeAsync(MANDANT_READ_TIMEOUT_MS)
      await e1
      expect(getMandantDegradedSnapshot()).toBe(false)
      const p2 = wrapped('https://abc.supabase.co/rest/v1/foo', { method: 'GET' })
      const e2 = expect(p2).rejects.toMatchObject({ name: 'AbortError' })
      await vi.advanceTimersByTimeAsync(MANDANT_READ_TIMEOUT_MS)
      await e2
      expect(getMandantDegradedSnapshot()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('POST: Retries bis Erfolg ohne Degraded', async () => {
    let n = 0
    const inner = vi.fn().mockImplementation(() => {
      n++
      if (n < 3) return Promise.reject(new TypeError('network'))
      return Promise.resolve(new Response(null, { status: 201 }))
    })
    const wrapped = createMandantDegradedAwareFetch('https://abc.supabase.co', inner as typeof fetch)
    const res = await wrapped('https://abc.supabase.co/rest/v1/t', { method: 'POST', body: '{}' })
    expect(res.status).toBe(201)
    expect(inner).toHaveBeenCalledTimes(3)
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('POST /rest/v1/rpc/: keine Schreib-Retries (ein Versuch)', async () => {
    const inner = vi.fn().mockRejectedValue(new TypeError('fail'))
    const wrapped = createMandantDegradedAwareFetch('https://abc.supabase.co', inner as typeof fetch)
    await expect(
      wrapped('https://abc.supabase.co/rest/v1/rpc/get_x', { method: 'POST', body: '{}' })
    ).rejects.toThrow(TypeError)
    expect(inner).toHaveBeenCalledTimes(1)
  })

  it('POST: alle Versuche fehlgeschlagen → Degraded nach zwei solchen Läufen', async () => {
    const inner = vi.fn().mockRejectedValue(new TypeError('fail'))
    const wrapped = createMandantDegradedAwareFetch('https://abc.supabase.co', inner as typeof fetch)
    await expect(
      wrapped('https://abc.supabase.co/rest/v1/t', { method: 'POST', body: '{}' })
    ).rejects.toThrow(TypeError)
    expect(inner).toHaveBeenCalledTimes(MANDANT_WRITE_ATTEMPT_COUNT)
    expect(getMandantDegradedSnapshot()).toBe(false)
    await expect(
      wrapped('https://abc.supabase.co/rest/v1/t2', { method: 'POST', body: '{}' })
    ).rejects.toThrow(TypeError)
    expect(inner).toHaveBeenCalledTimes(MANDANT_WRITE_ATTEMPT_COUNT * 2)
    expect(getMandantDegradedSnapshot()).toBe(true)
  }, 20_000)

  it('Konstanten: Schwellenwert und Fenster dokumentiert', () => {
    expect(MANDANT_DEGRADED_FAILURE_THRESHOLD).toBe(2)
    expect(MANDANT_DEGRADED_FAILURE_WINDOW_MS).toBe(45_000)
  })
})
