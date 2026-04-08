import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getMandantDegradedSnapshot,
  reportMandantTransportFailure,
  reportMandantTransportSuccess,
  resetMandantDegradedForTests,
  createMandantDegradedAwareFetch,
  MANDANT_READ_TIMEOUT_MS,
  MANDANT_WRITE_ATTEMPT_COUNT,
} from './mandantDegradedStore'

beforeEach(() => {
  resetMandantDegradedForTests()
})

describe('mandantDegradedStore', () => {
  it('Failure setzt Degraded', () => {
    reportMandantTransportFailure()
    expect(getMandantDegradedSnapshot()).toBe(true)
  })

  it('Success setzt zurück', () => {
    reportMandantTransportFailure()
    reportMandantTransportSuccess()
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('fetch-Wrap: erfolgreiche Response beendet Degraded', async () => {
    reportMandantTransportFailure()
    const inner = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    const wrapped = createMandantDegradedAwareFetch('https://abc.supabase.co', inner as typeof fetch)
    await wrapped('https://abc.supabase.co/rest/v1/foo')
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('fetch-Wrap: Throw setzt Degraded', async () => {
    const inner = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const wrapped = createMandantDegradedAwareFetch('https://abc.supabase.co', inner as typeof fetch)
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

  it('GET: Lese-Timeout (Abort) setzt Degraded', async () => {
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
      const p = wrapped('https://abc.supabase.co/rest/v1/foo', { method: 'GET' })
      const expectation = expect(p).rejects.toMatchObject({ name: 'AbortError' })
      await vi.advanceTimersByTimeAsync(MANDANT_READ_TIMEOUT_MS)
      await expectation
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

  it('POST: alle Versuche fehlgeschlagen → Degraded', async () => {
    const inner = vi.fn().mockRejectedValue(new TypeError('fail'))
    const wrapped = createMandantDegradedAwareFetch('https://abc.supabase.co', inner as typeof fetch)
    await expect(
      wrapped('https://abc.supabase.co/rest/v1/t', { method: 'POST', body: '{}' })
    ).rejects.toThrow(TypeError)
    expect(inner).toHaveBeenCalledTimes(MANDANT_WRITE_ATTEMPT_COUNT)
    expect(getMandantDegradedSnapshot()).toBe(true)
  }, 10_000)
})
