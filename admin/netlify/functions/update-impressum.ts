/**
 * PATCH/POST /api/update-impressum
 * Aktualisiert Impressum und Datenschutz des Mandanten (Self-Service).
 */
import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

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

const handler: Handler = async (event: HandlerEvent): Promise<{ statusCode: number; body: string }> => {
  if (event.httpMethod !== 'PATCH' && event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let payload: UpdatePayload
  try {
    payload = JSON.parse(event.body ?? '{}') as UpdatePayload
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const licenseNumber = payload.licenseNumber?.trim()
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
    .select('id, tenant_id')
    .eq('license_number', licenseNumber)
    .maybeSingle()

  if (licenseError || !licenseRow) {
    return { statusCode: 404, body: JSON.stringify({ error: 'License not found' }) }
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
    return { statusCode: 400, body: JSON.stringify({ error: 'No impressum or datenschutz fields to update' }) }
  }

  const { error: updateError } = await supabase
    .from('tenants')
    .update(update)
    .eq('id', tenantId)

  if (updateError) {
    return { statusCode: 500, body: JSON.stringify({ error: updateError.message }) }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  }
}

export { handler }
