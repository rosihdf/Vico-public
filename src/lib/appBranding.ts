import { getCachedLicenseResponse, getStoredLicenseNumber } from './licensePortalApi'

/** Anzeigename aus Lizenz-API-Cache (localStorage), synchron – z. B. für Loader ohne LicenseProvider. */
export const getAppDisplayNameFromLicenseCache = (): string | null => {
  const ln = getStoredLicenseNumber()?.trim()
  if (!ln) return null
  const c = getCachedLicenseResponse(ln)
  const n = c?.design?.app_name?.trim()
  return n || null
}

/** Zentraler Start / Auth: „[Name] wird geladen…“ */
export const loadingMessageAppStarting = (): string => {
  const n = getAppDisplayNameFromLicenseCache()
  return n ? `${n} wird geladen…` : 'Wird geladen…'
}

/** Lizenz-Gate: „[Name]: Lizenz wird geprüft…“ */
export const loadingMessageLicenseCheck = (): string => {
  const n = getAppDisplayNameFromLicenseCache()
  return n ? `${n}: Lizenz wird geprüft…` : 'Lizenz wird geprüft…'
}
