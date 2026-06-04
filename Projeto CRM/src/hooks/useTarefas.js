import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

const SELECT_TAREFAS = `
  id, titulo, descricao, departamento, status, prioridade,
  prazo, criado_em, atualizado_em, concluido_em, conversa_id,
  criador:criado_por ( id, nome ),
  responsavel:atribuido_a ( id, nome ),
  conclusor:concluido_por ( id, nome ),
  conversas ( protocolo, contatos ( nome, telefone ) )
`

export function useTarefas({ departamento = null, status = null, conversaId = null } = {}) {
  const [tarefas, setTarefas] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('tarefas').select(SELECT_TAREFAS).order('criado_em', { ascending: false })
    if (departamento) q = q.eq('departamento', departamento)
    if (status)       q = q.eq('status', status)
    if (conversaId)   q = q.eq('conversa_id', conversaId)
    const { data } = await q
    setTarefas(data ?? [])
    setLoading(false)
  }, [departamento, status, conversaId])

  useEffect(() => { fetch() }, [fetch])

  return { tarefas, loading, refresh: fetch }
}

export async function criarTarefa({ conversaId, titulo, descricao, departamento, prioridade, atribuidoA, prazo }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: u } = await supabase.from('usuarios').select('id').eq('id', user.id).single()

  const { data, error } = await supabase.from('tarefas').insert({
    conversa_id:  conversaId ?? null,
    titulo,
    descricao:    descricao || null,
    departamento,
    prioridade:   prioridade ?? 'NORMAL',
    criado_por:   u.id,
    atribuido_a:  atribuidoA ?? null,
    prazo:        prazo ?? null,
  }).select(SELECT_TAREFAS).single()

  return { data, error }
}

export async function atualizarStatusTarefa(id, novoStatus) {
  const update = { status: novoStatus }
  if (novoStatus === 'CONCLUIDA') {
    const { data: { user } } = await supabase.auth.getUser()
    update.concluido_em = new Date().toISOString()
    update.concluido_por = user.id
  }
  const { error } = await supabase.from('tarefas').update(update).eq('id', id)
  return { error }
}

export async function editarTarefa(id, campos) {
  const { error } = await supabase.from('tarefas').update(campos).eq('id', id)
  return { error }
}
