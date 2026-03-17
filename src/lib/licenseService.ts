import { supabase } from '../supabase'
import { getCachedLicense, setCachedLicense } from './offlineStorage'

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine

export type LicenseStatus = {
  tier: string
  valid_until: string | null
  max_customers: number | null
  max_users: number | null
  max_storage_mb: number | null
  current_customers: number
  current_users: number
  features: Record<string, boolean>
  valid: boolean
  expired: boolean
  read_only: boolean
  is_trial?: boolean
  check_interval?: 'on_start' | 'daily' | 'weekly'
}

/** Mappt API-Response auf LicenseStatus (current_* von Mandanten-DB, hier 0) */
export const mapApiToLicenseStatus = (api: {
  license: {
    tier: string
    valid_until: string | null
    max_users: number | null
    max_customers: number | null
    max_storage_mb?: number | null
    features: Record<string, boolean>
    valid: boolean
    expired: boolean
    read_only?: boolean
    is_trial?: boolean
    check_interval?: 'on_start' | 'daily' | 'weekly'
  }
}): LicenseStatus => ({
  tier: api.license.tier,
  valid_until: api.license.valid_until,
  max_customers: api.license.max_customers,
  max_users: api.license.max_users,
  max_storage_mb: api.license.max_storage_mb ?? null,
  current_customers: 0,
  current_users: 0,
  features: api.license.features ?? {},
  valid: api.license.valid,
  expired: api.license.expired,
  read_only: api.license.read_only ?? false,
  is_trial: api.license.is_trial ?? false,
  check_interval: api.license.check_interval ?? 'daily',
})

const EMPTY_LICENSE: LicenseStatus = {
  tier: 'none',
  valid_until: null,
  max_customers: null,
  max_users: null,
  max_storage_mb: null,
  current_customers: 0,
  current_users: 0,
  features: {},
  valid: false,
  expired: true,
  read_only: false,
}

export const fetchLicenseStatus = async (): Promise<LicenseStatus> => {
  if (!isOnline()) {
    const cached = getCachedLicense() as LicenseStatus | null
    return cached ?? EMPTY_LICENSE
  }
  const { data, error } = await supabase.rpc('get_license_status')
  if (error || !data) return EMPTY_LICENSE
  const status = data as LicenseStatus
  setCachedLicense(status)
  return status
}

export const checkCanCreateCustomer = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc('check_can_create_customer')
  if (error) return true
  return data as boolean
}

export const checkCanInviteUser = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc('check_can_invite_user')
  if (error) return true
  return data as boolean
}

/** Speichernutzung in MB aus Mandanten-DB (RPC get_storage_usage) */
export const fetchStorageUsageMb = async (): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('get_storage_usage')
    if (error) return 0
    const n = Number(data)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

/** Nutzungszahlen aus Mandanten-DB (für API-Modus, wenn Lizenz-API keine current_* liefert) */
export const fetchUsageCounts = async (): Promise<{
  current_customers: number
  current_users: number
}> => {
  try {
    const [customersRes, profilesRes] = await Promise.all([
      supabase.from('customers').select('*', { count: 'exact', head: true }).is('demo_user_id', null),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .or('role.eq.admin,role.eq.mitarbeiter,role.eq.operator,role.eq.leser'),
    ])
    return {
      current_customers: customersRes.count ?? 0,
      current_users: profilesRes.count ?? 0,
    }
  } catch {
    return { current_customers: 0, current_users: 0 }
  }
}

export const hasFeature = (license: LicenseStatus, feature: string): boolean => {
  return license.features?.[feature] === true
}

export const isLimitReached = (current: number, max: number | null): boolean => {
  if (max === null) return false
  return current >= max
}

export type UsageLevel = 'ok' | 'warning' | 'critical' | 'blocked'

export const getUsageLevel = (current: number, max: number | null): UsageLevel => {
  if (max === null) return 'ok'
  if (current >= max) return 'blocked'
  if (current >= max * 0.9) return 'critical'
  if (current >= max * 0.8) return 'warning'
  return 'ok'
}

export const getUsageMessage = (
  current: number,
  max: number | null,
  label: string
): string | null => {
  const level = getUsageLevel(current, max)
  if (level === 'ok') return null
  const maxStr = max ?? '∞'
  if (level === 'blocked') {
    return `${label}-Limit erreicht (${current}/${maxStr}). Bitte Lizenz erweitern.`
  }
  if (level === 'critical') {
    return `Sie haben ${current} von ${maxStr} ${label}-Lizenzen genutzt (90 %). Bei Bedarf Lizenz erweitern.`
  }
  return `Sie haben ${current} von ${maxStr} ${label}-Lizenzen genutzt (80 %). Bei Bedarf Lizenz erweitern.`
}

export const formatLicenseDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Unbegrenzt'
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}
