import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const DEV_BYPASS_TOKEN = Deno.env.get('DEV_BYPASS_TOKEN')
  if (!DEV_BYPASS_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'DEV_BYPASS_TOKEN não configurado no Supabase' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  let body: { phone?: string; name?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Body JSON inválido' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  const { phone, name, message } = body
  if (!phone || !message) {
    return new Response(
      JSON.stringify({ error: 'Campos obrigatórios: phone, message' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // Normaliza: remove +, espaços, traços → formato Meta (ex: 5511990010001)
  const telefone = phone.replace(/\D/g, '')

  const payload = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            from: telefone,
            type: 'text',
            text: { body: message },
            timestamp: String(Math.floor(Date.now() / 1000)),
          }],
          contacts: [{ profile: { name: name || telefone } }],
          metadata: { phone_number_id: 'SIMULATOR', display_phone_number: 'SIMULATOR' },
        }
      }]
    }]
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`

  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'X-Dev-Bypass-Token': DEV_BYPASS_TOKEN,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({ ok: res.ok }))

  return new Response(
    JSON.stringify(data),
    {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    }
  )
})
