import type { PortalOrderTimelineOrder, PortalOrderTimelineSettings } from './portalService'

const formatDeDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

const formatDeDateTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const formatOrderDateTime = (dateStr: string, timeStr: string | null): string => {
  const d = formatDeDate(dateStr)
  if (!timeStr) return d
  const t = timeStr.slice(0, 5)
  return `${d}, ${t} Uhr`
}

export type PortalTimelineStep = { key: string; label: string; detail: string | null }

export const shouldShowOrderActivityBanner = (
  orders: PortalOrderTimelineOrder[],
  f: PortalOrderTimelineSettings
): boolean =>
  orders.some(
    (o) =>
      (o.status === 'offen' && f.portal_timeline_show_planned) ||
      (o.status === 'in_bearbeitung' && f.portal_timeline_show_in_progress)
  )

/** Nur Aufträge, die das Aktivitäts-Banner auslösen (gleiche Regel wie `shouldShowOrderActivityBanner`). */
const ordersRelevantForActivityBanner = (
  orders: PortalOrderTimelineOrder[],
  f: PortalOrderTimelineSettings
): PortalOrderTimelineOrder[] =>
  orders.filter(
    (o) =>
      (o.status === 'offen' && f.portal_timeline_show_planned) ||
      (o.status === 'in_bearbeitung' && f.portal_timeline_show_in_progress)
  )

/**
 * Stabiler Fingerabdruck für „Aktivität zu Aufträgen“-Banner: bei Änderung (neuer Stand / neuer Auftrag /
 * Schalter) soll der Hinweis wieder erscheinen, wenn er zuvor ausgeblendet wurde.
 */
export const buildOrderActivityBannerFingerprint = (
  orders: PortalOrderTimelineOrder[],
  f: PortalOrderTimelineSettings
): string => {
  const rows = ordersRelevantForActivityBanner(orders, f)
    .map((o) => ({
      id: o.id,
      status: o.status,
      u: o.updated_at,
      od: o.order_date,
      ot: o.order_time,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify({
    p: f.portal_timeline_show_planned,
    i: f.portal_timeline_show_in_progress,
    rows,
  })
}

export const shouldListOrderInTimeline = (
  order: PortalOrderTimelineOrder,
  f: PortalOrderTimelineSettings
): boolean => {
  if (order.status === 'storniert' || order.status === 'erledigt') return true
  if (order.status === 'in_bearbeitung')
    return f.portal_timeline_show_in_progress || f.portal_timeline_show_planned
  if (order.status === 'offen') return f.portal_timeline_show_planned
  return false
}

export const buildOrderTimelineSteps = (
  order: PortalOrderTimelineOrder,
  f: PortalOrderTimelineSettings
): PortalTimelineStep[] => {
  const steps: PortalTimelineStep[] = []
  const showAngelegt = f.portal_timeline_show_planned || order.status !== 'offen'
  if (showAngelegt) {
    steps.push({
      key: 'angelegt',
      label: 'Auftrag angelegt',
      detail: formatDeDateTime(order.created_at),
    })
  }
  const showTerminRow =
    f.portal_timeline_show_termin &&
    (f.portal_timeline_show_planned || order.status !== 'offen') &&
    Boolean(order.order_date)
  if (showTerminRow && order.order_date) {
    steps.push({
      key: 'termin',
      label: 'Geplanter Termin',
      detail: formatOrderDateTime(order.order_date, order.order_time),
    })
  }
  if (order.status === 'storniert') {
    steps.push({
      key: 'storno',
      label: 'Auftrag storniert',
      detail: formatDeDateTime(order.updated_at),
    })
    return steps
  }
  if (f.portal_timeline_show_in_progress) {
    if (order.status === 'in_bearbeitung') {
      steps.push({ key: 'pruefung', label: 'Prüfung / Wartung läuft', detail: null })
    }
    if (order.status === 'erledigt') {
      steps.push({ key: 'pruefung', label: 'Prüfung / Wartung durchgeführt', detail: null })
      steps.push({
        key: 'abgeschlossen',
        label: 'Auftrag abgeschlossen',
        detail: formatDeDateTime(order.updated_at),
      })
    }
  } else if (order.status === 'erledigt') {
    steps.push({
      key: 'abgeschlossen',
      label: 'Auftrag abgeschlossen',
      detail: formatDeDateTime(order.updated_at),
    })
  }
  return steps
}
