import { supabase } from '@/lib/supabaseClient'

export async function buscarMeuPerfil() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, email, departamento, role, ativo')
    .eq('id', user.id)
    .single()
  return data
}

export async function buscarAgentesDoDepto(departamento) {
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, departamento')
    .eq('departamento', departamento)
    .eq('ativo', true)
    .order('nome')
  return data ?? []
}

export async function buscarTodosAgentes() {
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, email, departamento, role, ativo, criado_em')
    .order('nome')
  return data ?? []
}

export async function criarUsuario(email, senha, nome, departamento, role = 'AGENTE') {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (error) throw error

  const { error: profileError } = await supabase
    .from('usuarios')
    .insert({ id: data.user.id, nome, email, departamento, role })
  if (profileError) throw profileError

  return data.user
}

export async function buscarMetricas() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [abertas, emAtendimento, encerradasHoje, ranking] = await Promise.all([
    supabase.from('conversas').select('id', { count: 'exact', head: true }).eq('status', 'ABERTA'),
    supabase.from('conversas').select('id', { count: 'exact', head: true }).eq('status', 'EM_ATENDIMENTO'),
    supabase.from('conversas').select('id', { count: 'exact', head: true })
      .eq('status', 'ENCERRADA')
      .gte('encerrado_em', hoje.toISOString()),
    supabase.from('conversas')
      .select('departamento, usuarios(nome)')
      .eq('status', 'ENCERRADA'),
  ])

  const porDepto = { PESSOAL: 0, CONTABIL: 0, ADMINISTRATIVO: 0, TRIBUTARIO: 0 }
  const rankingAgentes = {}

  if (ranking.data) {
    for (const c of ranking.data) {
      if (c.departamento) porDepto[c.departamento] = (porDepto[c.departamento] ?? 0) + 1
      const nome = c.usuarios?.nome
      if (nome) rankingAgentes[nome] = (rankingAgentes[nome] ?? 0) + 1
    }
  }

  return {
    abertas: abertas.count ?? 0,
    emAtendimento: emAtendimento.count ?? 0,
    encerradasHoje: encerradasHoje.count ?? 0,
    porDepto,
    rankingAgentes: Object.entries(rankingAgentes)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total),
  }
}
