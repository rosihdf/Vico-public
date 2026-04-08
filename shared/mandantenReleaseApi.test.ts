import { describe, it, expect } from 'vitest'
import {
  getActiveReleaseRequiringHardReload,
  incomingReleasesHaveHardReloadHint,
  parseMandantenReleasesPayload,
} from './mandantenReleaseApi'

describe('mandantenReleaseApi', () => {
  it('getActiveReleaseRequiringHardReload liefert active nur bei forceHardReload', () => {
    expect(
      getActiveReleaseRequiringHardReload(
        parseMandantenReleasesPayload({
          channel: 'main',
          active: {
            id: 'a',
            version: '2.0.0',
            releaseType: 'major',
            title: 'T',
            notes: null,
            moduleTags: [],
            affectsLine: null,
            forceHardReload: false,
          },
          incoming: [],
        })
      )
    ).toBeNull()
    const withForce = parseMandantenReleasesPayload({
      channel: 'main',
      active: {
        id: 'a',
        version: '2.0.0',
        releaseType: 'major',
        title: 'T',
        notes: null,
        moduleTags: [],
        affectsLine: null,
        forceHardReload: true,
      },
      incoming: [],
    })
    expect(getActiveReleaseRequiringHardReload(withForce)?.id).toBe('a')
  })

  it('incomingReleasesHaveHardReloadHint', () => {
    const p = parseMandantenReleasesPayload({
      channel: 'kundenportal',
      active: null,
      incoming: [
        {
          id: 'i',
          version: '1.1.0',
          releaseType: 'feature',
          title: null,
          notes: null,
          moduleTags: [],
          affectsLine: null,
          forceHardReload: true,
        },
      ],
    })
    expect(incomingReleasesHaveHardReloadHint(p)).toBe(true)
  })

  it('parseMandantenReleasesPayload übernimmt releaseAssignmentUpdatedAt', () => {
    const p = parseMandantenReleasesPayload({
      channel: 'main',
      active: null,
      incoming: [],
      releaseAssignmentUpdatedAt: '2026-04-03T12:00:00.000Z',
    })
    expect(p?.releaseAssignmentUpdatedAt).toBe('2026-04-03T12:00:00.000Z')
    const noKey = parseMandantenReleasesPayload({
      channel: 'main',
      active: null,
      incoming: [],
    })
    expect(noKey?.releaseAssignmentUpdatedAt).toBeUndefined()
  })
})
