import { createClient } from '@supabase/supabase-js'
import { traduzirErro } from './erros'
import type { DadosPortal } from './mapear'

/**
 * Cliente com a sessão persistida do portal (mesma origem → mesma chave de
 * localStorage). As globais vêm de ../../supabase-config.js.
 */
export async function carregarDadosPortal(codigo: string): Promise<DadosPortal> {
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined' || !SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Configuração do Supabase não encontrada')
  }
  const client = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data: sessao } = await client.auth.getSession()
  if (!sessao.session) throw new Error('Sessão expirada')
  const { data, error } = await client.rpc('montador_dados_empresa', { p_codigo: codigo })
  if (error) throw traduzirErro(error)
  if (!data) throw traduzirErro(null)
  return data as DadosPortal
}
