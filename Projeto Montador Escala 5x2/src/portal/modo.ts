/** Funções puras do modo portal (sem I/O, sem tocar window). */
import type { Funcao, HorarioDiaPessoa, PessoaEscala } from '../types'

const CHAVE_BASE = 'scont.montador-escala-5x2.v1'

/** Portal: o conteúdo dos passos só aparece com os dados carregados e sem erro (evita mostrar a equipe de demonstração). */
export function deveMostrarConteudo(
  portal: { carregando: boolean; erro: string | null } | null,
): boolean {
  return !portal || (!portal.carregando && !portal.erro)
}

/** Código da empresa em `?empresa=`; vazio/ausente → null (modo avulso). */
export function empresaDoPortal(search: string): string | null {
  const v = new URLSearchParams(search).get('empresa')?.trim()
  return v ? v : null
}

export function chaveArmazenamento(codigo: string | null): string {
  return codigo ? `${CHAVE_BASE}:${codigo}` : CHAVE_BASE
}

type CampoEditavel = 'escalar' | 'horasSemanais' | 'entrada' | 'saida' | 'intervaloMin' | 'jornadaDias'
const CAMPOS: CampoEditavel[] = ['escalar', 'horasSemanais', 'entrada', 'saida', 'intervaloMin', 'jornadaDias']
/** Igualdade por valor (jornadaDias é lista). */
const igual = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** Edição do usuário sobre uma pessoa; `null` = campo limpo (undefined). */
export type SobreposicaoPessoa = {
  escalar?: boolean
  horasSemanais?: number | null
  entrada?: string | null
  saida?: string | null
  intervaloMin?: number | null
  jornadaDias?: (HorarioDiaPessoa | null)[] | null
}
/** funcaoId -> pessoaId -> edições. Só guarda o que difere do banco. */
export type Sobreposicoes = Record<string, Record<string, SobreposicaoPessoa>>

/** Diferenças (campos editáveis) entre a equipe do banco e a atual. */
export function calcularSobreposicoes(base: Funcao[], atual: Funcao[]): Sobreposicoes {
  const out: Sobreposicoes = {}
  const atualPorId = new Map(atual.map((f) => [f.id, f]))
  for (const f of base) {
    const pessoasAtuais = new Map((atualPorId.get(f.id)?.pessoas ?? []).map((p) => [p.id, p]))
    for (const p of f.pessoas ?? []) {
      const a = pessoasAtuais.get(p.id)
      if (!a) continue
      const dif: Record<string, unknown> = {}
      for (const c of CAMPOS) if (!igual(a[c], p[c])) dif[c] = a[c] === undefined ? null : a[c]
      if (Object.keys(dif).length > 0) (out[f.id] ??= {})[p.id] = dif as SobreposicaoPessoa
    }
  }
  return out
}

/** Aplica as edições do usuário sobre uma cópia da equipe do banco. */
export function aplicarSobreposicoes(base: Funcao[], sob: Sobreposicoes | undefined): Funcao[] {
  return base.map((f) => {
    if (!f.pessoas) return { ...f }
    const porPessoa = sob?.[f.id] ?? {}
    const pessoas = f.pessoas.map((p): PessoaEscala => {
      const o = porPessoa[p.id]
      const r: PessoaEscala = { ...p }
      if (!o) return r
      for (const c of CAMPOS) {
        if (!(c in o)) continue
        const v = o[c]
        if (c === 'escalar') r.escalar = v as boolean
        else if (v === null || v === undefined) delete r[c]
        else (r as unknown as Record<string, unknown>)[c] = v
      }
      return r
    })
    return { ...f, pessoas, quantidade: pessoas.filter((p) => p.escalar).length }
  })
}
