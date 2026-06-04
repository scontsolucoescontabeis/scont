import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function useWhatsApp() {
  const [sending, setSending] = useState(false)

  async function enviarMensagem(conversa_id, conteudo, tipo = 'text') {
    setSending(true)
    const { data, error } = await supabase.functions.invoke('send-message', {
      body: { conversa_id, conteudo, tipo },
    })
    setSending(false)
    return { data, error }
  }

  async function encerrarConversa(conversa_id) {
    const { data, error } = await supabase.functions.invoke('encerrar-conversa', {
      body: { conversa_id },
    })
    return { data, error }
  }

  async function transferirConversa(conversa_id, para_departamento, para_agente_id = null, motivo = null) {
    const { data, error } = await supabase.functions.invoke('transferir-conversa', {
      body: { conversa_id, para_departamento, para_agente_id, motivo },
    })
    return { data, error }
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
