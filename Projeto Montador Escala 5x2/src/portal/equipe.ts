import type { Funcao, PessoaEscala, RegrasPessoais } from '../types'

/** Rótulo do interruptor do art. 386 da CLT (Passo 2, modo portal). */
export const ROTULO_REGRA_MULHERES = 'Aplicar CLT art. 386 às mulheres (domingo de folga ao menos a cada 2 semanas)'

/** Opções de jornada máxima do estagiário (Lei 11.788/2008, art. 10). */
export const OPCOES_JORNADA_ESTAGIO: { valor: RegrasPessoais['estagioHorasSemanais']; rotulo: string }[] = [
  { valor: 20, rotulo: '20 h (ensino fundamental ou especial — 4 h/dia)' },
  { valor: 30, rotulo: '30 h (padrão — 6 h/dia)' },
  { valor: 40, rotulo: '40 h (cursos que alternam teoria e prática — 8 h/dia)' },
]

/** Sexo do cadastro do RH por extenso; ausente → "—". */
export function rotuloSexo(s?: 'F' | 'M'): string {
  return s === 'F' ? 'Feminino' : s === 'M' ? 'Masculino' : '—'
}

/** Etiquetas ao lado do nome (somente leitura, vindas do RH e das regras por pessoa). */
export function etiquetasPessoa(p: PessoaEscala, regras: RegrasPessoais): string[] {
  const out: string[] = []
  if (p.estagiario) out.push('estagiário')
  if (p.menor) out.push('menor de 18')
  if (p.sexo === 'F' && regras.mulheresDomingoQuinzenal) out.push('domingo quinzenal (art. 386)')
  return out
}

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

/** Intervalo em minutos: vazio/NaN → undefined; inteiro entre 0 e 240. */
export function normalizarIntervalo(v: number | undefined): number | undefined {
  if (v === undefined || Number.isNaN(v)) return undefined
  return Math.min(240, Math.max(0, Math.round(v)))
}

/** Horas semanais: vazio/NaN → undefined; entre 1 e 60 com uma casa decimal. */
export function normalizarHoras(v: number | undefined): number | undefined {
  if (v === undefined || Number.isNaN(v)) return undefined
  return Math.min(60, Math.max(1, Math.round(v * 10) / 10))
}
