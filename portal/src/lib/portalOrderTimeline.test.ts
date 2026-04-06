import { describe, it, expect } from 'vitest'
import {
  buildOrderActivityBannerFingerprint,
  buildOrderTimelineSteps,
  shouldListOrderInTimeline,
  shouldShowOrderActivityBanner,
} from './portalOrderTimeline'
import type { PortalOrderTimelineOrder, PortalOrderTimelineSettings } from './portalService'

const baseFlags = (): PortalOrderTimelineSettings => ({
  portal_timeline_show_planned: false,
  portal_timeline_show_termin: true,
  portal_timeline_show_in_progress: true,
})

const order = (partial: Partial<PortalOrderTimelineOrder>): PortalOrderTimelineOrder => ({
  id: 'id-1',
  status: 'offen',
  order_type: 'wartung',
  order_date: '2026-04-10',
  order_time: '10:00:00',
  created_at: '2026-04-01T08:00:00.000Z',
  updated_at: '2026-04-01T08:00:00.000Z',
  object_names: 'Tür A',
  ...partial,
})

describe('portalOrderTimeline', () => {
  it('Banner: offen nur wenn geplant sichtbar', () => {
    const f = baseFlags()
    expect(shouldShowOrderActivityBanner([order({ status: 'offen' })], f)).toBe(false)
    expect(
      shouldShowOrderActivityBanner([order({ status: 'offen' })], {
        ...f,
        portal_timeline_show_planned: true,
      })
    ).toBe(true)
  })

  it('Banner: in Bearbeitung wenn Schalter an', () => {
    const f = baseFlags()
    expect(shouldShowOrderActivityBanner([order({ status: 'in_bearbeitung' })], f)).toBe(true)
    expect(
      shouldShowOrderActivityBanner([order({ status: 'in_bearbeitung' })], {
        ...f,
        portal_timeline_show_in_progress: false,
      })
    ).toBe(false)
  })

  it('Banner-Fingerprint: ändert sich bei relevantem Auftrags-Update', () => {
    const f = baseFlags()
    const a = buildOrderActivityBannerFingerprint([order({ id: 'a', status: 'in_bearbeitung' })], f)
    const b = buildOrderActivityBannerFingerprint(
      [order({ id: 'a', status: 'in_bearbeitung', updated_at: '2026-04-02T12:00:00.000Z' })],
      f
    )
    expect(a).not.toBe(b)
  })

  it('Banner-Fingerprint: gleich bei identischen relevanten Daten', () => {
    const f = baseFlags()
    const o = order({ id: 'x', status: 'in_bearbeitung' })
    expect(buildOrderActivityBannerFingerprint([o], f)).toBe(buildOrderActivityBannerFingerprint([o], f))
  })

  it('Banner-Fingerprint: erledigte Aufträge ohne Einfluss wenn nicht banner-relevant', () => {
    const f = baseFlags()
    const withDone = buildOrderActivityBannerFingerprint(
      [order({ id: 'a', status: 'erledigt', updated_at: '2026-04-03T10:00:00.000Z' })],
      f
    )
    const empty = buildOrderActivityBannerFingerprint([], f)
    expect(withDone).toBe(empty)
  })

  it('Storno liefert Storno-Schritt', () => {
    const steps = buildOrderTimelineSteps(
      order({ status: 'storniert', updated_at: '2026-04-02T12:00:00.000Z' }),
      { ...baseFlags(), portal_timeline_show_planned: true }
    )
    expect(steps.some((s) => s.key === 'storno')).toBe(true)
  })
})

describe('shouldListOrderInTimeline', () => {
  const f = baseFlags()
  it('offen nur mit geplant', () => {
    expect(shouldListOrderInTimeline(order({ status: 'offen' }), f)).toBe(false)
    expect(
      shouldListOrderInTimeline(order({ status: 'offen' }), { ...f, portal_timeline_show_planned: true })
    ).toBe(true)
  })
})
