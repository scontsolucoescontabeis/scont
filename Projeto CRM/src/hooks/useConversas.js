import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

const POLL_INTERVAL_MS = 20_000  // fallback para quando Realtime não entrega

export function useConversas({ departamento, status, busca }) {
  const [conversas, setConversas] = useState([])
  const [loading, setLoading]   = useState(true)
  const [erro, setErro]         = useState(null)
  const timerRef = useRef(null)

  const fetchConversas = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('conversas')
      .select(`
        id, protocolo, status, departamento,
        aberto_em, atualizado_em, encerrado_em,
        bot_departamento, bot_categoria, bot_subcategoria, bot_empresa, bot_cnpj, classificacao_empresa,
        contatos ( id, telefone, nome ),
        usuarios ( id, nome ),
        mensagens ( id, conteudo, origem, criado_em, lida )
      `)
      .order('atualizado_em', { ascending: false })

    if (departamento) query = query.eq('departamento', departamento)
    if (status)       query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
      console.error('useConversas:', error)
      setErro(error.message ?? 'Erro ao carregar conversas')
      setLoading(false)
      return
    }

    setErro(null)
    let resultado = data ?? []
    if (busca?.trim()) {
      const termo = busca.toLowerCase()
      resultado = resultado.filter(c =>
        c.contatos?.nome?.toLowerCase().includes(termo) ||
        c.contatos?.telefone?.includes(termo) ||
        c.protocolo?.toLowerCase().includes(termo)
      )
    }
    setConversas(resultado)
    setLoading(false)
  }, [departamento, status, busca])

  useEffect(() => { fetchConversas() }, [fetchConversas])

  // Polling como fallback para Realtime
  useEffect(() => {
    timerRef.current = setInterval(fetchConversas, POLL_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [fetchConversas])

  return { conversas, loading, erro, refresh: fetchConversas }
}
