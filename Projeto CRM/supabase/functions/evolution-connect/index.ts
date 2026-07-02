import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL         = Deno.env.get('SUPABASE_URL')!
const SB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SB_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!

const supabaseAdmin = createClient(SB_URL, SB_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extrairQrCodeBase64(body: Record<string, unknown>): string | null {
  const direto = body?.base64 as string | undefined
  const aninhado = (body?.qrcode as { base64?: string } | undefined)?.base64
  return direto || aninhado || null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(SB_URL, SB_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: perfil } = await supabaseAdmin
      .from('usuarios')
      .select('role')
      .eq('id', user.id)
      .single()

    if (perfil?.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem gerenciar a conexão' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const EVOLUTION_API_URL       = Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY       = Deno.env.get('EVOLUTION_API_KEY')
    const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME')
    const EVOLUTION_WEBHOOK_TOKEN = Deno.env.get('EVOLUTION_WEBHOOK_TOKEN')

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
      return new Response(JSON.stringify({
        error: 'Evolution API não configurada (EVOLUTION_API_URL/EVOLUTION_API_KEY/EVOLUTION_INSTANCE_NAME ausentes)',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabaseAdmin
      .from('whatsapp_config')
      .update({ status_conexao: 'CONECTANDO', atualizado_em: new Date().toISOString() })
      .eq('id', 1)

    // Tenta reconectar uma instância já existente
    let qrBase64: string | null = null
    const connectRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE_NAME}`, {
      headers: { apikey: EVOLUTION_API_KEY },
    })

    if (connectRes.ok) {
      qrBase64 = extrairQrCodeBase64(await connectRes.json())
    } else {
      // Instância ainda não existe — cria já com o webhook configurado
      const webhookUrl = `${SB_URL}/functions/v1/evolution-webhook?token=${EVOLUTION_WEBHOOK_TOKEN}`
      const createRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: EVOLUTION_INSTANCE_NAME,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          webhook: { url: webhookUrl, events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'] },
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        console.error('Erro Evolution API (create):', createData)
        return new Response(JSON.stringify({ error: 'Falha ao criar instância na Evolution API', detail: createData }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      qrBase64 = extrairQrCodeBase64(createData)
    }

    if (!qrBase64) {
      return new Response(JSON.stringify({ error: 'Evolution API não retornou QR Code' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabaseAdmin
      .from('whatsapp_config')
      .update({ qrcode_base64: qrBase64, status_conexao: 'CONECTANDO', atualizado_em: new Date().toISOString() })
      .eq('id', 1)

    return new Response(JSON.stringify({ ok: true, qrcode_base64: qrBase64 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Erro evolution-connect:', err)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
