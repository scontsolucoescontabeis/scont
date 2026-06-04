import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    const { conversa_id, para_departamento, para_agente_id, motivo } = await req.json()

    if (!conversa_id || !para_departamento) {
      return new Response(JSON.stringify({ error: 'conversa_id e para_departamento são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Busca estado atual da conversa
    const { data: conversa } = await supabaseAdmin
      .from('conversas')
      .select('id, departamento, agente_id')
      .eq('id', conversa_id)
      .single()

    if (!conversa) {
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Registra log da transferência
    await supabaseAdmin.from('transferencias').insert({
      conversa_id,
      de_agente_id:     user.id,
      para_agente_id:   para_agente_id || null,
      de_departamento:  conversa.departamento,
      para_departamento,
      motivo:           motivo || null,
    })

    // Atualiza conversa
    const novoStatus = para_agente_id ? 'EM_ATENDIMENTO' : 'AGUARDANDO'
    await supabaseAdmin
      .from('conversas')
      .update({
        departamento: para_departamento,
        agente_id:    para_agente_id || null,
        status:       novoStatus,
      })
      .eq('id', conversa_id)

    // Mensagem de sistema
    const nomeDepto: Record<string, string> = {
      PESSOAL: 'Pessoal',
      CONTABIL: 'Contábil',
      ADMINISTRATIVO: 'Administrativo',
      TRIBUTARIO: 'Tributário',
    }
    await supabaseAdmin.from('mensagens').insert({
      conversa_id,
      conteudo: `Conversa transferida para ${nomeDepto[para_departamento] || para_departamento}${motivo ? ` — ${motivo}` : ''}`,
      tipo: 'text',
      origem: 'SISTEMA',
      lida: true,
    })

    return new Response(JSON.stringify({ success: true, status: novoStatus }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Erro transferir-conversa:', err)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
