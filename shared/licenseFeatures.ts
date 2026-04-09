/**
 * Einheitliche Lizenz-Feature-Keys (jsonb `licenses.features` / Lizenz-API).
 * Admin-UI, Haupt-App, Portale und Edge Function sollten dieselben Keys nutzen.
 */

export const LICENSE_FEATURE_KEYS = [
  'kundenportal',
  'historie',
  'arbeitszeiterfassung',
  'standortabfrage',
  /** Wartungsprotokolle, Objekte, QR */
  'wartungsprotokolle',
  /** Seite Buchhaltungs-Export */
  'buchhaltung_export',
  /** Urlaub / Abwesenheit im Arbeitszeit-Portal */
  'urlaub',
  /** System → Fehlerberichte */
  'fehlerberichte',
  /** System → Ladezeiten (Diagnose) */
  'ladezeiten',
  /** A4-Sammel-PDF mit QR-Etiketten (Haupt-App Kunden, Mehrfachauswahl) */
  'qr_batch_a4',
  /** Beta-Live-Test: Feedback-Widget (Haupt-App, Kundenportal, Arbeitszeit-Portal) */
  'beta_feedback',
  /** Hinweis „Mandanten-Datenbank nicht erreichbar“ anzeigen */
  'degraded_banner',
] as const

export type LicenseFeatureKey = (typeof LICENSE_FEATURE_KEYS)[number]

/** Anzeigenamen (DE) für Admin-Listen und Info-Seite */
export const LICENSE_FEATURE_LABELS: Record<string, string> = {
  kundenportal: 'Kundenportal',
  historie: 'Historie (System)',
  arbeitszeiterfassung: 'Arbeitszeiterfassung',
  standortabfrage: 'Standortabfrage',
  wartungsprotokolle: 'Wartungsprotokolle / Objekte',
  buchhaltung_export: 'Buchhaltungs-Export',
  urlaub: 'Urlaub / Abwesenheit (AZ-Portal)',
  fehlerberichte: 'Fehlerberichte (System)',
  ladezeiten: 'Ladezeiten (System)',
  qr_batch_a4: 'A4-QR-Etiketten',
  beta_feedback: 'Beta-Feedback (Live-Test)',
  degraded_banner: 'Hinweis: Mandanten-Datenbank instabil',
}

/** Kurzhinweise für Admin-UI (Tooltip/Title an Feature-Checkboxen). */
export const LICENSE_FEATURE_DESCRIPTIONS: Record<string, string> = {
  degraded_banner:
    'Steuert den Hinweis „Lizenzportal oder Mandanten-Datenbank nicht erreichbar“. false = Hinweis ausblenden.',
}

/** Default false für alle bekannten Keys (z. B. Formulare) */
export const emptyLicenseFeatures = (): Record<string, boolean> => {
  const o: Record<string, boolean> = {}
  for (const k of LICENSE_FEATURE_KEYS) {
    o[k] = false
  }
  return o
}

/** Robuster Check (Lizenz-API / JSON kann true als Boolean oder String liefern). */
export const isLicenseFeatureEnabled = (
  features: Record<string, boolean> | null | undefined,
  key: string
): boolean => {
  const raw = features?.[key] as unknown
  if (raw === true) return true
  if (raw === 'true' || raw === 1 || raw === '1') return true
  return false
}

/**
 * Wie `isLicenseFeatureEnabled`, aber mit konfigurierbarem Default.
 * Für Flags, die historisch "immer an" waren, kann so `defaultValue=true` genutzt werden.
 */
export const isLicenseFeatureEnabledWithDefault = (
  features: Record<string, boolean> | null | undefined,
  key: string,
  defaultValue: boolean
): boolean => {
  const raw = features?.[key] as unknown
  if (raw == null) return defaultValue
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false
  return defaultValue
}

/** Normalisiert gespeicherte Features auf bekannte Keys (fehlende → false). */
export const normalizeLicenseFeatures = (f: Record<string, boolean> | undefined | null): Record<string, boolean> => {
  const base = emptyLicenseFeatures()
  if (!f) return base
  for (const k of LICENSE_FEATURE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(f, k)) {
      base[k] = Boolean(f[k])
    }
  }
  return base
}

/** Wie Lizenz-API (`supabase-license-portal` Edge `license`): Modell, dann Zeile überschreibt. */
export const mergeLicenseModelAndRowFeatures = (
  modelFeatures: Record<string, boolean> | null | undefined,
  licenseFeatures: Record<string, boolean> | null | undefined
): Record<string, boolean> => ({
  ...(modelFeatures ?? {}),
  ...(licenseFeatures ?? {}),
})

/**
 * Effektive Flags für Admin-/UI-Stand (nur bekannte Keys), identisch zur Mandanten-Lizenz-API nach Merge.
 * Ohne das zeigen Checkboxen „aus“, obwohl das Modell z. B. `degraded_banner: true` liefert und die Zeile den Key nicht setzt.
 */
export const effectiveLicenseFeatures = (
  modelFeatures: Record<string, boolean> | null | undefined,
  licenseFeatures: Record<string, boolean> | null | undefined
): Record<string, boolean> => {
  const merged = mergeLicenseModelAndRowFeatures(modelFeatures, licenseFeatures)
  const base = emptyLicenseFeatures()
  for (const k of LICENSE_FEATURE_KEYS) {
    base[k] = isLicenseFeatureEnabled(merged, k)
  }
  return base
}

/** Alle bekannten Keys explizit setzen (z. B. `licenses.features` speichern – inkl. `false`, damit Merge nicht vom Modell überschreibt). */
export const explicitLicenseFeaturesMap = (f: Record<string, boolean> | null | undefined): Record<string, boolean> => {
  const base = emptyLicenseFeatures()
  if (!f) return base
  for (const k of LICENSE_FEATURE_KEYS) {
    base[k] = Boolean(f[k])
  }
  return base
}

/**
 * Tier-Fallbacks wenn Lizenzmodell keine Features hat (Edge Function).
 * free: minimal; professional/enterprise: volles Paket inkl. Add-ons.
 */
/**
 * Nur für **lokale Dev-Defaults** (z. B. Arbeitszeit-Portal ohne Lizenz-API).
 * Produktion: Features ausschließlich aus Lizenz-DB / Lizenz-API (`features` jsonb), keine Tier-Auto-Aktivierung.
 */
export const TIER_DEFAULT_FEATURES: Record<string, Record<string, boolean>> = {
  free: {
    kundenportal: false,
    historie: false,
    arbeitszeiterfassung: false,
    standortabfrage: false,
    wartungsprotokolle: false,
    buchhaltung_export: false,
    urlaub: false,
    fehlerberichte: false,
    ladezeiten: false,
    qr_batch_a4: false,
    beta_feedback: false,
    degraded_banner: true,
  },
  professional: {
    kundenportal: true,
    historie: true,
    arbeitszeiterfassung: true,
    standortabfrage: true,
    wartungsprotokolle: true,
    buchhaltung_export: true,
    urlaub: true,
    fehlerberichte: true,
    ladezeiten: true,
    qr_batch_a4: false,
    beta_feedback: false,
    degraded_banner: true,
  },
  enterprise: {
    kundenportal: true,
    historie: true,
    arbeitszeiterfassung: true,
    standortabfrage: true,
    wartungsprotokolle: true,
    buchhaltung_export: true,
    urlaub: true,
    fehlerberichte: true,
    ladezeiten: true,
    qr_batch_a4: false,
    beta_feedback: false,
    degraded_banner: true,
  },
}
