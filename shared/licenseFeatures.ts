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
}

/** Default false für alle bekannten Keys (z. B. Formulare) */
export const emptyLicenseFeatures = (): Record<string, boolean> => {
  const o: Record<string, boolean> = {}
  for (const k of LICENSE_FEATURE_KEYS) {
    o[k] = false
  }
  return o
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
  },
}
