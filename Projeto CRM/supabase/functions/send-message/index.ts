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

    const body = await req.json()
    const mensagemId: string | undefined = body.mensagem_id

    // Dois modos:
    //  - mensagem_id: a mensagem JÁ está no banco (gravada pelo cliente). Só enviamos
    //    no WhatsApp e carimbamos o whatsapp_msg_id — sem inserir de novo.
    //  - conversa_id + conteudo: modo legado, insere a mensagem aqui.
    let conversaId: string
    let conteudo: string
    let tipo = 'text'

    if (mensagemId) {
      const { data: msg } = await supabaseAdmin
        .from('mensagens')
        .select('id, conversa_id, conteudo, tipo, whatsapp_msg_id')
        .eq('id', mensagemId)
        .single()
      if (!msg) {
        return new Response(JSON.stringify({ error: 'Mensagem não encontrada' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (msg.whatsapp_msg_id) {
        // Já foi enviada — evita reenvio em retries
        return new Response(JSON.stringify({ mensagem: msg, jaEnviada: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      conversaId = msg.conversa_id
      conteudo   = msg.conteudo
      tipo       = msg.tipo || 'text'
    } else {
      conversaId = body.conversa_id
      conteudo   = body.conteudo
      tipo       = body.tipo || 'text'
      if (!conversaId || !conteudo) {
        return new Response(JSON.stringify({ error: 'Informe mensagem_id ou conversa_id + conteudo' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Busca número do contato via conversa
    const { data: conversa } = await supabaseAdmin
      .from('conversas')
      .select('id, contato_id, departamento, contatos(telefone)')
      .eq('id', conversaId)
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

    // Decide o canal de envio (QR Code via Evolution API ou API Oficial da Meta)
    const { data: whatsappConfig } = await supabaseAdmin
      .from('whatsapp_config')
      .select('canal_ativo')
      .eq('id', 1)
      .single()
    const canal = whatsappConfig?.canal_ativo || 'API_OFICIAL'

    let whatsappMsgId: string | undefined

    if (canal === 'QR_CODE') {
      const EVOLUTION_API_URL       = Deno.env.get('EVOLUTION_API_URL')
      const EVOLUTION_API_KEY       = Deno.env.get('EVOLUTION_API_KEY')
      const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME')

      if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
        return new Response(JSON.stringify({ error: 'Evolution API não configurada' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const evoRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
        method: 'POST',
        headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: telefone, text: conteudo }),
      })
      const evoData = await evoRes.json()

      if (!evoRes.ok) {
        console.error('Erro Evolution API:', evoData)
        return new Response(JSON.stringify({ error: 'Falha ao enviar via QR Code', detail: evoData }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      whatsappMsgId = evoData?.key?.id
    } else {
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

      whatsappMsgId = metaData?.messages?.[0]?.id
    }

    let mensagem
    if (mensagemId) {
      // Só carimba o id do WhatsApp na mensagem que o cliente já gravou
      const { data, error: updateError } = await supabaseAdmin
        .from('mensagens')
        .update({ whatsapp_msg_id: whatsappMsgId ?? null })
        .eq('id', mensagemId)
        .select()
        .single()
      if (updateError) throw updateError
      mensagem = data
    } else {
      // Modo legado: insere a mensagem
      const { data, error: insertError } = await supabaseAdmin
        .from('mensagens')
        .insert({
          conversa_id: conversaId,
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
      mensagem = data
    }

    // Atualiza timestamp da conversa
    await supabaseAdmin
      .from('conversas')
      .update({ atualizado_em: new Date().toISOString() })
      .eq('id', conversaId)

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
