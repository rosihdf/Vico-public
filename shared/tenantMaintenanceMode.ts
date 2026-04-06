/**
 * Wartungsmodus aus der Lizenz-API: gleiche Zeitlogik für Haupt-App, Kundenportal, Arbeitszeitportal.
 * Ziel-Surfaces über mode_apply_* steuerbar (Default: alle true).
 */

export type TenantMaintenanceApiShape = {
  mode_enabled?: boolean
  mode_message?: string | null
  mode_starts_at?: string | null
  mode_ends_at?: string | null
  mode_duration_min?: number | null
  mode_auto_end?: boolean
  /** Wenn false: Hinweis/Banner in der Haupt-App aus */
  mode_apply_main_app?: boolean
  /** Wenn false: Hinweis im Arbeitszeitportal aus */
  mode_apply_arbeitszeit_portal?: boolean
  /** Wenn false: Hinweis im Kundenportal aus */
  mode_apply_customer_portal?: boolean
  announcement_enabled?: boolean
  announcement_message?: string | null
  announcement_from?: string | null
  announcement_until?: string | null
}

export type MaintenanceSurface = 'main_app' | 'arbeitszeit_portal' | 'customer_portal'

const appliesToSurface = (
  m: TenantMaintenanceApiShape | null | undefined,
  surface: MaintenanceSurface
): boolean => {
  if (!m) return true
  if (surface === 'main_app') return m.mode_apply_main_app !== false
  if (surface === 'arbeitszeit_portal') return m.mode_apply_arbeitszeit_portal !== false
  return m.mode_apply_customer_portal !== false
}

/** „Harte“ Wartung läuft (Zeitfenster); unabhängig vom Ziel-Surface. */
export const isMaintenanceModeWindowActive = (
  m: TenantMaintenanceApiShape | null | undefined,
  nowTs: number
): boolean => {
  if (!m || !m.mode_enabled) return false
  const modeStart = m.mode_starts_at ? Date.parse(m.mode_starts_at) : NaN
  const modeEndFromField = m.mode_ends_at ? Date.parse(m.mode_ends_at) : NaN
  const modeEndFromDuration =
    Number.isFinite(modeStart) && (m.mode_duration_min ?? 0) > 0
      ? modeStart + (m.mode_duration_min ?? 0) * 60_000
      : NaN
  const modeEnd = Number.isFinite(modeEndFromField) ? modeEndFromField : modeEndFromDuration
  return (
    Number.isFinite(modeStart) &&
    nowTs >= modeStart &&
    (m.mode_auto_end ? !Number.isFinite(modeEnd) || nowTs <= modeEnd : true)
  )
}

export type MaintenanceBannerInfo = {
  message: string
  remainingMin: number | null
}

export const getMaintenanceModeBannerForSurface = (
  m: TenantMaintenanceApiShape | null | undefined,
  nowTs: number,
  surface: MaintenanceSurface
): MaintenanceBannerInfo | null => {
  if (!isMaintenanceModeWindowActive(m, nowTs)) return null
  if (!appliesToSurface(m, surface)) return null
  const modeStart = m!.mode_starts_at ? Date.parse(m!.mode_starts_at) : NaN
  const modeEndFromField = m!.mode_ends_at ? Date.parse(m!.mode_ends_at) : NaN
  const modeEndFromDuration =
    Number.isFinite(modeStart) && (m!.mode_duration_min ?? 0) > 0
      ? modeStart + (m!.mode_duration_min ?? 0) * 60_000
      : NaN
  const modeEnd = Number.isFinite(modeEndFromField) ? modeEndFromField : modeEndFromDuration
  const remainingMs =
    m!.mode_auto_end && Number.isFinite(modeEnd) ? Math.max(0, modeEnd - nowTs) : 0
  const remainingMin =
    m!.mode_auto_end && Number.isFinite(modeEnd) ? Math.ceil(remainingMs / 60_000) : null
  const msg = (m!.mode_message?.trim() || 'Wartungsmodus aktiv.') +
    (m!.mode_auto_end && Number.isFinite(modeEnd)
      ? ` Voraussichtliche Restzeit: ${remainingMin} Min.`
      : ' Voraussichtliche Restzeit: offen (manuelle Beendigung).')
  return { message: msg, remainingMin }
}

export const getMaintenanceAnnouncementForSurface = (
  m: TenantMaintenanceApiShape | null | undefined,
  nowTs: number,
  surface: MaintenanceSurface
): string | null => {
  if (!appliesToSurface(m, surface)) return null
  const from = m?.announcement_from ? Date.parse(m.announcement_from) : NaN
  const until = m?.announcement_until ? Date.parse(m.announcement_until) : NaN
  const visible =
    Boolean(m?.announcement_enabled) &&
    Number.isFinite(from) &&
    Number.isFinite(until) &&
    nowTs >= from &&
    nowTs <= until
  if (!visible) return null
  return m?.announcement_message?.trim() || 'Geplante Wartung im angegebenen Zeitraum.'
}
