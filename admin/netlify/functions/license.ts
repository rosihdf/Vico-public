import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

type LicenseResponse = {
  license: {
    tier: string
    valid_until: string | null
    grace_period_days: number
    max_users: number | null
    max_customers: number | null
    check_interval: 'on_start' | 'daily' | 'weekly'
    features: Record<string, boolean>
    valid: boolean
    expired: boolean
    read_only: boolean
    is_trial: boolean
  }
  design: {
    app_name: string
    logo_url: string | null
    primary_color: string
    secondary_color?: string | null
    favicon_url?: string | null
  }
  impressum?: Record<string, string | null>
  datenschutz?: Record<string, string | null>
}

const handler: Handler = async (event: HandlerEvent): Promise<{ statusCode: number; body: string }> => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const licenseNumber = event.queryStringParameters?.licenseNumber?.trim()
  if (!licenseNumber) {
    return { statusCode: 400, body: JSON.stringify({ error: 'licenseNumber required' }) }
  }

  const url = process.env.SUPABASE_LICENSE_PORTAL_URL
  const key = process.env.SUPABASE_LICENSE_PORTAL_SERVICE_ROLE_KEY
  if (!url || !key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'License portal not configured' }) }
  }

  const supabase = createClient(url, key)

  const { data: licenseRow, error: licenseError } = await supabase
    .from('licenses')
    .select(`
      id,
      tenant_id,
      tier,
      valid_until,
      is_trial,
      grace_period_days,
      max_users,
      max_customers,
      check_interval,
      features,
      tenants (
        id,
        name,
        app_name,
        logo_url,
        primary_color,
        secondary_color,
        favicon_url,
        impressum_company_name,
        impressum_address,
        impressum_contact,
        impressum_represented_by,
        impressum_register,
        impressum_vat_id,
        datenschutz_responsible,
        datenschutz_contact_email,
        datenschutz_dsb_email
      )
    `)
    .eq('license_number', licenseNumber)
    .maybeSingle()

  if (licenseError || !licenseRow) {
    return { statusCode: 404, body: JSON.stringify({ error: 'License not found' }) }
  }

  const tenant = licenseRow.tenants as Record<string, unknown> | null
  const validUntil = licenseRow.valid_until ? new Date(licenseRow.valid_until) : null
  const isExpired = validUntil !== null && validUntil < new Date()
  const graceDays = Math.max(0, Number(licenseRow.grace_period_days) || 0)
  const graceEnd = validUntil && graceDays > 0 ? new Date(validUntil.getTime()) : null
  if (graceEnd) graceEnd.setDate(graceEnd.getDate() + graceDays)
  const withinGrace = isExpired && graceEnd !== null && graceEnd >= new Date()
  const readOnly = withinGrace

  const response: LicenseResponse = {
    license: {
      tier: licenseRow.tier ?? 'professional',
      valid_until: licenseRow.valid_until,
      grace_period_days: graceDays,
      max_users: licenseRow.max_users,
      max_customers: licenseRow.max_customers,
      check_interval: (licenseRow.check_interval as 'on_start' | 'daily' | 'weekly') ?? 'daily',
      features: (licenseRow.features as Record<string, boolean>) ?? {},
      valid: !isExpired || withinGrace,
      expired: isExpired,
      read_only: readOnly,
      is_trial: Boolean(licenseRow.is_trial),
    },
    design: {
      app_name: (tenant?.app_name as string) ?? 'Vico',
      logo_url: (tenant?.logo_url as string) ?? null,
      primary_color: (tenant?.primary_color as string) ?? '#5b7895',
      secondary_color: (tenant?.secondary_color as string) ?? null,
      favicon_url: (tenant?.favicon_url as string) ?? null,
    },
    impressum: tenant
      ? {
          company_name: tenant.impressum_company_name as string | null,
          address: tenant.impressum_address as string | null,
          contact: tenant.impressum_contact as string | null,
          represented_by: tenant.impressum_represented_by as string | null,
          register: tenant.impressum_register as string | null,
          vat_id: tenant.impressum_vat_id as string | null,
        }
      : undefined,
    datenschutz: tenant
      ? {
          responsible: tenant.datenschutz_responsible as string | null,
          contact_email: tenant.datenschutz_contact_email as string | null,
          dsb_email: tenant.datenschutz_dsb_email as string | null,
        }
      : undefined,
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response),
  }
}

export { handler }
