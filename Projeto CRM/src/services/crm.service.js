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

export async function configurarAcessoCRM(usuarioId, departamento, role) {
  const { error } = await supabase
    .from('usuarios')
    .update({ departamento, role })
    .eq('id', usuarioId)
  if (error) throw error
}

export async function revogarAcessoCRM(usuarioId) {
  const { error } = await supabase
    .from('usuarios')
    .update({ departamento: null, role: null })
    .eq('id', usuarioId)
  if (error) throw error
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
