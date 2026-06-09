import { supabase } from '@/lib/supabaseClient'

// Busca perfil CRM do usuário autenticado via RPC (vincula por email)
export async function buscarMeuPerfil() {
  const { data, error } = await supabase.rpc('get_meu_perfil_crm')
  if (error || !data || data.length === 0) return null
  return data[0]
}

export async function buscarAgentesDoDepto(departamento) {
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, departamento, email')
    .eq('departamento', departamento)
    .eq('ativo', true)
    .not('departamento', 'is', null)
    .order('nome')
  return data ?? []
}

export async function buscarTodosAgentes() {
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, email, departamento, role, ativo, is_admin')
    .not('departamento', 'is', null)  // só quem tem acesso CRM
    .order('nome')
  return data ?? []
}

export async function buscarTodosUsuariosPortal() {
  // Retorna TODOS os usuarios do portal (para admin configurar acesso ao CRM)
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, email, departamento, role, ativo, is_admin')
    .order('nome')
  return data ?? []
}

export async function configurarAcessoCRM(usuarioId, departamentos, role) {
  // Tenta gravar com coluna array (migration 005). Se não existir, usa coluna singular.
  const payload = {
    departamento: departamentos[0] ?? null,
    role: departamentos.length ? role : null,
  }
  const { error: err1 } = await supabase
    .from('usuarios')
    .update({ ...payload, departamentos: departamentos.length ? departamentos : null })
    .eq('id', usuarioId)

  if (err1?.message?.includes('departamentos')) {
    // Coluna array ainda não existe (migration 005 pendente) — usa só o singular
    const { error: err2 } = await supabase
      .from('usuarios')
      .update(payload)
      .eq('id', usuarioId)
    if (err2) throw err2
    return
  }
  if (err1) throw err1
}

export async function revogarAcessoCRM(usuarioId) {
  const { error: err1 } = await supabase
    .from('usuarios')
    .update({ departamentos: null, departamento: null, ativo: false })
    .eq('id', usuarioId)

  if (err1?.message?.includes('departamentos')) {
    const { error: err2 } = await supabase
      .from('usuarios')
      .update({ departamento: null, ativo: false })
      .eq('id', usuarioId)
    if (err2) throw err2
    return
  }
  if (err1) throw err1
}

// ─── Helpers de período ────────────────────────────────────────
export function calcPeriodo(tipo, customInicio, customFim) {
  const now = new Date()
  if (tipo === 'hoje') {
    const inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const fim    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const inicioPrev = new Date(inicio); inicioPrev.setDate(inicioPrev.getDate() - 1)
    const fimPrev    = new Date(fim);    fimPrev.setDate(fimPrev.getDate() - 1)
    return { inicio, fim, inicioPrev, fimPrev, label: 'Hoje' }
  }
  if (tipo === '7d') {
    const fim    = new Date(now)
    const inicio = new Date(now); inicio.setDate(inicio.getDate() - 6); inicio.setHours(0, 0, 0, 0)
    const fimPrev    = new Date(inicio.getTime() - 1)
    const inicioPrev = new Date(fimPrev); inicioPrev.setDate(inicioPrev.getDate() - 6); inicioPrev.setHours(0, 0, 0, 0)
    return { inicio, fim, inicioPrev, fimPrev, label: 'Últimos 7 dias' }
  }
  if (tipo === 'mes') {
    const inicio     = new Date(now.getFullYear(), now.getMonth(), 1)
    const fim        = new Date(now)
    const inicioPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const fimPrev    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    return { inicio, fim, inicioPrev, fimPrev, label: 'Mês corrente' }
  }
  if (tipo === 'custom' && customInicio && customFim) {
    const inicio = new Date(customInicio)
    const fim    = new Date(customFim); fim.setHours(23, 59, 59, 999)
    const durMs      = fim - inicio
    const inicioPrev = new Date(inicio.getTime() - durMs - 1)
    const fimPrev    = new Date(inicio.getTime() - 1)
    return { inicio, fim, inicioPrev, fimPrev, label: `${customInicio} → ${customFim}` }
  }
  return null
}

// ─── Métricas em tempo real (sem período) ─────────────────────
export async function buscarMetricasVivo() {
  const [aberta, emAtend, aguardando, ativos] = await Promise.all([
    supabase.from('conversas').select('id', { count: 'exact', head: true }).eq('status', 'ABERTA'),
    supabase.from('conversas').select('id', { count: 'exact', head: true }).eq('status', 'EM_ATENDIMENTO'),
    supabase.from('conversas').select('id', { count: 'exact', head: true }).eq('status', 'AGUARDANDO'),
    supabase.from('conversas').select('agente_id').eq('status', 'EM_ATENDIMENTO').not('agente_id', 'is', null),
  ])
  const agentesAtivos = new Set((ativos.data ?? []).map(c => c.agente_id)).size
  return {
    aberta:        aberta.count  ?? 0,
    emAtendimento: emAtend.count ?? 0,
    aguardando:    aguardando.count ?? 0,
    agentesAtivos,
  }
}

// ─── Aba Geral ─────────────────────────────────────────────────
export async function buscarMetricasGeral({ inicio, fim, inicioPrev, fimPrev }) {
  const [atual, prev, pendentes] = await Promise.all([
    supabase.from('conversas').select('status, departamento, aberto_em')
      .gte('aberto_em', inicio.toISOString()).lte('aberto_em', fim.toISOString()),
    supabase.from('conversas').select('status')
      .gte('aberto_em', inicioPrev.toISOString()).lte('aberto_em', fimPrev.toISOString()),
    supabase.from('conversas').select('id', { count: 'exact', head: true })
      .in('status', ['ABERTA', 'EM_ATENDIMENTO', 'AGUARDANDO']),
  ])
  const dados     = atual.data ?? []
  const dadosPrev = prev.data  ?? []
  const total         = dados.length
  const encerradas    = dados.filter(c => c.status === 'ENCERRADA').length
  const totalPrev     = dadosPrev.length
  const encerradasPrev = dadosPrev.filter(c => c.status === 'ENCERRADA').length

  const porDepto = {}
  for (const c of dados) if (c.departamento) porDepto[c.departamento] = (porDepto[c.departamento] ?? 0) + 1

  const volMap = {}
  for (const c of dados) {
    const d = c.aberto_em?.slice(0, 10)
    if (d) volMap[d] = (volMap[d] ?? 0) + 1
  }
  const volumePorDia = Object.entries(volMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, total]) => ({ data: data.slice(5).replace('-', '/'), total }))

  const delta = (a, b) => b > 0 ? Math.round(((a - b) / b) * 100) : null
  const taxaRes     = total     > 0 ? Math.round((encerradas     / total)     * 100) : 0
  const taxaResPrev = totalPrev > 0 ? Math.round((encerradasPrev / totalPrev) * 100) : 0

  return {
    total, encerradas,
    abertas: pendentes.count ?? 0,
    taxaResolucao: taxaRes,
    deltaTotalPct:      delta(total,     totalPrev),
    deltaEncerradasPct: delta(encerradas, encerradasPrev),
    deltaTaxaPp: taxaRes - taxaResPrev,
    porDepto, volumePorDia,
  }
}

// ─── Aba Equipe ────────────────────────────────────────────────
export async function buscarMetricasEquipe({ inicio, fim }) {
  const [convs, transf, cargaData] = await Promise.all([
    supabase.from('conversas').select('status, agente_id, usuarios(nome)')
      .gte('aberto_em', inicio.toISOString()).lte('aberto_em', fim.toISOString()),
    supabase.from('transferencias').select('id', { count: 'exact', head: true })
      .gte('criado_em', inicio.toISOString()).lte('criado_em', fim.toISOString()),
    supabase.from('conversas').select('departamento')
      .in('status', ['ABERTA', 'EM_ATENDIMENTO', 'AGUARDANDO']),
  ])
  const dados     = convs.data ?? []
  const encerradas = dados.filter(c => c.status === 'ENCERRADA' && c.agente_id)

  const agentMap = {}
  for (const c of encerradas) {
    const id = c.agente_id
    if (!agentMap[id]) agentMap[id] = { nome: c.usuarios?.nome ?? '—', total: 0 }
    agentMap[id].total++
  }
  const ranking = Object.values(agentMap).sort((a, b) => b.total - a.total).slice(0, 8)
  const max = ranking[0]?.total ?? 1

  const cargaDepto = {}
  for (const c of (cargaData.data ?? [])) cargaDepto[c.departamento] = (cargaDepto[c.departamento] ?? 0) + 1

  const agentesCount = Object.keys(agentMap).length
  const total = dados.length

  return {
    ranking: ranking.map(r => ({ ...r, pct: Math.round((r.total / max) * 100) })),
    cargaDepto,
    agentesAtivos:     agentesCount,
    mediaConvs:        agentesCount > 0 ? (encerradas.length / agentesCount).toFixed(1) : '0',
    taxaTransferencia: total > 0 ? Math.round(((transf.count ?? 0) / total) * 100) : 0,
    maiorCarga:        ranking[0]?.total ?? 0,
  }
}

// ─── Aba Tempo ─────────────────────────────────────────────────
export async function buscarMetricasTempo({ inicio, fim }) {
  const { data } = await supabase.from('conversas')
    .select('aberto_em, encerrado_em, departamento')
    .eq('status', 'ENCERRADA')
    .gte('aberto_em', inicio.toISOString()).lte('aberto_em', fim.toISOString())
    .not('encerrado_em', 'is', null)

  if (!data || data.length === 0) return { tma: 0, maiorTma: 0, distribuicao: [], tmaPorDepto: {} }

  const duracoes = data.map(c => ({
    mins: Math.max(0, (new Date(c.encerrado_em) - new Date(c.aberto_em)) / 60000),
    depto: c.departamento,
  }))
  const total    = duracoes.length
  const tma      = Math.round(duracoes.reduce((s, d) => s + d.mins, 0) / total)
  const maiorTma = Math.round(Math.max(...duracoes.map(d => d.mins)))

  const deptoMap = {}
  for (const d of duracoes) {
    if (!deptoMap[d.depto]) deptoMap[d.depto] = { soma: 0, count: 0 }
    deptoMap[d.depto].soma  += d.mins
    deptoMap[d.depto].count += 1
  }
  const tmaPorDepto = Object.fromEntries(
    Object.entries(deptoMap).map(([k, v]) => [k, Math.round(v.soma / v.count)])
  )

  const ate10    = duracoes.filter(d => d.mins < 10).length
  const de10a30  = duracoes.filter(d => d.mins >= 10 && d.mins <= 30).length
  const acima30  = duracoes.filter(d => d.mins > 30).length

  return {
    tma, maiorTma, tmaPorDepto,
    distribuicao: [
      { label: 'Até 10 min',      pct: Math.round((ate10   / total) * 100), cor: '#2d7a4f', sub: 'Atendimentos rápidos'   },
      { label: '10 a 30 min',     pct: Math.round((de10a30 / total) * 100), cor: '#3B82F6', sub: 'Atendimento padrão'     },
      { label: 'Acima de 30 min', pct: Math.round((acima30 / total) * 100), cor: '#b87a00', sub: 'Atendimentos complexos' },
    ],
  }
}

// ─── Aba Qualidade ─────────────────────────────────────────────
export async function buscarMetricasQualidade({ inicio, fim }) {
  const [convs, transf, msgs] = await Promise.all([
    supabase.from('conversas').select('status, departamento')
      .gte('aberto_em', inicio.toISOString()).lte('aberto_em', fim.toISOString()),
    supabase.from('transferencias').select('motivo, conversa_id')
      .gte('criado_em', inicio.toISOString()).lte('criado_em', fim.toISOString()),
    supabase.from('mensagens').select('conversa_id')
      .gte('criado_em', inicio.toISOString()).lte('criado_em', fim.toISOString()),
  ])
  const dados  = convs.data ?? []
  const total  = dados.length
  const encerradas = dados.filter(c => c.status === 'ENCERRADA').length

  const deptoTotal = {}, deptoEnc = {}
  for (const c of dados) {
    deptoTotal[c.departamento] = (deptoTotal[c.departamento] ?? 0) + 1
    if (c.status === 'ENCERRADA') deptoEnc[c.departamento] = (deptoEnc[c.departamento] ?? 0) + 1
  }
  const resolucaoPorDepto = Object.fromEntries(
    Object.entries(deptoTotal).map(([k, v]) => [k, v > 0 ? Math.round(((deptoEnc[k] ?? 0) / v) * 100) : 0])
  )

  const motivoMap = {}
  for (const t of (transf.data ?? [])) {
    const m = t.motivo?.trim() || 'Não informado'
    motivoMap[m] = (motivoMap[m] ?? 0) + 1
  }
  const motivosTransferencia = Object.entries(motivoMap)
    .map(([motivo, count]) => ({ motivo, count }))
    .sort((a, b) => b.count - a.count).slice(0, 4)

  const msgMap = {}
  for (const m of (msgs.data ?? [])) msgMap[m.conversa_id] = (msgMap[m.conversa_id] ?? 0) + 1
  const convIds = Object.keys(msgMap)
  const mediaMsgs = convIds.length > 0
    ? (Object.values(msgMap).reduce((a, b) => a + b, 0) / convIds.length).toFixed(1) : '0'

  const convTransf = new Set((transf.data ?? []).map(t => t.conversa_id)).size

  return {
    taxaResolucao:     total > 0 ? Math.round((encerradas / total) * 100) : 0,
    taxaTransferencia: total > 0 ? Math.round((convTransf  / total) * 100) : 0,
    mediaMsgs, resolucaoPorDepto, motivosTransferencia,
  }
}

// ─── Métricas legadas (mantidas para compatibilidade) ──────────
export async function buscarMetricas() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [abertas, emAtendimento, encerradasHoje, ranking] = await Promise.all([
    supabase.from('conversas').select('id', { count: 'exact', head: true }).eq('status', 'ABERTA'),
    supabase.from('conversas').select('id', { count: 'exact', head: true }).eq('status', 'EM_ATENDIMENTO'),
    supabase.from('conversas').select('id', { count: 'exact', head: true })
      .eq('status', 'ENCERRADA')
      .gte('encerrado_em', hoje.toISOString()),
    supabase.from('conversas').select('departamento').eq('status', 'ENCERRADA'),
  ])

  const porDepto = { PESSOAL: 0, CONTABIL: 0, ADMINISTRATIVO: 0, TRIBUTARIO: 0 }
  if (ranking.data) {
    for (const c of ranking.data) {
      if (c.departamento) porDepto[c.departamento] = (porDepto[c.departamento] ?? 0) + 1
    }
  }

  return {
    abertas: abertas.count ?? 0,
    emAtendimento: emAtendimento.count ?? 0,
    encerradasHoje: encerradasHoje.count ?? 0,
    porDepto,
  }
}

// ─── Chatbot Config ────────────────────────────────────────────

export async function buscarChatbotConfig() {
  const { data } = await supabase
    .from('chatbot_config')
    .select('*')
    .eq('id', 1)
    .single()
  return data
}

export async function salvarChatbotConfig(updates) {
  const { error } = await supabase
    .from('chatbot_config')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
}

// ─── Chatbot Dept Config ────────────────────────────────────────

export async function buscarChatbotDeptConfig() {
  const { data } = await supabase
    .from('chatbot_dept_config')
    .select('*')
    .order('departamento')
  return data ?? []
}

export async function salvarChatbotDeptConfig(departamento, updates) {
  const { error } = await supabase
    .from('chatbot_dept_config')
    .update(updates)
    .eq('departamento', departamento)
  if (error) throw error
}

// ─── Chatbot Menus ────────────────────────────────────────────

export async function buscarMenusPorDept(departamento) {
  const { data } = await supabase
    .from('chatbot_menus')
    .select('*')
    .eq('departamento', departamento)
    .order('nivel')
    .order('ordem')
  return data ?? []
}

export async function buscarTodosMenus() {
  const { data } = await supabase
    .from('chatbot_menus')
    .select('*')
    .order('departamento')
    .order('nivel')
    .order('ordem')
  return data ?? []
}

export async function criarMenu(menu) {
  // menu: { departamento, titulo, nivel, ordem, ativo, parent_id? }
  const { data, error } = await supabase
    .from('chatbot_menus')
    .insert(menu)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarMenu(id, updates) {
  const { error } = await supabase
    .from('chatbot_menus')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function excluirMenu(id) {
  // Cascade deleta sub-itens via FK ON DELETE CASCADE
  const { error } = await supabase
    .from('chatbot_menus')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function reordenarMenus(itens) {
  // itens: Array<{ id: string, ordem: number }>
  const updates = itens.map(({ id, ordem }) =>
    supabase.from('chatbot_menus').update({ ordem }).eq('id', id)
  )
  await Promise.all(updates)
}

// ─── Chatbot Avaliações (CSAT) ─────────────────────────────────

export async function buscarAvaliacoesCsat({ departamento, inicio, fim, limit = 50 } = {}) {
  const join = departamento ? 'conversas!inner(protocolo, departamento, encerrado_em)' : 'conversas(protocolo, departamento, encerrado_em)'
  let query = supabase
    .from('chatbot_avaliacoes')
    .select(`*, ${join}`)
    .order('criado_em', { ascending: false })
    .limit(limit)

  if (departamento) query = query.eq('conversas.departamento', departamento)
  if (inicio) query = query.gte('criado_em', new Date(inicio).toISOString())
  if (fim)    query = query.lte('criado_em', new Date(fim + 'T23:59:59').toISOString())

  const { data } = await query
  return data ?? []
}

export async function buscarMediaCsat({ departamento, inicio, fim } = {}) {
  const rows = await buscarAvaliacoesCsat({ departamento, inicio, fim, limit: 1000 })
  if (rows.length === 0) return { media: 0, total: 0, distribuicao: {} }

  const total = rows.length
  const soma = rows.reduce((s, r) => s + r.nota, 0)
  const media = Math.round((soma / total) * 10) / 10

  const distribuicao = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of rows) distribuicao[r.nota] = (distribuicao[r.nota] ?? 0) + 1

  return { media, total, distribuicao }
}

// ─── Chatbot Feriados / Datas Fiscais ─────────────────────────

export async function buscarFeriados({ ano, tipo } = {}) {
  let query = supabase
    .from('chatbot_feriados')
    .select('*')
    .order('data')

  if (ano) {
    query = query
      .gte('data', `${ano}-01-01`)
      .lte('data', `${ano}-12-31`)
  }
  if (tipo) query = query.eq('tipo', tipo)

  const { data } = await query
  return data ?? []
}

export async function criarFeriado({ data, nome, tipo, msg_especifica = null }) {
  const { data: row, error } = await supabase
    .from('chatbot_feriados')
    .insert({ data, nome, tipo, msg_especifica })
    .select()
    .single()
  if (error) throw error
  return row
}

export async function atualizarFeriado(id, updates) {
  const { error } = await supabase
    .from('chatbot_feriados')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function excluirFeriado(id) {
  const { error } = await supabase
    .from('chatbot_feriados')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── SLA Config ───────────────────────────────────────────────

export async function buscarSLAConfig() {
  const { data, error } = await supabase
    .from('sla_config')
    .select('*')
    .order('departamento')
  if (error) throw error
  return data ?? []
}

export async function salvarSLAConfig(rows) {
  const { error } = await supabase
    .from('sla_config')
    .upsert(
      rows.map(r => ({ ...r, atualizado_em: new Date().toISOString() })),
      { onConflict: 'departamento' }
    )
  if (error) throw error
}

// ─── Classificação SLA Config ──────────────────────────────────

export async function buscarClassificacaoSLAConfig() {
  const { data, error } = await supabase
    .from('classificacao_sla_config')
    .select('*')
    .order('classificacao')
  if (error) throw error
  return data ?? []
}

export async function salvarClassificacaoSLAConfig(rows) {
  const { error } = await supabase
    .from('classificacao_sla_config')
    .upsert(rows, { onConflict: 'classificacao' })
  if (error) throw error
}

// ─── Mensagens Prontas ─────────────────────────────────────────

export async function buscarMensagensProntas() {
  const { data, error } = await supabase
    .from('mensagens_prontas')
    .select('*')
    .order('compartilhada', { ascending: false })
    .order('categoria', { nullsFirst: false })
    .order('titulo')
  if (error) throw error
  return data ?? []
}

export async function criarMensagemPronta({ titulo, conteudo, categoria, departamento, compartilhada }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('mensagens_prontas')
    .insert({ titulo, conteudo, categoria: categoria || null, departamento: departamento || null, compartilhada: !!compartilhada, criado_por: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarMensagemPronta(id, updates) {
  const { data, error } = await supabase
    .from('mensagens_prontas')
    .update({ titulo: updates.titulo, conteudo: updates.conteudo, categoria: updates.categoria || null, departamento: updates.departamento || null, compartilhada: !!updates.compartilhada })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function excluirMensagemPronta(id) {
  const { error } = await supabase.from('mensagens_prontas').delete().eq('id', id)
  if (error) throw error
}
