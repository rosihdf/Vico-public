import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getMandantPingEnabled,
  setMandantPingEnabled,
  pingMandantSupabaseOnce,
  MANDANT_PING_STORAGE_KEY,
} from './mandantReachabilityPing'
import {
  getMandantDegradedSnapshot,
  resetMandantDegradedForTests,
  reportMandantTransportFailure,
} from './mandantDegradedStore'

const memoryStore: Record<string, string> = {}

describe('mandantReachabilityPing', () => {
  beforeEach(() => {
    Object.keys(memoryStore).forEach((k) => delete memoryStore[k])
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => memoryStore[k] ?? null,
      setItem: (k: string, v: string) => {
        memoryStore[k] = v
      },
      removeItem: (k: string) => {
        delete memoryStore[k]
      },
    })
    resetMandantDegradedForTests()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('Storage default aus', () => {
    expect(getMandantPingEnabled()).toBe(false)
    setMandantPingEnabled(true)
    expect(getMandantPingEnabled()).toBe(true)
    expect(memoryStore[MANDANT_PING_STORAGE_KEY]).toBe('1')
  })

  it('Ping Erfolg setzt Degraded zurück', async () => {
    reportMandantTransportFailure()
    expect(getMandantDegradedSnapshot()).toBe(true)
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }))
    await pingMandantSupabaseOnce('https://x.supabase.co', 'anon')
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('Ping Netzwerkfehler setzt Degraded', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fail'))
    await pingMandantSupabaseOnce('https://x.supabase.co', 'anon')
    expect(getMandantDegradedSnapshot()).toBe(true)
  })
})
