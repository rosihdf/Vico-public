import { supabase } from '../supabase'

export type LicenseStatus = {
  tier: string
  valid_until: string | null
  max_customers: number | null
  max_users: number | null
  current_customers: number
  current_users: number
  features: Record<string, boolean>
  valid: boolean
  expired: boolean
}

const EMPTY_LICENSE: LicenseStatus = {
  tier: 'none',
  valid_until: null,
  max_customers: null,
  max_users: null,
  current_customers: 0,
  current_users: 0,
  features: {},
  valid: false,
  expired: true,
}

export const fetchLicenseStatus = async (): Promise<LicenseStatus> => {
  const { data, error } = await supabase.rpc('get_license_status')
  if (error || !data) return EMPTY_LICENSE
  return data as LicenseStatus
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

export const hasFeature = (license: LicenseStatus, feature: string): boolean => {
  return license.features?.[feature] === true
}

export const isLimitReached = (current: number, max: number | null): boolean => {
  if (max === null) return false
  return current >= max
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
