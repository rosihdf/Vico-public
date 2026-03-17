/**
 * PATCH /update-impressum
 * Aktualisiert Impressum und Datenschutz des Mandanten (Self-Service).
 * Auth: licenseNumber im Body – nur Mandanten mit gültiger Lizenz können eigene Stammdaten ändern.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type UpdatePayload = {
  licenseNumber: string
  impressum?: {
    company_name?: string | null
    address?: string | null
    contact?: string | null
    represented_by?: string | null
    register?: string | null
    vat_id?: string | null
  }
  datenschutz?: {
    responsible?: string | null
    contact_email?: string | null
    dsb_email?: string | null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    let payload: UpdatePayload
    try {
      payload = (await req.json()) as UpdatePayload
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const licenseNumber = payload.licenseNumber?.trim()
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
      .select('id, tenant_id')
      .eq('license_number', licenseNumber)
      .maybeSingle()

    if (licenseError || !licenseRow) {
      return new Response(
        JSON.stringify({ error: 'License not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenantId = licenseRow.tenant_id as string
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (payload.impressum) {
      if (payload.impressum.company_name !== undefined) update.impressum_company_name = payload.impressum.company_name || null
      if (payload.impressum.address !== undefined) update.impressum_address = payload.impressum.address || null
      if (payload.impressum.contact !== undefined) update.impressum_contact = payload.impressum.contact || null
      if (payload.impressum.represented_by !== undefined) update.impressum_represented_by = payload.impressum.represented_by || null
      if (payload.impressum.register !== undefined) update.impressum_register = payload.impressum.register || null
      if (payload.impressum.vat_id !== undefined) update.impressum_vat_id = payload.impressum.vat_id || null
    }
    if (payload.datenschutz) {
      if (payload.datenschutz.responsible !== undefined) update.datenschutz_responsible = payload.datenschutz.responsible || null
      if (payload.datenschutz.contact_email !== undefined) update.datenschutz_contact_email = payload.datenschutz.contact_email || null
      if (payload.datenschutz.dsb_email !== undefined) update.datenschutz_dsb_email = payload.datenschutz.dsb_email || null
    }

    if (Object.keys(update).length <= 1) {
      return new Response(
        JSON.stringify({ error: 'No impressum or datenschutz fields to update' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: updateError } = await supabase
      .from('tenants')
      .update(update)
      .eq('id', tenantId)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ ok: true }), {
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
