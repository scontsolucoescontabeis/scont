import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function obterOuCriarContato(supabase: SupabaseClient, telefone: string, nome?: string) {
  // telefone vem como dígitos puros do Meta / Evolution API / simulador (ex: 5511999999999)
  const digits = telefone.replace(/\D/g, '')
  const variantes = [...new Set([
    digits,
    '+' + digits,
    digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : null,
    '+55' + (digits.startsWith('55') ? digits.slice(2) : digits),
  ].filter(Boolean) as string[])]

  const { data: existentes } = await supabase
    .from('contatos')
    .select('*, contatos_empresas(id)')
    .in('telefone', variantes)

  if (existentes && existentes.length > 0) {
    const comEmpresas = existentes.find(
      (c: Record<string, unknown>) => Array.isArray(c.contatos_empresas) && (c.contatos_empresas as unknown[]).length > 0
    )
    return comEmpresas ?? existentes[0]
  }

  const { data: novo } = await supabase
    .from('contatos')
    .insert({ telefone: digits, nome: nome || digits })
    .select()
    .single()

  return novo
}

export async function obterOuCriarConversa(supabase: SupabaseClient, contatoId: string) {
  const { data: existente } = await supabase
    .from('conversas')
    .select('*')
    .eq('contato_id', contatoId)
    .in('status', ['ABERTA', 'EM_ATENDIMENTO', 'AGUARDANDO'])
    .order('aberto_em', { ascending: false })
    .limit(1)
    .single()

  if (existente) return { conversa: existente, isNova: false }

  const { data: nova } = await supabase
    .from('conversas')
    .insert({
      contato_id: contatoId,
      departamento: 'PESSOAL',
      status: 'ABERTA',
    })
    .select()
    .single()

  return { conversa: nova, isNova: true }
}

export async function salvarMensagemRecebida(supabase: SupabaseClient, opts: {
  conversaId: string
  conteudo: string | null
  tipo?: string
  mediaUrl?: string | null
  whatsappMsgId?: string | null
}) {
  const { data, error } = await supabase.from('mensagens').insert({
    conversa_id:     opts.conversaId,
    conteudo:        opts.conteudo,
    tipo:            opts.tipo || 'text',
    media_url:       opts.mediaUrl ?? null,
    whatsapp_msg_id: opts.whatsappMsgId ?? null,
    origem:          'CLIENTE',
    lida:            false,
  }).select().single()
  if (error) throw error
  return data
}
