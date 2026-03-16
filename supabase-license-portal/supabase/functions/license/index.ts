import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const url = new URL(req.url)
    const licenseNumber = url.searchParams.get('licenseNumber')?.trim()
    if (!licenseNumber) {
      return new Response(
        JSON.stringify({ error: 'licenseNumber required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'License portal not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

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
      return new Response(
        JSON.stringify({ error: 'License not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenant = licenseRow.tenants as Record<string, unknown> | null
    const validUntil = licenseRow.valid_until ? new Date(licenseRow.valid_until) : null
    const isExpired = validUntil !== null && validUntil < new Date()
    const graceDays = Math.max(0, Number(licenseRow.grace_period_days) ?? 0)
    const graceEnd = validUntil && graceDays > 0 ? new Date(validUntil) : null
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

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
