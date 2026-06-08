import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function useConversas({ departamento, status, busca }) {
  const [conversas, setConversas] = useState([])
  const [loading, setLoading] = useState(true)

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
    if (error) { console.error('useConversas:', error); setLoading(false); return }

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

  return { conversas, loading, refresh: fetchConversas }
}
