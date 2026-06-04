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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(SB_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { conversa_id } = await req.json()
    if (!conversa_id) {
      return new Response(JSON.stringify({ error: 'conversa_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Busca conversa com dados do contato
    const { data: conversa } = await supabaseAdmin
      .from('conversas')
      .select('id, protocolo, contato_id, contatos(nome, telefone)')
      .eq('id', conversa_id)
      .single()

    if (!conversa) {
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const contato = conversa.contatos as { nome: string | null; telefone: string }
    const nomeContato = contato.nome || 'cliente'
    const telefone    = contato.telefone

    // Atualiza status para ENCERRADA
    await supabaseAdmin
      .from('conversas')
      .update({
        status: 'ENCERRADA',
        encerrado_em: new Date().toISOString(),
      })
      .eq('id', conversa_id)

    // Mensagem automática ao cliente
    const mensagemEncerramento = `Olá ${nomeContato}! Seu atendimento foi encerrado.\nProtocolo: ${conversa.protocolo}.\nSCONT Soluções Contábeis — Obrigado pelo contato!`

    await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: telefone,
        type: 'text',
        text: { body: mensagemEncerramento },
      }),
    })

    // Insere mensagem de sistema no banco
    await supabaseAdmin.from('mensagens').insert({
      conversa_id,
      conteudo: `Atendimento encerrado. Protocolo: ${conversa.protocolo}`,
      tipo: 'text',
      origem: 'SISTEMA',
      lida: true,
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Erro encerrar-conversa:', err)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
