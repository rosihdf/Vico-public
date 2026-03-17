/**
 * POST /api/limit-exceeded
 * Empfängt Grenzüberschreitungs-Meldungen (Benutzer/Kunden-Limit) von Haupt-App und Arbeitszeit-Portal.
 * Schreibt in limit_exceeded_log des Lizenzportals.
 */
import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

type LimitExceededBody = {
  licenseNumber: string
  limit_type: 'users' | 'customers'
  current_value: number
  max_value: number
  reported_from?: string
}

const handler: Handler = async (event: HandlerEvent): Promise<{ statusCode: number; body: string }> => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body: LimitExceededBody
  try {
    body = JSON.parse(event.body ?? '{}') as LimitExceededBody
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { licenseNumber, limit_type, current_value, max_value, reported_from } = body

  if (!licenseNumber?.trim() || !limit_type || typeof current_value !== 'number' || typeof max_value !== 'number') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'licenseNumber, limit_type, current_value, max_value erforderlich' }),
    }
  }

  if (!['users', 'customers'].includes(limit_type)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'limit_type muss users oder customers sein' }),
    }
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
    .eq('license_number', licenseNumber.trim())
    .maybeSingle()

  if (licenseError || !licenseRow) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Lizenz nicht gefunden' }) }
  }

  const { error: insertError } = await supabase.from('limit_exceeded_log').insert({
    tenant_id: licenseRow.tenant_id,
    license_id: licenseRow.id,
    limit_type,
    current_value,
    max_value,
    license_number: licenseNumber.trim(),
    reported_from: reported_from?.trim() || null,
  })

  if (insertError) {
    return { statusCode: 500, body: JSON.stringify({ error: insertError.message }) }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  }
}

export { handler }
