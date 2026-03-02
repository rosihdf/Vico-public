import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'npm:https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  pdfStoragePath: string
  toEmail: string
  subject?: string
  filename?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY nicht konfiguriert. Bitte in Supabase unter Project Settings > Edge Functions > Secrets setzen.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = (await req.json()) as RequestBody
    const { pdfStoragePath, toEmail, subject, filename } = body

    if (!pdfStoragePath || !toEmail) {
      return new Response(
        JSON.stringify({ error: 'pdfStoragePath und toEmail sind erforderlich.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('maintenance-photos')
      .download(pdfStoragePath)

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: `PDF konnte nicht geladen werden: ${downloadError?.message ?? 'Unbekannt'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM') || 'Vico Wartung <onboarding@resend.dev>',
        to: [toEmail],
        subject: subject || 'Wartungsprotokoll',
        html: '<p>Anbei erhalten Sie das Wartungsprotokoll.</p>',
        attachments: [
          {
            content: base64,
            filename: filename || 'Wartungsprotokoll.pdf',
          },
        ],
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: result.message || result.detail || 'E-Mail konnte nicht gesendet werden.' }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
