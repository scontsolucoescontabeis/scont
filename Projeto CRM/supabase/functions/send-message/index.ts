import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL       = Deno.env.get('SUPABASE_URL')!
const SB_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!
const ACCESS_TOKEN    = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!

const supabaseAdmin = createClient(SB_URL, SB_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Valida JWT do agente autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(SB_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { conversa_id, conteudo, tipo = 'text' } = await req.json()

    if (!conversa_id || !conteudo) {
      return new Response(JSON.stringify({ error: 'conversa_id e conteudo são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Busca número do contato via conversa
    const { data: conversa } = await supabaseAdmin
      .from('conversas')
      .select('id, contato_id, departamento, contatos(telefone)')
      .eq('id', conversa_id)
      .single()

    if (!conversa) {
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const telefone = (conversa.contatos as { telefone: string })?.telefone
    if (!telefone) {
      return new Response(JSON.stringify({ error: 'Contato sem número de telefone' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Envia via Meta Cloud API
    const metaRes = await fetch(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: telefone,
          type: tipo,
          text: tipo === 'text' ? { body: conteudo } : undefined,
        }),
      }
    )

    const metaData = await metaRes.json()

    if (!metaRes.ok) {
      console.error('Erro Meta API:', metaData)
      return new Response(JSON.stringify({ error: 'Falha ao enviar para WhatsApp', detail: metaData }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const whatsappMsgId = metaData?.messages?.[0]?.id

    // Salva mensagem no banco
    const { data: mensagem, error: insertError } = await supabaseAdmin
      .from('mensagens')
      .insert({
        conversa_id,
        conteudo,
        tipo,
        whatsapp_msg_id: whatsappMsgId,
        origem: 'AGENTE',
        agente_id: user.id,
        lida: true,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Atualiza timestamp da conversa
    await supabaseAdmin
      .from('conversas')
      .update({ atualizado_em: new Date().toISOString() })
      .eq('id', conversa_id)

    return new Response(JSON.stringify({ mensagem }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Erro send-message:', err)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
