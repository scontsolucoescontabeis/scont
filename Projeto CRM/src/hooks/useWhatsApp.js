import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const NOMES_DEPTO = {
  PESSOAL: 'Pessoal', CONTABIL: 'Contábil',
  ADMINISTRATIVO: 'Administrativo', TRIBUTARIO: 'Tributário',
}

export function useWhatsApp() {
  const [sending, setSending] = useState(false)

  async function enviarMensagem(conversa_id, conteudo, tipo = 'text') {
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Salva mensagem no banco
      const { data, error } = await supabase
        .from('mensagens')
        .insert({ conversa_id, conteudo, tipo, origem: 'AGENTE', agente_id: user?.id ?? null, lida: true })
        .select()
        .single()

      if (error) return { data: null, error }

      // Atualiza timestamp da conversa
      await supabase.from('conversas')
        .update({ atualizado_em: new Date().toISOString(), status: 'EM_ATENDIMENTO', agente_id: user?.id ?? null })
        .eq('id', conversa_id)
        .in('status', ['ABERTA', 'AGUARDANDO'])   // só avança se ainda não estava em atendimento

      // Tenta enviar via WhatsApp (silencioso se não configurado)
      _tentarEnviarWhatsApp(conversa_id, conteudo, tipo)

      return { data, error: null }
    } catch (err) {
      return { data: null, error: err }
    } finally {
      setSending(false)
    }
  }

  async function encerrarConversa(conversa_id) {
    try {
      // Busca protocolo e contato
      const { data: conversa } = await supabase
        .from('conversas')
        .select('protocolo, contatos(nome)')
        .eq('id', conversa_id)
        .single()

      // Atualiza status
      const { error } = await supabase
        .from('conversas')
        .update({ status: 'ENCERRADA', encerrado_em: new Date().toISOString() })
        .eq('id', conversa_id)

      if (error) return { data: null, error }

      // Mensagem de sistema no banco
      const protocolo = conversa?.protocolo ?? ''
      await supabase.from('mensagens').insert({
        conversa_id,
        conteudo: `Atendimento encerrado. Protocolo: ${protocolo}`,
        tipo: 'text', origem: 'SISTEMA', lida: true,
      })

      return { data: { success: true }, error: null }
    } catch (err) {
      return { data: null, error: err }
    }
  }

  async function transferirConversa(conversa_id, para_departamento, para_agente_id = null, motivo = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Busca estado atual
      const { data: conversa } = await supabase
        .from('conversas')
        .select('departamento, agente_id')
        .eq('id', conversa_id)
        .single()

      if (!conversa) return { data: null, error: new Error('Conversa não encontrada') }

      // Registra transferência
      await supabase.from('transferencias').insert({
        conversa_id,
        de_agente_id:     user?.id ?? null,
        para_agente_id:   para_agente_id || null,
        de_departamento:  conversa.departamento,
        para_departamento,
        motivo:           motivo || null,
      })

      // Atualiza conversa
      const novoStatus = para_agente_id ? 'EM_ATENDIMENTO' : 'AGUARDANDO'
      await supabase.from('conversas')
        .update({ departamento: para_departamento, agente_id: para_agente_id || null, status: novoStatus })
        .eq('id', conversa_id)

      // Mensagem de sistema
      const nomeDepto = NOMES_DEPTO[para_departamento] ?? para_departamento
      await supabase.from('mensagens').insert({
        conversa_id,
        conteudo: `Conversa transferida para ${nomeDepto}${motivo ? ` — ${motivo}` : ''}`,
        tipo: 'text', origem: 'SISTEMA', lida: true,
      })

      return { data: { success: true, status: novoStatus }, error: null }
    } catch (err) {
      return { data: null, error: err }
    }
  }

  async function assumirConversa(conversa_id) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('conversas')
      .update({ agente_id: user.id, status: 'EM_ATENDIMENTO' })
      .eq('id', conversa_id)
    return { error }
  }

  async function salvarAnotacao(conversa_id, conteudo) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('anotacoes_internas')
      .insert({ conversa_id, agente_id: user.id, conteudo })
      .select('*, usuarios(nome)')
      .single()
    return { data, error }
  }

  async function marcarLidas(conversa_id) {
    await supabase
      .from('mensagens')
      .update({ lida: true })
      .eq('conversa_id', conversa_id)
      .eq('origem', 'CLIENTE')
      .eq('lida', false)
  }

  return { sending, enviarMensagem, encerrarConversa, transferirConversa, assumirConversa, salvarAnotacao, marcarLidas }
}

// Tenta enviar pelo WhatsApp se as Edge Functions estiverem disponíveis.
// Falha silenciosa — não bloqueia o fluxo de testes.
async function _tentarEnviarWhatsApp(conversa_id, conteudo, tipo) {
  try {
    await supabase.functions.invoke('send-message', { body: { conversa_id, conteudo, tipo } })
  } catch {
    // Edge Function não deployada — ignorado em ambiente de testes
  }
}
