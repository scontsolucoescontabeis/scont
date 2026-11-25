import type { Funcao, PessoaEscala } from '../types'

export type EdicaoPessoa = Partial<
  Pick<PessoaEscala, 'escalar' | 'horasSemanais' | 'entrada' | 'saida' | 'intervaloMin'>
>

/** Atualiza uma pessoa (imutável) e recalcula `quantidade` da função; ids desconhecidos devolvem a entrada. */
export function atualizarPessoa(
  funcoes: Funcao[],
  funcaoId: string,
  pessoaId: string,
  p: EdicaoPessoa,
): Funcao[] {
  const f = funcoes.find((x) => x.id === funcaoId)
  if (!f?.pessoas?.some((x) => x.id === pessoaId)) return funcoes
  return funcoes.map((fn) => {
    if (fn.id !== funcaoId) return fn
    const pessoas = fn.pessoas!.map((x) => (x.id === pessoaId ? { ...x, ...p } : x))
    return { ...fn, pessoas, quantidade: pessoas.filter((x) => x.escalar).length }
  })
}

const dataBR = (iso: string): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}` : null
}

/** Períodos de férias como etiquetas `dd/mm–dd/mm`; itens inválidos são ignorados. */
export function resumoFerias(ferias: { inicio: string; fim: string }[]): string[] {
  const out: string[] = []
  for (const f of ferias) {
    const i = dataBR(f.inicio)
    const fim = dataBR(f.fim)
    if (i && fim) out.push(`${i}–${fim}`)
  }
  return out
}

/** Combinação (horas, entrada, saída, intervalo) mais comum entre as pessoas escaláveis; empate: a primeira vista. */
export function jornadaMaisComum(
  f: Funcao,
): { horasSemanais: number; entrada?: string; saida?: string; intervaloMin?: number } | null {
  const grupos = new Map<
    string,
    { n: number; j: { horasSemanais: number; entrada?: string; saida?: string; intervaloMin?: number } }
  >()
  for (const p of f.pessoas ?? []) {
    if (!p.escalar) continue
    const j = {
      horasSemanais: p.horasSemanais ?? f.horasSemanaisAtuais,
      entrada: p.entrada ?? f.entrada,
      saida: p.saida ?? f.saida,
      intervaloMin: p.intervaloMin ?? f.intervaloMin,
    }
    const chave = JSON.stringify([j.horasSemanais, j.entrada, j.saida, j.intervaloMin])
    const g = grupos.get(chave)
    if (g) g.n++
    else grupos.set(chave, { n: 1, j })
  }
  let melhor: { n: number; j: ReturnType<typeof jornadaMaisComum> } | null = null
  for (const g of grupos.values()) if (!melhor || g.n > melhor.n) melhor = g
  return melhor?.j ?? null
}
