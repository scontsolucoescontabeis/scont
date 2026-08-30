// Lógica pura de "iniciar conversa" — sem acesso ao Supabase, testável isoladamente.

const STATUS_ABERTOS = ['ABERTA', 'EM_ATENDIMENTO', 'AGUARDANDO']

export function normalizarTelefone(raw) {
  return String(raw ?? '').replace(/\D/g, '')
}

// Dado o histórico de conversas de um contato, devolve a conversa aberta mais
// recente (pra reaproveitar em vez de criar uma duplicada) ou null.
export function escolherConversaAberta(conversas) {
  if (!Array.isArray(conversas)) return null
  return (
    conversas
      .filter(c => STATUS_ABERTOS.includes(c.status))
      .sort((a, b) => String(b.aberto_em).localeCompare(String(a.aberto_em)))[0] ?? null
  )
}
