import { supabase } from '@/lib/supabaseClient'

// ============================================================
// Conversas
// ============================================================

export async function listarConversas({ departamento, status, agenteId } = {}) {
  let query = supabase
    .from('conversas')
    .select(`
      id, protocolo, departamento, status, nao_lidas, criado_em, atualizado_em, encerrado_em,
      agente_id,
      contatos(id, nome, telefone, empresa),
      agente:usuarios!conversas_agente_id_fkey(id, nome, avatar_url)
    `)
    .order('atualizado_em', { ascending: false })

  if (status) query = query.eq('status', status)
  if (agenteId) query = query.eq('agente_id', agenteId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function buscarConversa(id) {
  const { data, error } = await supabase
    .from('conversas')
    .select(`
      id, protocolo, departamento, status, nao_lidas, titulo,
      criado_em, atualizado_em, encerrado_em,
      contatos(id, nome, telefone, empresa, observacoes),
      agente:usuarios!conversas_agente_id_fkey(id, nome, avatar_url, departamento)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function assumirConversa(conversaId, agenteId) {
  const { data, error } = await supabase
    .from('conversas')
    .update({ agente_id: agenteId, status: 'EM_ATENDIMENTO' })
    .eq('id', conversaId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function marcarComoLida(conversaId) {
  const { error } = await supabase
    .from('conversas')
    .update({ nao_lidas: 0 })
    .eq('id', conversaId)

  if (error) throw error

  await supabase
    .from('mensagens')
    .update({ lida: true })
    .eq('conversa_id', conversaId)
    .eq('lida', false)
}

export async function listarConversasAnteriores(contatoId, conversaAtualId) {
  const { data, error } = await supabase
    .from('conversas')
    .select('id, protocolo, status, criado_em, encerrado_em')
    .eq('contato_id', contatoId)
    .neq('id', conversaAtualId)
    .order('criado_em', { ascending: false })
    .limit(10)

  if (error) throw error
  return data
}

// ============================================================
// Mensagens
// ============================================================

export async function listarMensagens(conversaId) {
  const { data, error } = await supabase
    .from('mensagens')
    .select(`
      id, conteudo, tipo, media_url, origem, lida, timestamp, whatsapp_msg_id,
      agente:usuarios!mensagens_agente_id_fkey(id, nome, avatar_url)
    `)
    .eq('conversa_id', conversaId)
    .order('timestamp', { ascending: true })

  if (error) throw error
  return data
}

export async function salvarAnotacaoInterna(conversaId, agenteId, conteudo) {
  const { data, error } = await supabase
    .from('anotacoes_internas')
    .insert({ conversa_id: conversaId, agente_id: agenteId, conteudo })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function listarAnotacoes(conversaId) {
  const { data, error } = await supabase
    .from('anotacoes_internas')
    .select(`
      id, conteudo, timestamp,
      agente:usuarios!anotacoes_internas_agente_id_fkey(id, nome, avatar_url)
    `)
    .eq('conversa_id', conversaId)
    .order('timestamp', { ascending: true })

  if (error) throw error
  return data
}

// ============================================================
// Tags
// ============================================================

export async function listarTags() {
  const { data, error } = await supabase.from('tags').select('*').order('nome')
  if (error) throw error
  return data
}

export async function adicionarTag(conversaId, tagId) {
  const { error } = await supabase
    .from('conversa_tags')
    .insert({ conversa_id: conversaId, tag_id: tagId })
  if (error && error.code !== '23505') throw error // ignora duplicata
}

export async function removerTag(conversaId, tagId) {
  const { error } = await supabase
    .from('conversa_tags')
    .delete()
    .eq('conversa_id', conversaId)
    .eq('tag_id', tagId)
  if (error) throw error
}

export async function listarTagsDaConversa(conversaId) {
  const { data, error } = await supabase
    .from('conversa_tags')
    .select('tags(id, nome, cor)')
    .eq('conversa_id', conversaId)
  if (error) throw error
  return data.map(ct => ct.tags)
}

// ============================================================
// Transferências
// ============================================================

export async function listarTransferencias(conversaId) {
  const { data, error } = await supabase
    .from('transferencias')
    .select(`
      id, de_departamento, para_departamento, motivo, timestamp,
      de_agente:usuarios!transferencias_de_agente_id_fkey(id, nome),
      para_agente:usuarios!transferencias_para_agente_id_fkey(id, nome)
    `)
    .eq('conversa_id', conversaId)
    .order('timestamp', { ascending: true })

  if (error) throw error
  return data
}

// ============================================================
// Usuários
// ============================================================

export async function listarAgentes(departamento) {
  let query = supabase
    .from('usuarios')
    .select('id, nome, email, departamento, role, avatar_url, ativo')
    .eq('ativo', true)

  if (departamento) query = query.eq('departamento', departamento)

  const { data, error } = await query.order('nome')
  if (error) throw error
  return data
}

export async function buscarMeuPerfil() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (error) throw error
  return data
}

// ============================================================
// Métricas (admin)
// ============================================================

export async function buscarMetricasKPI() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [abertas, emAtendimento, encerradasHoje] = await Promise.all([
    supabase.from('conversas').select('id', { count: 'exact', head: true }).eq('status', 'ABERTA'),
    supabase.from('conversas').select('id', { count: 'exact', head: true }).eq('status', 'EM_ATENDIMENTO'),
    supabase.from('conversas').select('id', { count: 'exact', head: true })
      .eq('status', 'ENCERRADA')
      .gte('encerrado_em', hoje.toISOString()),
  ])

  return {
    abertas: abertas.count || 0,
    emAtendimento: emAtendimento.count || 0,
    encerradasHoje: encerradasHoje.count || 0,
  }
}

export async function buscarDistribuicaoDepartamento() {
  const { data, error } = await supabase
    .from('conversas')
    .select('departamento')
    .in('status', ['ABERTA', 'EM_ATENDIMENTO', 'AGUARDANDO'])

  if (error) throw error

  const counts = {}
  for (const row of data) {
    counts[row.departamento] = (counts[row.departamento] || 0) + 1
  }

  return ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO'].map(d => ({
    name: d,
    value: counts[d] || 0,
  }))
}

export async function buscarVolumeUltimosDias(dias = 7) {
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - dias)

  const { data, error } = await supabase
    .from('conversas')
    .select('criado_em')
    .gte('criado_em', inicio.toISOString())

  if (error) throw error

  const volumePorDia = {}
  for (let i = 0; i < dias; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (dias - 1 - i))
    volumePorDia[d.toISOString().slice(0, 10)] = 0
  }

  for (const row of data) {
    const dia = row.criado_em.slice(0, 10)
    if (volumePorDia[dia] !== undefined) volumePorDia[dia]++
  }

  return Object.entries(volumePorDia).map(([data, total]) => ({ data, total }))
}

export async function buscarRankingAgentes() {
  const { data, error } = await supabase
    .from('conversas')
    .select('agente_id, agente:usuarios!conversas_agente_id_fkey(id, nome, departamento)')
    .eq('status', 'ENCERRADA')
    .not('agente_id', 'is', null)

  if (error) throw error

  const mapa = {}
  for (const row of data) {
    if (!row.agente_id) continue
    if (!mapa[row.agente_id]) {
      mapa[row.agente_id] = {
        agente: row.agente,
        total: 0,
      }
    }
    mapa[row.agente_id].total++
  }

  return Object.values(mapa).sort((a, b) => b.total - a.total)
}
