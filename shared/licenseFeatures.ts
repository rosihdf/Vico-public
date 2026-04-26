/**
 * Einheitliche Lizenz-Feature-Keys (jsonb `licenses.features` / Lizenz-API).
 * Admin-UI, Haupt-App, Portale und Edge Function sollten dieselben Keys nutzen.
 */

export const LICENSE_FEATURE_KEYS = [
  'kundenportal',
  'historie',
  'arbeitszeiterfassung',
  /** Teamverwaltung (Teams anlegen/löschen/zuweisen in der Benutzerverwaltung) */
  'teamfunktion',
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
  /** Geführter Checklisten-Assistent in der Haupt-App (Wartungsprotokoll) */
  'checklist_assistant',
  /** Optional vorbereitet: harte Pflichtvalidierung im Checklisten-Assistenten */
  'checklist_assistant_strict_mode',
  /** Hinweis „Mandanten-Datenbank nicht erreichbar“ anzeigen */
  'degraded_banner',
] as const

export type LicenseFeatureKey = (typeof LICENSE_FEATURE_KEYS)[number]

/** Anzeigenamen (DE) für Admin-Listen und Info-Seite */
export const LICENSE_FEATURE_LABELS: Record<string, string> = {
  kundenportal: 'Kundenportal',
  historie: 'Historie (System)',
  arbeitszeiterfassung: 'Arbeitszeiterfassung',
  teamfunktion: 'Teamfunktion',
  standortabfrage: 'Standortabfrage',
  wartungsprotokolle: 'Wartungsprotokolle / Objekte',
  buchhaltung_export: 'Buchhaltungs-Export',
  urlaub: 'Urlaub / Abwesenheit (AZ-Portal)',
  fehlerberichte: 'Fehlerberichte (System)',
  ladezeiten: 'Ladezeiten (System)',
  qr_batch_a4: 'A4-QR-Etiketten',
  beta_feedback: 'Beta-Feedback (Live-Test)',
  checklist_assistant: 'Checklisten-Assistent (Haupt-App)',
  checklist_assistant_strict_mode: 'Checklisten-Assistent: Strict-Mode',
  degraded_banner: 'Hinweis: Mandanten-Datenbank instabil',
}

/** Kurzhinweise für Admin-UI (Tooltip/Title an Feature-Checkboxen). */
export const LICENSE_FEATURE_DESCRIPTIONS: Record<string, string> = {
  checklist_assistant:
    'Aktiviert den geführten Checklisten-Assistenten im Wartungsprotokoll (optional, klassische Ansicht bleibt verfügbar).',
  checklist_assistant_strict_mode:
    'Vorbereitung für harte Pflichtvalidierung im Assistenten. Aktuell nur als Schalter vorgesehen (ohne erzwungenen Flow).',
  degraded_banner:
    'Steuert beide Hinweise: Mandanten-Datenbank instabil und Lizenz-API nur aus Cache (Lizenz-Portal nicht erreichbar). false = beide ausblenden.',
}

export const LICENSE_FEATURE_GROUPS = [
  {
    id: 'main',
    label: 'Main',
    features: ['wartungsprotokolle', 'historie'],
  },
  {
    id: 'kundenportal',
    label: 'Kundenportal',
    features: ['kundenportal'],
  },
  {
    id: 'arbeitszeit_portal',
    label: 'Arbeitszeit-Portal',
    features: ['arbeitszeiterfassung'],
  },
] as const satisfies ReadonlyArray<{ id: string; label: string; features: readonly LicenseFeatureKey[] }>

export const LICENSE_FEATURE_DEPENDENCIES: Partial<Record<LicenseFeatureKey, readonly LicenseFeatureKey[]>> = {
  wartungsprotokolle: ['qr_batch_a4', 'checklist_assistant'],
  historie: ['fehlerberichte', 'ladezeiten', 'beta_feedback', 'degraded_banner', 'buchhaltung_export'],
  checklist_assistant: ['checklist_assistant_strict_mode'],
  arbeitszeiterfassung: ['urlaub', 'teamfunktion', 'standortabfrage'],
}

const buildFeatureParentMap = (): Partial<Record<LicenseFeatureKey, LicenseFeatureKey>> => {
  const parentMap: Partial<Record<LicenseFeatureKey, LicenseFeatureKey>> = {}
  for (const parent of Object.keys(LICENSE_FEATURE_DEPENDENCIES) as LicenseFeatureKey[]) {
    const children = LICENSE_FEATURE_DEPENDENCIES[parent] ?? []
    for (const child of children) {
      parentMap[child] = parent
    }
  }
  return parentMap
}

export const LICENSE_FEATURE_PARENT_MAP = buildFeatureParentMap()

export const getFeatureChildren = (key: LicenseFeatureKey): readonly LicenseFeatureKey[] => {
  return LICENSE_FEATURE_DEPENDENCIES[key] ?? []
}

export const getFeatureParent = (key: LicenseFeatureKey): LicenseFeatureKey | null => {
  return LICENSE_FEATURE_PARENT_MAP[key] ?? null
}

const getFeatureAncestors = (key: LicenseFeatureKey): LicenseFeatureKey[] => {
  const ancestors: LicenseFeatureKey[] = []
  let current: LicenseFeatureKey | null = getFeatureParent(key)
  while (current) {
    ancestors.push(current)
    current = getFeatureParent(current)
  }
  return ancestors
}

const getFeatureDescendants = (key: LicenseFeatureKey): LicenseFeatureKey[] => {
  const descendants: LicenseFeatureKey[] = []
  const stack = [...getFeatureChildren(key)]
  while (stack.length > 0) {
    const next = stack.pop()
    if (!next || descendants.includes(next)) continue
    descendants.push(next)
    stack.push(...getFeatureChildren(next))
  }
  return descendants
}

export const isFeatureToggleEnabled = (
  allFeatures: Record<string, boolean>,
  key: LicenseFeatureKey
): boolean => {
  const ancestors = getFeatureAncestors(key)
  return ancestors.every((ancestor) => Boolean(allFeatures[ancestor]))
}

export const applyFeatureToggleWithDependencies = (
  allFeatures: Record<string, boolean>,
  key: LicenseFeatureKey,
  nextEnabled: boolean
): Record<string, boolean> => {
  const next = { ...allFeatures }
  next[key] = nextEnabled

  if (nextEnabled) {
    const ancestors = getFeatureAncestors(key)
    for (const ancestor of ancestors) {
      next[ancestor] = true
    }
    return next
  }

  const descendants = getFeatureDescendants(key)
  for (const descendant of descendants) {
    next[descendant] = false
  }
  return next
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
    teamfunktion: false,
    standortabfrage: false,
    wartungsprotokolle: false,
    buchhaltung_export: false,
    urlaub: false,
    fehlerberichte: false,
    ladezeiten: false,
    qr_batch_a4: false,
    beta_feedback: false,
    checklist_assistant: false,
    checklist_assistant_strict_mode: false,
    degraded_banner: true,
  },
  professional: {
    kundenportal: true,
    historie: true,
    arbeitszeiterfassung: true,
    teamfunktion: false,
    standortabfrage: true,
    wartungsprotokolle: true,
    buchhaltung_export: true,
    urlaub: true,
    fehlerberichte: true,
    ladezeiten: true,
    qr_batch_a4: false,
    beta_feedback: false,
    checklist_assistant: false,
    checklist_assistant_strict_mode: false,
    degraded_banner: true,
  },
  enterprise: {
    kundenportal: true,
    historie: true,
    arbeitszeiterfassung: true,
    teamfunktion: false,
    standortabfrage: true,
    wartungsprotokolle: true,
    buchhaltung_export: true,
    urlaub: true,
    fehlerberichte: true,
    ladezeiten: true,
    qr_batch_a4: false,
    beta_feedback: false,
    checklist_assistant: false,
    checklist_assistant_strict_mode: false,
    degraded_banner: true,
  },
}
