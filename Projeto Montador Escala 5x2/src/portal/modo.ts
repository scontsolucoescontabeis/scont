/** Funções puras do modo portal (sem I/O, sem tocar window). */
import type { Funcao, PessoaEscala } from '../types'

const CHAVE_BASE = 'scont.montador-escala-5x2.v1'

/** Código da empresa em `?empresa=`; vazio/ausente → null (modo avulso). */
export function empresaDoPortal(search: string): string | null {
  const v = new URLSearchParams(search).get('empresa')?.trim()
  return v ? v : null
}

export function chaveArmazenamento(codigo: string | null): string {
  return codigo ? `${CHAVE_BASE}:${codigo}` : CHAVE_BASE
}

/**
 * Reaplica sobre a equipe vinda do banco (`base`) as edições do usuário guardadas
 * (`salvas`), por Funcao.id e pessoa.id. Só os campos editáveis são reaplicados;
 * nome, id, férias e jornadaPadrao vêm sempre do banco.
 */
export function mesclarEstadoSalvo(base: Funcao[], salvas: Funcao[] | undefined): Funcao[] {
  const salvasPorId = new Map((salvas ?? []).map((f) => [f.id, f]))
  return base.map((f) => {
    const salvaF = salvasPorId.get(f.id)
    const porPessoa = new Map((salvaF?.pessoas ?? []).map((p) => [p.id, p]))
    const pessoas = (f.pessoas ?? []).map((p): PessoaEscala => {
      const s = porPessoa.get(p.id)
      if (!s) return { ...p }
      const r: PessoaEscala = { ...p, escalar: s.escalar }
      if (s.horasSemanais !== undefined) r.horasSemanais = s.horasSemanais
      if (s.entrada !== undefined) r.entrada = s.entrada
      if (s.saida !== undefined) r.saida = s.saida
      if (s.intervaloMin !== undefined) r.intervaloMin = s.intervaloMin
      return r
    })
    if (!f.pessoas) return { ...f }
    return { ...f, pessoas, quantidade: pessoas.filter((p) => p.escalar).length }
  })
}
