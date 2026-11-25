/** Traduz o erro da RPC em mensagem para o usuário. */
export function traduzirErro(e: unknown): Error {
  const code = (e as { code?: string } | null)?.code
  if (code === '42501') return new Error('Sem acesso a esta empresa')
  return new Error('Não foi possível carregar os dados da empresa')
}
