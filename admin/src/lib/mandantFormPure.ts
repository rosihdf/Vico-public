import { emptyLicenseFeatures } from '../../../shared/licenseFeatures'
import type { LicenseModel } from './licensePortalService'

export const TIER_OPTIONS = ['free', 'professional', 'enterprise'] as const
export const CHECK_INTERVAL_OPTIONS = ['on_start', 'daily', 'weekly'] as const

export const toDatetimeLocal = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export const fromDatetimeLocal = (value: string): string | null => {
  if (!value.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export const toYearMonth = (value: Date): string => {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export type MandantDefaultCreateFormState = {
  license_number: string
  license_model_id: string | null
  tier: 'free' | 'professional' | 'enterprise'
  valid_until: string | null
  is_trial: boolean
  grace_period_days: number
  max_users: number | null
  max_customers: number | null
  max_storage_mb: number | null
  check_interval: 'on_start' | 'daily' | 'weekly'
  features: Record<string, boolean>
}

export const DEFAULT_CREATE_FORM: MandantDefaultCreateFormState = {
  license_number: '',
  license_model_id: null,
  tier: 'professional',
  valid_until: null,
  is_trial: false,
  grace_period_days: 0,
  max_users: null,
  max_customers: null,
  max_storage_mb: null,
  check_interval: 'daily',
  features: emptyLicenseFeatures(),
}

export const WIZARD_TOTAL_STEPS = 6

export const isPlausibleEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export const isPlausibleSupabaseProjectUrl = (raw: string): boolean => {
  const t = raw.trim()
  if (!t) return true
  try {
    const u = new URL(t)
    return u.protocol === 'https:' && /\.supabase\.co$/i.test(u.hostname)
  } catch {
    return false
  }
}

export const isOptionalHttpUrl = (raw: string): boolean => {
  const t = raw.trim()
  if (!t) return true
  try {
    const full = /^https?:\/\//i.test(t) ? t : `https://${t}`
    const u = new URL(full)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export type WizardFormSlice = {
  name: string
  app_name: string
  primary_color: string
  datenschutz_contact_email: string
  mail_monthly_limit: string
  mail_from_email: string
  supabase_url: string
  cf_preview_main_url: string
  cf_preview_portal_url: string
  cf_preview_arbeitszeit_url: string
}

export const getWizardStepComplete = (
  f: WizardFormSlice,
  step: number,
  licenseModelId: string,
  licenseModels: LicenseModel[],
): boolean => {
  switch (step) {
    case 1:
      return f.name.trim().length > 0
    case 2:
      return f.app_name.trim().length > 0 && /^#[0-9A-Fa-f]{6}$/.test(f.primary_color)
    case 3: {
      const de = f.datenschutz_contact_email.trim()
      if (de.length > 0 && !isPlausibleEmail(de)) return false
      return true
    }
    case 4: {
      const lim = parseInt(f.mail_monthly_limit, 10)
      if (Number.isNaN(lim) || lim < 1) return false
      const fe = f.mail_from_email.trim()
      if (fe.length > 0 && !isPlausibleEmail(fe)) return false
      return true
    }
    case 5:
      return (
        isPlausibleSupabaseProjectUrl(f.supabase_url) &&
        isOptionalHttpUrl(f.cf_preview_main_url) &&
        isOptionalHttpUrl(f.cf_preview_portal_url) &&
        isOptionalHttpUrl(f.cf_preview_arbeitszeit_url)
      )
    case 6:
      return licenseModels.length === 0 || licenseModels.some((m) => m.id === licenseModelId)
    default:
      return false
  }
}

export const validateWizardStep = (
  f: WizardFormSlice,
  step: number,
  licenseModelId: string,
  licenseModels: LicenseModel[],
): string | null => {
  switch (step) {
    case 1:
      if (!f.name.trim()) return 'Bitte einen Mandanten-Namen eingeben.'
      return null
    case 2:
      if (!f.app_name.trim()) return 'Bitte einen App-Namen eingeben.'
      if (!/^#[0-9A-Fa-f]{6}$/.test(f.primary_color)) return 'Bitte eine gültige Primärfarbe wählen.'
      return null
    case 3: {
      const de = f.datenschutz_contact_email.trim()
      if (de.length > 0 && !isPlausibleEmail(de))
        return 'Bitte eine gültige Datenschutz-Kontakt-E-Mail eingeben oder leer lassen.'
      return null
    }
    case 4: {
      const lim = parseInt(f.mail_monthly_limit, 10)
      if (Number.isNaN(lim) || lim < 1) return 'Bitte ein gültiges Monatslimit (mindestens 1) eingeben.'
      const fe = f.mail_from_email.trim()
      if (fe.length > 0 && !isPlausibleEmail(fe))
        return 'Bitte eine gültige Absender-E-Mail eingeben oder leer lassen.'
      return null
    }
    case 5: {
      if (!isPlausibleSupabaseProjectUrl(f.supabase_url)) {
        return 'Supabase-URL leer lassen oder als https://…supabase.co angeben.'
      }
      if (!isOptionalHttpUrl(f.cf_preview_main_url)) return 'Preview-URL Haupt-App: leer oder gültige http(s)-URL.'
      if (!isOptionalHttpUrl(f.cf_preview_portal_url)) return 'Preview-URL Kundenportal: leer oder gültige http(s)-URL.'
      if (!isOptionalHttpUrl(f.cf_preview_arbeitszeit_url))
        return 'Preview-URL Arbeitszeitportal: leer oder gültige http(s)-URL.'
      return null
    }
    case 6:
      if (licenseModels.length === 0)
        return 'Es ist kein Lizenzmodell vorhanden. Bitte zuerst unter Lizenzmodelle anlegen.'
      if (!licenseModelId || !licenseModels.some((m) => m.id === licenseModelId))
        return 'Bitte ein Lizenzmodell für die Initial-Lizenz auswählen.'
      return null
    default:
      return null
  }
}
