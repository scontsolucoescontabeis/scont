import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// =============================================================================
// Tipos e interfaces
// =============================================================================

export type BotEstado =
  | 'NOVO'
  | 'AGUARD_EMPRESA'
  | 'AGUARD_DEPT'
  | 'AGUARD_CAT'
  | 'AGUARD_SUB'
  | 'AGUARD_CONF'
  | 'AGUARD_AVAL'
  | 'CONCLUIDO'

export interface BotSessao {
  id: string
  conversa_id: string
  estado: BotEstado
  dept_selecionado: string | null
  categoria_id: string | null
  subcategoria_id: string | null
  empresa_selecionada: string | null
  cnpj_selecionado: string | null
  classificacao_empresa: string | null
  tentativas_invalidas: number
  ultimo_em: string
}

export interface ChatbotConfig {
  bot_ativo: boolean
  horario_inicio: string   // "08:00"
  horario_fim: string      // "18:00"
  dias_semana: number[]    // [1,2,3,4,5]
  timeout_minutos: number
  max_tentativas: number
  msg_boas_vindas: string
  msg_fora_horario: string
  msg_fila: string         // suporta {departamento}, {assunto}, {protocolo}
  msg_boas_vindas_bronze: string | null
  msg_boas_vindas_prata:  string | null
  msg_boas_vindas_ouro:   string | null
}

export interface DeptConfig {
  departamento: string
  ativo: boolean
  horario_inicio: string | null
  horario_fim: string | null
  msg_especifica: string | null
}

export interface MenuItem {
  id: string
  titulo: string
  departamento: string
}

export interface FeriadoEvento {
  nome: string
  tipo: 'FERIADO' | 'DATA_PICO'
  msg_especifica: string | null
}

export interface ProcessarBotParams {
  msg: Record<string, unknown>
  telefone: string
  nomeContato: string
  conversa: { id: string; protocolo: string; contato_id: string }
  supabase: SupabaseClient
  phoneNumberId: string
  accessToken: string
}

// =============================================================================
// Constantes
// =============================================================================

const DEPT_LABELS: Record<string, string> = {
  PESSOAL: 'Depto. Pessoal',
  CONTABIL: 'Contabilidade',
  TRIBUTARIO: 'Tributário / Fiscal',
  ADMINISTRATIVO: 'Administrativo',
}

const DEPT_EMOJIS: Record<string, string> = {
  PESSOAL: '👥',
  CONTABIL: '📊',
  TRIBUTARIO: '🧾',
  ADMINISTRATIVO: '🏢',
}

const DEPARTAMENTOS = ['PESSOAL', 'CONTABIL', 'TRIBUTARIO', 'ADMINISTRATIVO']

// =============================================================================
// Funções utilitárias exportadas (testáveis)
// =============================================================================

/**
 * Verifica se o horário atual está dentro do expediente.
 * O deptConfig, quando presente e com horário definido, sobrescreve o horário global.
 */
export function dentroDoHorario(
  config: ChatbotConfig,
  deptConfig: DeptConfig | null,
  agora?: Date,
): boolean {
  const now = agora ?? new Date()

  // Edge Functions rodam em UTC — converte para horário de Brasília antes de comparar
  const nowBRT = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))

  // Dia da semana: JS usa 0=domingo … 6=sábado; dias_semana usa 1=segunda … 7=domingo (ISO)
  const diaSemanaJS = nowBRT.getDay()
  const diaSemanaISO = diaSemanaJS === 0 ? 7 : diaSemanaJS
  if (!config.dias_semana.includes(diaSemanaISO)) return false

  const horaAtual = nowBRT.getHours() * 60 + nowBRT.getMinutes()

  // Usa horário do dept (se definido) ou cai de volta para o global
  const inicioStr =
    deptConfig?.horario_inicio ?? config.horario_inicio
  const fimStr =
    deptConfig?.horario_fim ?? config.horario_fim

  const [hI, mI] = inicioStr.split(':').map(Number)
  const [hF, mF] = fimStr.split(':').map(Number)
  const inicio = hI * 60 + mI
  const fim = hF * 60 + mF

  return horaAtual >= inicio && horaAtual < fim
}

/**
 * Extrai a escolha do cliente da mensagem WhatsApp.
 * Suporta: list_reply interativo, texto numérico, texto "0" / "atendente".
 */
export function resolverInputCliente(msg: Record<string, unknown>): {
  tipo: 'lista' | 'numero' | 'escape' | 'desconhecido'
  valor: string
} {
  // Mensagem interativa do tipo list_reply
  if (msg.type === 'interactive') {
    const interactive = msg.interactive as Record<string, unknown> | undefined
    if (interactive?.type === 'list_reply') {
      const reply = interactive.list_reply as Record<string, unknown>
      return { tipo: 'lista', valor: (reply?.id as string) ?? '' }
    }
    if (interactive?.type === 'button_reply') {
      const reply = interactive.button_reply as Record<string, unknown>
      return { tipo: 'lista', valor: (reply?.id as string) ?? '' }
    }
  }

  // Texto simples
  if (msg.type === 'text') {
    const body = ((msg.text as Record<string, unknown>)?.body as string ?? '').trim()
    const lower = body.toLowerCase()

    // Escape: "0", "atendente", "humano", "cancelar"
    if (lower === '0' || lower === 'atendente' || lower === 'humano' || lower === 'cancelar') {
      return { tipo: 'escape', valor: '' }
    }

    // Numérico
    if (/^\d+$/.test(body)) {
      return { tipo: 'numero', valor: body }
    }

    // Tenta também "SIM" / "NAO" como texto simples (usados em AGUARD_CONF)
    return { tipo: 'desconhecido', valor: body }
  }

  return { tipo: 'desconhecido', valor: '' }
}

// =============================================================================
// Utilitários internos
// =============================================================================

function sessaoExpirada(sessao: BotSessao, timeoutMinutos: number): boolean {
  return (Date.now() - new Date(sessao.ultimo_em).getTime()) / 60000 > timeoutMinutos
}

function resolverMsgFila(
  template: string,
  vars: { departamento: string; assunto: string; protocolo: string },
): string {
  return template
    .replace(/\{departamento\}/g, vars.departamento)
    .replace(/\{assunto\}/g, vars.assunto)
    .replace(/\{protocolo\}/g, vars.protocolo)
}

async function buscarEventoHoje(
  supabase: SupabaseClient,
  agora?: Date,
): Promise<FeriadoEvento | null> {
  const data = (agora ?? new Date()).toISOString().slice(0, 10) // YYYY-MM-DD
  const { data: row } = await supabase
    .from('chatbot_feriados')
    .select('nome, tipo, msg_especifica')
    .eq('data', data)
    .eq('ativo', true)
    .order('tipo') // FERIADO < DATA_PICO alfabeticamente — feriado tem prioridade
    .limit(1)
    .single()
  return row as FeriadoEvento | null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// =============================================================================
// Funções de envio WhatsApp
// =============================================================================

async function enviarTexto(
  telefone: string,
  corpo: string,
  phoneNumberId: string,
  accessToken: string,
): Promise<void> {
  await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefone,
      type: 'text',
      text: { body: corpo },
    }),
  })
}

async function enviarListaInterativa(
  telefone: string,
  corpo: string,
  botaoLabel: string,
  secaoTitulo: string,
  opcoes: Array<{ id: string; title: string; description?: string }>,
  phoneNumberId: string,
  accessToken: string,
): Promise<boolean> {
  // Máximo 10 rows por lista (limitação da Meta API)
  let rows = opcoes.slice(0, 10)
  if (opcoes.length > 10) {
    rows = opcoes.slice(0, 9)
    rows.push({ id: 'OUTROS', title: 'Outros' })
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: telefone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: corpo },
      action: {
        button: botaoLabel,
        sections: [
          {
            title: secaoTitulo,
            rows: rows.map((r) => ({
              id: r.id,
              title: r.title,
              ...(r.description ? { description: r.description } : {}),
            })),
          },
        ],
      },
    },
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    )
    const json = await res.json() as Record<string, unknown>
    if (!res.ok || json.error) {
      console.error('[chatbot] enviarListaInterativa erro:', JSON.stringify(json))
      return false
    }
    return true
  } catch (err) {
    console.error('[chatbot] enviarListaInterativa exception:', err)
    return false
  }
}

async function enviarMenuNumerado(
  telefone: string,
  titulo: string,
  opcoes: Array<{ id: string; title: string }>,
  phoneNumberId: string,
  accessToken: string,
): Promise<void> {
  const linhas = opcoes.map((o, i) => `${i + 1}. ${o.title}`)
  const corpo = `${titulo}\n\n${linhas.join('\n')}\n\n_Digite o número da opção_`
  await enviarTexto(telefone, corpo, phoneNumberId, accessToken)
}

/** Tenta lista interativa; se falhar, envia menu numerado em texto. */
async function enviarMenu(
  telefone: string,
  corpo: string,
  botaoLabel: string,
  secaoTitulo: string,
  opcoes: Array<{ id: string; title: string; description?: string }>,
  phoneNumberId: string,
  accessToken: string,
): Promise<void> {
  const ok = await enviarListaInterativa(
    telefone, corpo, botaoLabel, secaoTitulo, opcoes, phoneNumberId, accessToken,
  )
  if (!ok) {
    await enviarMenuNumerado(telefone, corpo, opcoes, phoneNumberId, accessToken)
  }
}

// =============================================================================
// Banco de dados auxiliares
// =============================================================================

async function atualizarSessao(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<BotSessao>,
): Promise<void> {
  await supabase
    .from('chatbot_sessoes')
    .update({ ...updates, ultimo_em: new Date().toISOString() })
    .eq('id', id)
}

async function inserirMensagemSistema(
  supabase: SupabaseClient,
  conversaId: string,
  texto: string,
): Promise<void> {
  await supabase.from('mensagens').insert({
    conversa_id: conversaId,
    conteudo: texto,
    tipo: 'text',
    origem: 'SISTEMA',
    lida: true,
  })
}

async function inserirMensagemBot(
  supabase: SupabaseClient,
  conversaId: string,
  texto: string,
): Promise<void> {
  await supabase.from('mensagens').insert({
    conversa_id: conversaId,
    conteudo: texto,
    tipo: 'text',
    origem: 'BOT',
    lida: true,
  })
}

async function aplicarTagsAutomaticas(
  supabase: SupabaseClient,
  conversaId: string,
  deptLabel: string,
  categoriaTitulo: string,
): Promise<void> {
  const tagNames = [
    deptLabel.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(),
    categoriaTitulo.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(),
  ].filter(Boolean)

  for (const nome of tagNames) {
    // Upsert da tag (cria se não existir)
    await supabase.from('tags').insert({ nome }).onConflict('nome').ignoreDuplicates()
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('nome', nome)
      .single()
    if (!tag?.id) continue

    // Associa à conversa
    await supabase
      .from('conversa_tags')
      .insert({ conversa_id: conversaId, tag_id: tag.id })
      .onConflict(['conversa_id', 'tag_id'])
      .ignoreDuplicates()
  }
}

// =============================================================================
// Escalar para humano
// =============================================================================

async function escalarParaHumano(
  supabase: SupabaseClient,
  sessao: BotSessao,
  conversaId: string,
  telefone: string,
  phoneNumberId: string,
  accessToken: string,
): Promise<void> {
  const msgHumano = 'Conectando você a um atendente humano 👤\nAguarde, em breve você será atendido.'
  await enviarTexto(telefone, msgHumano, phoneNumberId, accessToken)
  await inserirMensagemBot(supabase, conversaId, msgHumano)
  await inserirMensagemSistema(supabase, conversaId, '🤖 Cliente solicitou atendimento humano')
  await atualizarSessao(supabase, sessao.id, { estado: 'CONCLUIDO' })
}

// =============================================================================
// Menus de departamento / categoria / subcategoria
// =============================================================================

function montarOpcoesDepts(deptsAtivos?: Set<string>): Array<{ id: string; title: string }> {
  let depts = DEPARTAMENTOS
  if (deptsAtivos) {
    depts = DEPARTAMENTOS.filter((d) => deptsAtivos.has(d))
  }
  const opts = depts.map((d) => ({
    id: d,
    title: `${DEPT_EMOJIS[d] ?? ''} ${DEPT_LABELS[d] ?? d}`,
  }))
  opts.push({ id: 'HUMANO', title: '👤 Falar com atendente' })
  return opts
}

async function enviarMenuDepts(
  telefone: string,
  phoneNumberId: string,
  accessToken: string,
  supabase?: SupabaseClient,
  conversaId?: string,
): Promise<void> {
  let deptsAtivos: Set<string> | undefined
  if (supabase) {
    const { data: deptsConfig } = await supabase
      .from('chatbot_dept_config')
      .select('departamento, ativo')
    deptsAtivos = new Set(
      (deptsConfig ?? []).filter((d: Record<string, unknown>) => d.ativo).map((d: Record<string, unknown>) => d.departamento as string),
    )
  }
  const opcoes = montarOpcoesDepts(deptsAtivos)
  const corpoDepts = 'Olá! Selecione o departamento para o qual deseja falar:'
  await enviarMenu(
    telefone,
    corpoDepts,
    'Ver opções',
    'Departamentos',
    opcoes,
    phoneNumberId,
    accessToken,
  )
  if (supabase && conversaId) {
    const opcoesTexto = opcoes.map((o, i) => `${i + 1}. ${o.title}`).join('\n')
    await inserirMensagemBot(supabase, conversaId, `${corpoDepts}\n\n${opcoesTexto}`)
  }
}

async function enviarCategorias(
  supabase: SupabaseClient,
  telefone: string,
  dept: string,
  phoneNumberId: string,
  accessToken: string,
  conversaId?: string,
): Promise<MenuItem[]> {
  const { data: cats } = await supabase
    .from('chatbot_menus')
    .select('id, titulo, departamento')
    .eq('departamento', dept)
    .eq('nivel', 1)
    .eq('ativo', true)
    .order('ordem')

  const categorias: MenuItem[] = cats ?? []

  if (categorias.length === 0) {
    const msgSemCat = 'Não há categorias disponíveis para esse departamento. Aguarde um atendente.'
    await enviarTexto(telefone, msgSemCat, phoneNumberId, accessToken)
    if (conversaId) await inserirMensagemBot(supabase, conversaId, msgSemCat)
    return categorias
  }

  const opcoes = categorias.map((c, i) => ({
    id: c.id,
    title: `${i + 1}. ${c.titulo}`,
  }))
  opcoes.push({ id: 'HUMANO', title: '👤 Falar com atendente' })

  const deptLabel = DEPT_LABELS[dept] ?? dept
  const corpoCats = `*${DEPT_EMOJIS[dept] ?? ''} ${deptLabel}*\nSelecione o assunto:`
  await enviarMenu(
    telefone,
    corpoCats,
    'Ver assuntos',
    'Assuntos',
    opcoes,
    phoneNumberId,
    accessToken,
  )
  if (conversaId) {
    const opcoesTexto = opcoes.map(o => o.title).join('\n')
    await inserirMensagemBot(supabase, conversaId, `${corpoCats}\n\n${opcoesTexto}`)
  }

  return categorias
}

async function enviarSubCategorias(
  supabase: SupabaseClient,
  telefone: string,
  categoriaId: string,
  phoneNumberId: string,
  accessToken: string,
  conversaId?: string,
): Promise<MenuItem[]> {
  const { data: subs } = await supabase
    .from('chatbot_menus')
    .select('id, titulo, departamento')
    .eq('parent_id', categoriaId)
    .eq('nivel', 2)
    .eq('ativo', true)
    .order('ordem')

  const subcats: MenuItem[] = subs ?? []

  if (subcats.length === 0) {
    // Categoria sem subcategorias — vai direto para confirmação
    return subcats
  }

  const opcoes = subcats.map((s, i) => ({
    id: s.id,
    title: `${i + 1}. ${s.titulo}`,
  }))
  opcoes.push({ id: 'HUMANO', title: '👤 Falar com atendente' })

  const corpoSub = 'Selecione o sub-assunto:'
  await enviarMenu(
    telefone,
    corpoSub,
    'Ver sub-assuntos',
    'Sub-assuntos',
    opcoes,
    phoneNumberId,
    accessToken,
  )
  if (conversaId) {
    const opcoesTexto = opcoes.map(o => o.title).join('\n')
    await inserirMensagemBot(supabase, conversaId, `${corpoSub}\n\n${opcoesTexto}`)
  }

  return subcats
}

async function enviarConfirmacao(
  supabase: SupabaseClient,
  telefone: string,
  sessao: BotSessao,
  phoneNumberId: string,
  accessToken: string,
  conversaId?: string,
): Promise<void> {
  const deptLabel = DEPT_LABELS[sessao.dept_selecionado ?? ''] ?? sessao.dept_selecionado ?? ''

  let catTitulo = ''
  let subTitulo = ''

  if (sessao.categoria_id) {
    const { data: cat } = await supabase
      .from('chatbot_menus')
      .select('titulo')
      .eq('id', sessao.categoria_id)
      .single()
    catTitulo = cat?.titulo ?? ''
  }

  if (sessao.subcategoria_id) {
    const { data: sub } = await supabase
      .from('chatbot_menus')
      .select('titulo')
      .eq('id', sessao.subcategoria_id)
      .single()
    subTitulo = sub?.titulo ?? ''
  }

  const resumo = subTitulo
    ? `${deptLabel} › ${catTitulo} › ${subTitulo}`
    : `${deptLabel} › ${catTitulo}`

  const corpoConf = `Confirma o encaminhamento?\n\n*${resumo}*`
  const opcoesConf = [
    { id: 'CONFIRMAR', title: '✅ Sim, confirmar' },
    { id: 'CORRIGIR', title: '🔄 Não, corrigir' },
  ]
  await enviarMenu(
    telefone,
    corpoConf,
    'Responder',
    'Confirmação',
    opcoesConf,
    phoneNumberId,
    accessToken,
  )
  if (conversaId) {
    const opcoesTexto = opcoesConf.map((o, i) => `${i + 1}. ${o.title}`).join('\n')
    await inserirMensagemBot(supabase, conversaId, `${corpoConf}\n\n${opcoesTexto}`)
  }
}

// =============================================================================
// Helpers de tier / boas-vindas
// =============================================================================

const TIER_ORDEM: Record<string, number> = { OURO: 3, PRATA: 2, BRONZE: 1 }

function resolverMensagemBoasVindas(
  config: ChatbotConfig,
  empresas: Array<{ classificacao?: string | null }>,
  nome: string,
  tierOverride?: string | null,
): string {
  const tier = tierOverride !== undefined
    ? tierOverride
    : empresas.reduce<string | null>((melhor, e) => {
        if (!e.classificacao) return melhor
        if (!melhor) return e.classificacao
        return (TIER_ORDEM[e.classificacao] ?? 0) > (TIER_ORDEM[melhor] ?? 0)
          ? e.classificacao
          : melhor
      }, null)

  const msgBase =
    tier === 'OURO'   && config.msg_boas_vindas_ouro   ? config.msg_boas_vindas_ouro   :
    tier === 'PRATA'  && config.msg_boas_vindas_prata  ? config.msg_boas_vindas_prata  :
    tier === 'BRONZE' && config.msg_boas_vindas_bronze ? config.msg_boas_vindas_bronze :
    config.msg_boas_vindas

  const tierLabel = tier
    ? tier.charAt(0) + tier.slice(1).toLowerCase()
    : ''

  return msgBase
    .replace(/\{nome\}/g, nome)
    .replace(/\{tier\}/g, tierLabel)
}

// =============================================================================
// Handlers por estado
// =============================================================================

async function handleNOVO(
  sessao: BotSessao,
  params: ProcessarBotParams,
  config: ChatbotConfig,
  feriadoHoje: FeriadoEvento | null,
): Promise<void> {
  const { supabase, telefone, nomeContato, conversa, phoneNumberId, accessToken } = params

  // Verifica feriado antes de verificar horário
  if (feriadoHoje?.tipo === 'FERIADO') {
    const msg = feriadoHoje.msg_especifica
      ?? `Não haverá atendimento hoje (${feriadoHoje.nome}). Seu contato foi registrado com protocolo *${conversa.protocolo}* e retornaremos no próximo dia útil. 📅`
    await enviarTexto(telefone, msg, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, msg)
    await inserirMensagemSistema(supabase, conversa.id, `🤖 Cliente contatou em feriado: ${feriadoHoje.nome}`)
    await atualizarSessao(supabase, sessao.id, { estado: 'CONCLUIDO' })
    return
  }

  // Verifica horário (sem dept específico ainda)
  if (!dentroDoHorario(config, null)) {
    await enviarTexto(telefone, config.msg_fora_horario, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, config.msg_fora_horario)
    await inserirMensagemSistema(supabase, conversa.id, '🤖 Cliente contatou fora do horário de atendimento')
    await atualizarSessao(supabase, sessao.id, { estado: 'CONCLUIDO' })
    return
  }

  // Verifica empresas vinculadas ao contato
  const { data: empData } = await supabase
    .from('contatos_empresas')
    .select('id, empresa, cnpj, classificacao')
    .eq('contato_id', conversa.contato_id)
    .order('criado_em', { ascending: true })

  const empresas = (empData ?? []) as Array<{ id: string; empresa: string; cnpj: string | null; classificacao: string | null }>

  if (empresas.length > 0) {
    // Busca histórico recorrente para combinar com a lista de empresas
    const { data: rec } = await supabase
      .from('conversas')
      .select('bot_departamento, bot_categoria, bot_categoria_id')
      .eq('contato_id', conversa.contato_id)
      .eq('status', 'ENCERRADA')
      .not('bot_departamento', 'is', null)
      .gt('encerrado_em', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('encerrado_em', { ascending: false })
      .limit(1)
      .single()

    const opcoes: Array<{ id: string; title: string; description?: string }> = []

    // Opção combinada recorrente no topo — se houver histórico recente
    if (rec?.bot_departamento) {
      const primeiraEmp = empresas[0]
      const catAnterior = rec.bot_categoria ?? 'assunto anterior'
      const catIdAnterior = (rec.bot_categoria_id as string | null) ?? ''
      opcoes.push({
        id: `EMPRESA_REC:${primeiraEmp.id}:${catIdAnterior}`,
        title: `🔄 ${primeiraEmp.empresa} — mesmo assunto`,
        description: catAnterior,
      })
    }

    // Uma opção por empresa
    for (const emp of empresas) {
      opcoes.push({
        id: `EMPRESA:${emp.id}`,
        title: `🏢 ${emp.empresa}`,
        description: emp.cnpj ? `CNPJ: ${emp.cnpj}` : undefined,
      })
    }

    // Sempre ao final
    opcoes.push({ id: 'OUTRO_ASSUNTO', title: '💬 Falar de outro assunto' })
    opcoes.push({ id: 'HUMANO', title: '👤 Falar com atendente' })

    await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_EMPRESA' })

    const saudacao = resolverMensagemBoasVindas(config, empresas, nomeContato)
    await enviarMenu(telefone, saudacao, 'Ver opções', 'Empresas', opcoes, phoneNumberId, accessToken)
    const opcoesTexto = opcoes
      .map((o, i) => `${i + 1}. ${o.title}${o.description ? ` — ${o.description}` : ''}`)
      .join('\n')
    await inserirMensagemBot(supabase, conversa.id, `${saudacao}\n\n${opcoesTexto}`)
    return
  }

  // Verifica cliente recorrente (conversa encerrada nos últimos 30 dias com bot_departamento preenchido)
  const { data: recorrente } = await supabase
    .from('conversas')
    .select('bot_departamento, bot_categoria, bot_categoria_id')
    .eq('contato_id', conversa.contato_id)
    .eq('status', 'ENCERRADA')
    .not('bot_departamento', 'is', null)
    .gt('encerrado_em', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('encerrado_em', { ascending: false })
    .limit(1)
    .single()

  if (recorrente?.bot_departamento) {
    const deptAnterior = recorrente.bot_departamento
    const catAnterior = recorrente.bot_categoria ?? 'assunto anterior'
    const catIdAnterior = recorrente.bot_categoria_id

    // Guarda dept e categoria anteriores na sessão para uso futuro
    await atualizarSessao(supabase, sessao.id, {
      estado: 'AGUARD_DEPT',
      dept_selecionado: deptAnterior,
      categoria_id: catIdAnterior ?? null,
    })

    const msgRecorrente = `Olá! Notei que você já nos contactou sobre *${catAnterior}* (${deptAnterior}).\nDeseja o mesmo assunto?`
    const opcoesRec = [
      { id: `RECORRENTE:${deptAnterior}:${catIdAnterior ?? ''}`, title: '✅ Sim, mesmo assunto' },
      { id: 'NOVO_ASSUNTO', title: '🔄 Não, novo assunto' },
      { id: 'HUMANO', title: '👤 Falar com atendente' },
    ]
    await enviarMenu(
      telefone,
      msgRecorrente,
      'Responder',
      'Opções',
      opcoesRec,
      phoneNumberId,
      accessToken,
    )
    await inserirMensagemBot(
      supabase,
      conversa.id,
      `${msgRecorrente}\n\n${opcoesRec.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}`,
    )
  } else {
    // Novo cliente
    await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_DEPT' })

    const msgBV = resolverMensagemBoasVindas(config, [], nomeContato)
    await enviarTexto(telefone, msgBV, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, msgBV)
    await enviarMenuDepts(telefone, phoneNumberId, accessToken, supabase, conversa.id)
  }
}

async function handleAGUARD_EMPRESA(
  sessao: BotSessao,
  params: ProcessarBotParams,
  config: ChatbotConfig,
  input: ReturnType<typeof resolverInputCliente>,
): Promise<void> {
  const { supabase, telefone, conversa, phoneNumberId, accessToken } = params

  // Resolve número digitado → ID da opção (mesmo quando lista interativa falha)
  if (input.tipo === 'numero') {
    const idx = parseInt(input.valor, 10) - 1
    const { data: emps0 } = await supabase
      .from('contatos_empresas')
      .select('id')
      .eq('contato_id', conversa.contato_id)
      .order('criado_em', { ascending: true })
    const empresasIds = (emps0 ?? []) as Array<{ id: string }>

    const { data: rec0 } = await supabase
      .from('conversas')
      .select('bot_departamento, bot_categoria_id')
      .eq('contato_id', conversa.contato_id)
      .eq('status', 'ENCERRADA')
      .not('bot_departamento', 'is', null)
      .gt('encerrado_em', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('encerrado_em', { ascending: false })
      .limit(1)
      .single()

    const idsOrdem: string[] = []
    if (rec0?.bot_departamento && empresasIds.length > 0) {
      const catId0 = (rec0.bot_categoria_id as string | null) ?? ''
      idsOrdem.push(`EMPRESA_REC:${empresasIds[0].id}:${catId0}`)
    }
    for (const e of empresasIds) {
      idsOrdem.push(`EMPRESA:${e.id}`)
    }
    idsOrdem.push('OUTRO_ASSUNTO')
    idsOrdem.push('HUMANO')

    if (idx >= 0 && idx < idsOrdem.length) {
      input = { tipo: 'lista', valor: idsOrdem[idx] }
    } else {
      await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
      return
    }
  }

  if (input.valor === 'HUMANO') {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
    return
  }

  // EMPRESA_REC:{ce_id}:{cat_id} — empresa + recorrente combinados
  if (input.valor.startsWith('EMPRESA_REC:')) {
    const partes = input.valor.split(':')
    const ceId = partes[1] ?? ''
    const catId = partes[2] && partes[2].length > 0 ? partes[2] : null

    if (!isUuid(ceId)) {
      await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
      return
    }

    const { data: ce } = await supabase
      .from('contatos_empresas')
      .select('empresa, cnpj, classificacao')
      .eq('id', ceId)
      .single()

    const empresa       = (ce?.empresa       as string | undefined) || null
    const cnpj          = (ce?.cnpj          as string | null | undefined) ?? null
    const classificacao = (ce?.classificacao as string | null | undefined) ?? null

    // Re-consulta recorrente para recuperar dept (label) — consistente com padrão existente
    const { data: rec } = await supabase
      .from('conversas')
      .select('bot_departamento, bot_categoria_id')
      .eq('contato_id', conversa.contato_id)
      .eq('status', 'ENCERRADA')
      .not('bot_departamento', 'is', null)
      .order('encerrado_em', { ascending: false })
      .limit(1)
      .single()

    const deptAnterior = (rec?.bot_departamento as string | undefined) || null

    await atualizarSessao(supabase, sessao.id, {
      empresa_selecionada:  empresa,
      cnpj_selecionado:     cnpj,
      classificacao_empresa: classificacao,
      dept_selecionado:     deptAnterior,
      categoria_id:         catId,
      tentativas_invalidas: 0,
    })

    if (empresa) {
      await supabase
        .from('conversas')
        .update({ bot_empresa: empresa, bot_cnpj: cnpj, classificacao_empresa: classificacao })
        .eq('id', conversa.id)
    }

    if (catId) {
      const subs = await enviarSubCategorias(
        supabase, telefone, catId, phoneNumberId, accessToken, conversa.id,
      )
      if (subs.length === 0) {
        await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_CONF', subcategoria_id: null })
        await enviarConfirmacao(
          supabase,
          telefone,
          { ...sessao, empresa_selecionada: empresa || null, cnpj_selecionado: cnpj, dept_selecionado: deptAnterior, categoria_id: catId, estado: 'AGUARD_CONF', subcategoria_id: null },
          phoneNumberId,
          accessToken,
          conversa.id,
        )
      } else {
        await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_SUB' })
      }
    } else {
      // Sem categoria prévia — envia menu de departamentos
      await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_DEPT', dept_selecionado: null, categoria_id: null })
      await enviarMenuDepts(telefone, phoneNumberId, accessToken, supabase, conversa.id)
    }
    return
  }

  // EMPRESA:{ce_id} — empresa selecionada, novo assunto
  if (input.valor.startsWith('EMPRESA:')) {
    const ceId = input.valor.split(':')[1] ?? ''

    if (!isUuid(ceId)) {
      await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
      return
    }

    const { data: ce } = await supabase
      .from('contatos_empresas')
      .select('empresa, cnpj, classificacao')
      .eq('id', ceId)
      .single()

    const empresa       = (ce?.empresa       as string | undefined) || null
    const cnpj          = (ce?.cnpj          as string | null | undefined) ?? null
    const classificacao = (ce?.classificacao as string | null | undefined) ?? null

    await atualizarSessao(supabase, sessao.id, {
      estado:               'AGUARD_DEPT',
      empresa_selecionada:  empresa,
      cnpj_selecionado:     cnpj,
      classificacao_empresa: classificacao,
      tentativas_invalidas: 0,
    })

    if (empresa) {
      await supabase
        .from('conversas')
        .update({ bot_empresa: empresa, bot_cnpj: cnpj, classificacao_empresa: classificacao })
        .eq('id', conversa.id)
    }

    await enviarMenuDepts(telefone, phoneNumberId, accessToken, supabase, conversa.id)
    return
  }

  // OUTRO_ASSUNTO — sem contexto de empresa, fluxo normal
  if (input.valor === 'OUTRO_ASSUNTO') {
    await atualizarSessao(supabase, sessao.id, {
      estado: 'AGUARD_DEPT',
      empresa_selecionada: null,
      cnpj_selecionado: null,
      tentativas_invalidas: 0,
    })
    await enviarTexto(telefone, config.msg_boas_vindas, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, config.msg_boas_vindas)
    await enviarMenuDepts(telefone, phoneNumberId, accessToken, supabase, conversa.id)
    return
  }

  // Input inválido — reexibe lista simplificada (sem opção recorrente)
  const { data: empData } = await supabase
    .from('contatos_empresas')
    .select('id, empresa, cnpj, classificacao')
    .eq('contato_id', conversa.contato_id)
    .order('criado_em', { ascending: true })

  const empresas = (empData ?? []) as Array<{ id: string; empresa: string; cnpj: string | null; classificacao: string | null }>
  const novasTentativas = sessao.tentativas_invalidas + 1

  if (novasTentativas >= config.max_tentativas) {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
    return
  }

  await atualizarSessao(supabase, sessao.id, { tentativas_invalidas: novasTentativas })

  const opcoes = [
    ...empresas.map(emp => ({
      id: `EMPRESA:${emp.id}`,
      title: `🏢 ${emp.empresa}`,
      description: emp.cnpj ? `CNPJ: ${emp.cnpj}` : undefined,
    })),
    { id: 'OUTRO_ASSUNTO', title: '💬 Falar de outro assunto' },
  ]

  const msgInvalida = `Opção inválida. Escolha uma das empresas (tentativa ${novasTentativas}/${config.max_tentativas}).`
  await enviarMenu(telefone, msgInvalida, 'Ver opções', 'Empresas', opcoes, phoneNumberId, accessToken)
  await inserirMensagemBot(
    supabase,
    conversa.id,
    `${msgInvalida}\n\n${opcoes.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}`,
  )
}

async function handleAGUARD_DEPT(
  sessao: BotSessao,
  params: ProcessarBotParams,
  config: ChatbotConfig,
  input: ReturnType<typeof resolverInputCliente>,
): Promise<void> {
  const { supabase, telefone, conversa, phoneNumberId, accessToken } = params

  if (input.valor === 'HUMANO') {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
    return
  }

  // Opção recorrente: RECORRENTE:{dept}:{cat_id}
  if (input.valor.startsWith('RECORRENTE:')) {
    const partes = input.valor.split(':')
    const dept = partes[1] ?? ''
    const catId = partes[2] && partes[2].length > 0 ? partes[2] : null

    await atualizarSessao(supabase, sessao.id, {
      estado: 'AGUARD_SUB',
      dept_selecionado: dept,
      categoria_id: catId,
      tentativas_invalidas: 0,
    })

    if (catId) {
      const subs = await enviarSubCategorias(supabase, telefone, catId, phoneNumberId, accessToken, conversa.id)
      // Se não há subcategorias, vai direto para confirmação
      if (subs.length === 0) {
        await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_CONF' })
        await enviarConfirmacao(supabase, telefone, { ...sessao, dept_selecionado: dept, categoria_id: catId, estado: 'AGUARD_CONF', subcategoria_id: null }, phoneNumberId, accessToken, conversa.id)
      }
    } else {
      // Sem categoria prévia — envia categorias do dept
      await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_CAT', dept_selecionado: dept, categoria_id: null })
      await enviarCategorias(supabase, telefone, dept, phoneNumberId, accessToken, conversa.id)
    }
    return
  }

  // Cliente escolheu novo assunto (estava no fluxo recorrente)
  if (input.valor === 'NOVO_ASSUNTO') {
    await atualizarSessao(supabase, sessao.id, {
      dept_selecionado: null,
      categoria_id: null,
      tentativas_invalidas: 0,
    })
    await enviarMenuDepts(telefone, phoneNumberId, accessToken, supabase, conversa.id)
    return
  }

  // Departamento direto (ID do departamento)
  let dept: string | null = null
  if (DEPARTAMENTOS.includes(input.valor)) {
    dept = input.valor
  } else if (input.tipo === 'numero') {
    const idx = parseInt(input.valor, 10) - 1
    if (idx >= 0 && idx < DEPARTAMENTOS.length) {
      dept = DEPARTAMENTOS[idx] ?? null
    } else {
      // Número além dos departamentos → última opção é sempre HUMANO
      await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
      return
    }
  }

  if (dept) {
    await atualizarSessao(supabase, sessao.id, {
      estado: 'AGUARD_CAT',
      dept_selecionado: dept,
      categoria_id: null,
      tentativas_invalidas: 0,
    })
    await enviarCategorias(supabase, telefone, dept, phoneNumberId, accessToken, conversa.id)
    return
  }

  // Input inválido
  const novasTentativas = sessao.tentativas_invalidas + 1
  if (novasTentativas >= config.max_tentativas) {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
  } else {
    await atualizarSessao(supabase, sessao.id, { tentativas_invalidas: novasTentativas })
    const msgInvalida = `Opção inválida. Por favor, escolha um número do menu (tentativa ${novasTentativas}/${config.max_tentativas}).`
    await enviarTexto(telefone, msgInvalida, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, msgInvalida)
    await enviarMenuDepts(telefone, phoneNumberId, accessToken, supabase, conversa.id)
  }
}

async function handleAGUARD_CAT(
  sessao: BotSessao,
  params: ProcessarBotParams,
  config: ChatbotConfig,
  input: ReturnType<typeof resolverInputCliente>,
): Promise<void> {
  const { supabase, telefone, conversa, phoneNumberId, accessToken } = params

  if (input.valor === 'HUMANO') {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
    return
  }

  const dept = sessao.dept_selecionado ?? ''

  // Carrega categorias para validar o input
  const { data: cats } = await supabase
    .from('chatbot_menus')
    .select('id, titulo, departamento')
    .eq('departamento', dept)
    .eq('nivel', 1)
    .eq('ativo', true)
    .order('ordem')

  const categorias: MenuItem[] = cats ?? []

  let catEscolhida: MenuItem | null = null

  if (input.tipo === 'lista' && isUuid(input.valor)) {
    catEscolhida = categorias.find((c) => c.id === input.valor) ?? null
  } else if (input.tipo === 'numero') {
    const idx = parseInt(input.valor, 10) - 1
    if (idx >= 0 && idx < categorias.length) {
      catEscolhida = categorias[idx] ?? null
    } else {
      // Número além das categorias → última opção é sempre HUMANO
      await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
      return
    }
  } else if (input.tipo === 'desconhecido' && isUuid(input.valor)) {
    catEscolhida = categorias.find((c) => c.id === input.valor) ?? null
  }

  if (catEscolhida) {
    await atualizarSessao(supabase, sessao.id, {
      estado: 'AGUARD_SUB',
      categoria_id: catEscolhida.id,
      tentativas_invalidas: 0,
    })

    const subs = await enviarSubCategorias(supabase, telefone, catEscolhida.id, phoneNumberId, accessToken, conversa.id)

    // Se não há subcategorias, pula direto para confirmação
    if (subs.length === 0) {
      await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_CONF', subcategoria_id: null })
      await enviarConfirmacao(
        supabase,
        telefone,
        { ...sessao, categoria_id: catEscolhida.id, estado: 'AGUARD_CONF', subcategoria_id: null },
        phoneNumberId,
        accessToken,
        conversa.id,
      )
    }
    return
  }

  // Input inválido
  const novasTentativas = sessao.tentativas_invalidas + 1
  if (novasTentativas >= config.max_tentativas) {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
  } else {
    await atualizarSessao(supabase, sessao.id, { tentativas_invalidas: novasTentativas })
    const msgInvCat = `Opção inválida. Escolha um número do menu (tentativa ${novasTentativas}/${config.max_tentativas}).`
    await enviarTexto(telefone, msgInvCat, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, msgInvCat)
    await enviarCategorias(supabase, telefone, dept, phoneNumberId, accessToken, conversa.id)
  }
}

async function handleAGUARD_SUB(
  sessao: BotSessao,
  params: ProcessarBotParams,
  config: ChatbotConfig,
  input: ReturnType<typeof resolverInputCliente>,
): Promise<void> {
  const { supabase, telefone, conversa, phoneNumberId, accessToken } = params

  if (input.valor === 'HUMANO') {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
    return
  }

  const catId = sessao.categoria_id ?? ''

  // Carrega subcategorias para validar o input
  const { data: subs } = await supabase
    .from('chatbot_menus')
    .select('id, titulo, departamento')
    .eq('parent_id', catId)
    .eq('nivel', 2)
    .eq('ativo', true)
    .order('ordem')

  const subcats: MenuItem[] = subs ?? []

  let subEscolhida: MenuItem | null = null

  if (input.tipo === 'lista' && isUuid(input.valor)) {
    subEscolhida = subcats.find((s) => s.id === input.valor) ?? null
  } else if (input.tipo === 'numero') {
    const idx = parseInt(input.valor, 10) - 1
    if (idx >= 0 && idx < subcats.length) {
      subEscolhida = subcats[idx] ?? null
    } else {
      // Número além das subcategorias → última opção é sempre HUMANO
      await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
      return
    }
  } else if (input.tipo === 'desconhecido' && isUuid(input.valor)) {
    subEscolhida = subcats.find((s) => s.id === input.valor) ?? null
  }

  if (subEscolhida) {
    await atualizarSessao(supabase, sessao.id, {
      estado: 'AGUARD_CONF',
      subcategoria_id: subEscolhida.id,
      tentativas_invalidas: 0,
    })
    await enviarConfirmacao(
      supabase,
      telefone,
      { ...sessao, subcategoria_id: subEscolhida.id, estado: 'AGUARD_CONF' },
      phoneNumberId,
      accessToken,
      conversa.id,
    )
    return
  }

  // Input inválido
  const novasTentativas = sessao.tentativas_invalidas + 1
  if (novasTentativas >= config.max_tentativas) {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
  } else {
    await atualizarSessao(supabase, sessao.id, { tentativas_invalidas: novasTentativas })
    const msgInvSub = `Opção inválida. Escolha um número do menu (tentativa ${novasTentativas}/${config.max_tentativas}).`
    await enviarTexto(telefone, msgInvSub, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, msgInvSub)
    await enviarSubCategorias(supabase, telefone, catId, phoneNumberId, accessToken, conversa.id)
  }
}

async function handleAGUARD_CONF(
  sessao: BotSessao,
  params: ProcessarBotParams,
  config: ChatbotConfig,
  input: ReturnType<typeof resolverInputCliente>,
  feriadoHoje: FeriadoEvento | null,
): Promise<void> {
  const { supabase, telefone, conversa, phoneNumberId, accessToken } = params

  const valor = input.valor.toUpperCase()
  const confirmou =
    valor === 'CONFIRMAR' ||
    valor === 'SIM' ||
    valor === '1' ||
    input.valor === '1'

  const corrigiu =
    valor === 'CORRIGIR' ||
    valor === 'NAO' ||
    valor === 'NÃO' ||
    input.valor === '0'

  if (corrigiu) {
    // Reinicia seleção
    await atualizarSessao(supabase, sessao.id, {
      estado: 'AGUARD_DEPT',
      dept_selecionado: null,
      categoria_id: null,
      subcategoria_id: null,
      tentativas_invalidas: 0,
    })
    await enviarMenuDepts(telefone, phoneNumberId, accessToken, supabase, conversa.id)
    return
  }

  if (confirmou) {
    const dept = sessao.dept_selecionado ?? ''
    const deptLabel = DEPT_LABELS[dept] ?? dept

    // Busca títulos para montar mensagens
    let catTitulo = ''
    let subTitulo = ''

    if (sessao.categoria_id) {
      const { data: cat } = await supabase
        .from('chatbot_menus')
        .select('titulo')
        .eq('id', sessao.categoria_id)
        .single()
      catTitulo = cat?.titulo ?? ''
    }

    if (sessao.subcategoria_id) {
      const { data: sub } = await supabase
        .from('chatbot_menus')
        .select('titulo')
        .eq('id', sessao.subcategoria_id)
        .single()
      subTitulo = sub?.titulo ?? ''
    }

    const assunto = subTitulo
      ? `${catTitulo} › ${subTitulo}`
      : catTitulo

    // 1. Atualiza a conversa com departamento e dados do bot
    await supabase
      .from('conversas')
      .update({
        departamento: dept,
        bot_departamento: deptLabel,
        bot_categoria: catTitulo,
        bot_subcategoria: subTitulo || null,
        bot_categoria_id: sessao.categoria_id,
      })
      .eq('id', conversa.id)

    // 2. Envia mensagem de fila (com aviso de data-pico quando aplicável)
    let msgFila = resolverMsgFila(config.msg_fila, {
      departamento: deptLabel,
      assunto,
      protocolo: conversa.protocolo,
    })
    if (feriadoHoje?.tipo === 'DATA_PICO') {
      const aviso = feriadoHoje.msg_especifica
        ?? `⚠️ Estamos em *${feriadoHoje.nome}*. O prazo de resposta pode ser superior ao habitual.`
      msgFila = `${msgFila}\n\n${aviso}`
    }
    await enviarTexto(telefone, msgFila, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, msgFila)

    // 3. Insere mensagem SISTEMA de roteamento
    const resumo = subTitulo
      ? `${deptLabel} › ${catTitulo} › ${subTitulo}`
      : `${deptLabel} › ${catTitulo}`
    const prefixoEmpresa = sessao.empresa_selecionada ? `${sessao.empresa_selecionada} — ` : ''
    await inserirMensagemSistema(supabase, conversa.id, `🤖 Bot roteou: ${prefixoEmpresa}${resumo}`)

    // 4. Aplica tags automáticas
    await aplicarTagsAutomaticas(supabase, conversa.id, deptLabel, catTitulo)

    // 5. Atualiza sessão para CONCLUIDO
    await atualizarSessao(supabase, sessao.id, { estado: 'CONCLUIDO' })
    return
  }

  // Input inválido
  const novasTentativas = sessao.tentativas_invalidas + 1
  if (novasTentativas >= config.max_tentativas) {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
  } else {
    await atualizarSessao(supabase, sessao.id, { tentativas_invalidas: novasTentativas })
    const msgConf = `Por favor, confirme com *Sim* ou *Não* (tentativa ${novasTentativas}/${config.max_tentativas}).`
    await enviarTexto(telefone, msgConf, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, msgConf)
    await enviarConfirmacao(supabase, telefone, sessao, phoneNumberId, accessToken, conversa.id)
  }
}

async function processarCSAT(
  sessao: BotSessao,
  params: ProcessarBotParams,
  input: ReturnType<typeof resolverInputCliente>,
): Promise<void> {
  const { supabase, telefone, conversa, phoneNumberId, accessToken } = params

  const notaStr = input.tipo === 'lista' ? input.valor : input.tipo === 'numero' ? input.valor : ''
  const nota = parseInt(notaStr, 10)

  if (nota >= 1 && nota <= 5) {
    await supabase
      .from('chatbot_avaliacoes')
      .insert({ conversa_id: conversa.id, nota })

    const msgFeedback = 'Obrigado pelo feedback! 🙏 Até a próxima.'
    await enviarTexto(telefone, msgFeedback, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, msgFeedback)
    await atualizarSessao(supabase, sessao.id, { estado: 'CONCLUIDO' })
    return
  }

  // Input inválido na avaliação — tenta apenas 1 vez, depois encerra silenciosamente
  if (sessao.tentativas_invalidas >= 1) {
    await atualizarSessao(supabase, sessao.id, { estado: 'CONCLUIDO' })
    return
  }

  await atualizarSessao(supabase, sessao.id, { tentativas_invalidas: sessao.tentativas_invalidas + 1 })

  const opcoesCSAT = [
    { id: '5', title: '⭐⭐⭐⭐⭐ Excelente' },
    { id: '4', title: '⭐⭐⭐⭐ Bom' },
    { id: '3', title: '⭐⭐⭐ Regular' },
    { id: '2', title: '⭐⭐ Ruim' },
    { id: '1', title: '⭐ Péssimo' },
  ]
  await enviarMenu(
    telefone,
    'Por favor, avalie nosso atendimento de 1 a 5:',
    'Avaliar',
    'Avaliação',
    opcoesCSAT,
    phoneNumberId,
    accessToken,
  )
  await inserirMensagemBot(
    supabase,
    conversa.id,
    `Por favor, avalie nosso atendimento de 1 a 5:\n\n${opcoesCSAT.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}`,
  )
}

// =============================================================================
// Função principal exportada
// =============================================================================

/**
 * Entry point chamado pelo whatsapp-webhook para cada mensagem.
 * Retorna true se o bot tratou a mensagem (não deve ser salva como mensagem normal do cliente).
 * Retorna false se o bot está inativo ou a sessão já está CONCLUIDA.
 */
export async function processarMensagemBot(params: ProcessarBotParams): Promise<boolean> {
  const { msg, telefone, conversa, supabase, phoneNumberId, accessToken } = params

  // 1. Carrega configuração global do chatbot
  const { data: configRaw } = await supabase
    .from('chatbot_config')
    .select('*')
    .eq('id', 1)
    .single()

  const config = configRaw as ChatbotConfig | null

  // 2. Bot inativo → não interferir
  if (!config || !config.bot_ativo) return false

  // 2b. Busca evento do dia (feriado ou data-pico) — uma query, zero IA
  const feriadoHoje = await buscarEventoHoje(supabase)

  // 3. Extrai input do cliente
  const input = resolverInputCliente(msg)

  // 4. Busca sessão existente
  const { data: sessaoRaw } = await supabase
    .from('chatbot_sessoes')
    .select('*')
    .eq('conversa_id', conversa.id)
    .single()

  let sessao = sessaoRaw as BotSessao | null

  // 5. Sessão CONCLUIDA → bot não interfere (agente humano atende)
  if (sessao && sessao.estado === 'CONCLUIDO') return false

  // 6. Sessão AGUARD_AVAL → processa avaliação CSAT
  if (sessao && sessao.estado === 'AGUARD_AVAL') {
    await processarCSAT(sessao, params, input)
    return true
  }

  // 7. Sessão não existe → cria nova em estado NOVO
  if (!sessao) {
    const { data: nova } = await supabase
      .from('chatbot_sessoes')
      .insert({
        conversa_id: conversa.id,
        estado: 'NOVO',
        tentativas_invalidas: 0,
      })
      .select()
      .single()

    sessao = nova as BotSessao
    if (!sessao) {
      console.error('[chatbot] Falha ao criar sessão para conversa', conversa.id)
      return false
    }
  }

  // 8. Sessão expirada por inatividade
  if (sessaoExpirada(sessao, config.timeout_minutos)) {
    const msgExpirada = 'Sua sessão expirou por inatividade. Se precisar de ajuda, envie uma nova mensagem.'
    await enviarTexto(telefone, msgExpirada, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, msgExpirada)
    await atualizarSessao(supabase, sessao.id, { estado: 'CONCLUIDO' })
    return true
  }

  // 9. Escape → escalona para humano
  if (input.tipo === 'escape') {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
    return true
  }

  // 10. Roteamento para o handler do estado atual
  switch (sessao.estado) {
    case 'NOVO':
      await handleNOVO(sessao, params, config, feriadoHoje)
      break

    case 'AGUARD_EMPRESA':
      await handleAGUARD_EMPRESA(sessao, params, config, input)
      break

    case 'AGUARD_DEPT':
      await handleAGUARD_DEPT(sessao, params, config, input)
      break

    case 'AGUARD_CAT':
      await handleAGUARD_CAT(sessao, params, config, input)
      break

    case 'AGUARD_SUB':
      await handleAGUARD_SUB(sessao, params, config, input)
      break

    case 'AGUARD_CONF':
      await handleAGUARD_CONF(sessao, params, config, input, feriadoHoje)
      break

    default:
      console.warn('[chatbot] Estado desconhecido:', sessao.estado)
  }

  return true
}
