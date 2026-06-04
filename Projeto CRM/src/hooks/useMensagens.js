import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function useMensagens(conversaId) {
  const [mensagens, setMensagens] = useState([])
  const [anotacoes, setAnotacoes] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchMensagens = useCallback(async () => {
    if (!conversaId) { setMensagens([]); setAnotacoes([]); return }
    setLoading(true)

    const [msgRes, anotRes] = await Promise.all([
      supabase
        .from('mensagens')
        .select('*, usuarios ( nome )')
        .eq('conversa_id', conversaId)
        .order('criado_em', { ascending: true }),
      supabase
        .from('anotacoes_internas')
        .select('*, usuarios ( nome )')
        .eq('conversa_id', conversaId)
        .order('criado_em', { ascending: true }),
    ])

    setMensagens(msgRes.data ?? [])
    setAnotacoes(anotRes.data ?? [])
    setLoading(false)
  }, [conversaId])

  useEffect(() => { fetchMensagens() }, [fetchMensagens])

  const timeline = [
    ...(mensagens.map(m => ({ ...m, _tipo: 'mensagem' }))),
    ...(anotacoes.map(a => ({ ...a, _tipo: 'anotacao' }))),
  ].sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em))

  const adicionarMensagem = useCallback((msg) => {
    setMensagens(prev => [...prev, msg])
  }, [])

  const adicionarAnotacao = useCallback((anotacao) => {
    setAnotacoes(prev => [...prev, anotacao])
  }, [])

  return { mensagens, anotacoes, timeline, loading, adicionarMensagem, adicionarAnotacao, refresh: fetchMensagens }
}
