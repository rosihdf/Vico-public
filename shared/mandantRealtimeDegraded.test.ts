import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  recordMandantRealtimeSubscribeStatus,
  resetMandantRealtimeDegradedForTests,
} from './mandantRealtimeDegraded'
import { getMandantDegradedSnapshot, resetMandantDegradedForTests } from './mandantDegradedStore'

describe('mandantRealtimeDegraded', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetMandantRealtimeDegradedForTests()
    resetMandantDegradedForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ein CHANNEL_ERROR setzt noch kein Degraded', () => {
    recordMandantRealtimeSubscribeStatus('CHANNEL_ERROR')
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('zwei CHANNEL_ERROR innerhalb 2 Min → Degraded', () => {
    recordMandantRealtimeSubscribeStatus('CHANNEL_ERROR')
    vi.advanceTimersByTime(30_000)
    recordMandantRealtimeSubscribeStatus('CHANNEL_ERROR')
    expect(getMandantDegradedSnapshot()).toBe(true)
  })

  it('nach SUBSCRIBED werden Fehlerzähler und Degraded zurückgesetzt', () => {
    recordMandantRealtimeSubscribeStatus('CHANNEL_ERROR')
    vi.advanceTimersByTime(30_000)
    recordMandantRealtimeSubscribeStatus('CHANNEL_ERROR')
    expect(getMandantDegradedSnapshot()).toBe(true)
    recordMandantRealtimeSubscribeStatus('SUBSCRIBED')
    expect(getMandantDegradedSnapshot()).toBe(false)
    recordMandantRealtimeSubscribeStatus('CHANNEL_ERROR')
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('älterer Fehler fällt aus dem Fenster', () => {
    recordMandantRealtimeSubscribeStatus('CHANNEL_ERROR')
    vi.advanceTimersByTime(121_000)
    recordMandantRealtimeSubscribeStatus('CHANNEL_ERROR')
    expect(getMandantDegradedSnapshot()).toBe(false)
  })

  it('CLOSED wird ignoriert', () => {
    recordMandantRealtimeSubscribeStatus('CLOSED')
    recordMandantRealtimeSubscribeStatus('CLOSED')
    expect(getMandantDegradedSnapshot()).toBe(false)
  })
})
