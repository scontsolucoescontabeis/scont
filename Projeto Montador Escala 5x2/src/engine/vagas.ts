/**
 * Vagas a contratar dentro da proposta de escala.
 *
 * Quando a equipe atual não dá conta da cobertura mínima, a proposta não deve só apontar "furos": ela
 * acrescenta as pessoas que faltam ("Vaga 1 — Atendente") já escaladas, com a jornada e a folga propostas
 * para cada uma. Cada modelo de escala (5x2 fixo, rodízio de domingos, folga móvel) pode exigir um número
 * diferente de contratações, então a busca é feita por modelo: acrescenta uma vaga por vez, na ordem
 * sugerida pelo quadro de contratações, até não sobrar falta de gente.
 *
 * Funções puras; quem sabe medir a cobertura (a conformidade) entra como `furos`.
 */
import type { ContratacaoProposta, Escala, Funcao, ModeloEscala, Proposta } from '../types'
import { MODELOS, gerarEscala, type EntradaGerador } from './gerador'

/** Quantas vagas além das estimadas o gerador pode tentar antes de desistir. */
export const FOLGA_DE_VAGAS = 2
/** Para a busca quando acrescentar vagas deixa de reduzir as faltas por tantas tentativas seguidas. */
const TENTATIVAS_SEM_MELHORA = 3

/**
 * Ordem em que as vagas entram: primeiro as do quadro de contratações (a função com mais vagas por vez),
 * depois `folga` vagas de reserva distribuídas entre as funções, da maior equipe para a menor.
 */
export function ordemDasVagas(funcoes: Funcao[], sugeridas: Record<string, number>, folga = FOLGA_DE_VAGAS): string[] {
  if (funcoes.length === 0) return []
  const restante = new Map(funcoes.map((f) => [f.id, Math.max(0, Math.floor(sugeridas[f.id] ?? 0))]))
  const ordem: string[] = []
  for (;;) {
    let melhor: string | null = null
    for (const f of funcoes) {
      if ((restante.get(f.id) ?? 0) > (melhor ? (restante.get(melhor) ?? 0) : 0)) melhor = f.id
    }
    if (!melhor) break
    ordem.push(melhor)
    restante.set(melhor, (restante.get(melhor) ?? 0) - 1)
  }
  const porEquipe = [...funcoes].sort((a, b) => b.quantidade - a.quantidade)
  for (let i = 0; i < folga; i++) ordem.push(porEquipe[i % porEquipe.length].id)
  return ordem
}

function contar(ids: string[]): Record<string, number> {
  const r: Record<string, number> = {}
  for (const id of ids) r[id] = (r[id] ?? 0) + 1
  return r
}

export interface EscalaComVagas {
  escala: Escala
  contratacoes: ContratacaoProposta[]
}

/** A mesma entrada sem as férias de ninguém: a necessidade de contratar é estrutural, não de quem está de férias. */
function semFerias(entrada: EntradaGerador): EntradaGerador | null {
  if (!entrada.funcoes.some((f) => f.pessoas?.some((p) => p.ferias.length > 0))) return null
  return {
    ...entrada,
    funcoes: entrada.funcoes.map((f) =>
      f.pessoas ? { ...f, pessoas: f.pessoas.map((p) => (p.ferias.length > 0 ? { ...p, ferias: [] } : p)) } : f,
    ),
  }
}

/**
 * Gera a escala de um modelo acrescentando vagas (na ordem dada) até `furos(escala)` chegar a zero.
 * As faltas são medidas na escala SEM as férias (contratar é para a necessidade permanente, não para
 * cobrir férias); a escala devolvida é a com férias. Sem falta de gente, devolve exatamente a escala de
 * `gerarEscala` e nenhuma contratação. Se nenhuma quantidade de vagas zera os furos, fica com a que
 * deixou menos furos (a menor entre as empatadas).
 */
export function gerarEscalaComVagas(
  entrada: EntradaGerador,
  modelo: ModeloEscala,
  ordem: string[],
  furos: (escala: Escala) => number,
): EscalaComVagas {
  let melhor: { n: number; escala: Escala; vagas: Record<string, number> } | null = null
  let semMelhora = 0
  const base = semFerias(entrada)
  for (let k = 0; k <= ordem.length; k++) {
    const vagas = contar(ordem.slice(0, k))
    const comVagas = (e: EntradaGerador) => gerarEscala(k === 0 ? e : { ...e, vagas }, modelo)
    const escala = comVagas(entrada)
    const n = furos(base ? comVagas(base) : escala)
    if (!melhor || n < melhor.n) {
      melhor = { n, escala, vagas }
      semMelhora = 0
    } else {
      semMelhora++
    }
    if (n === 0 || semMelhora >= TENTATIVAS_SEM_MELHORA) break
  }
  const { escala, vagas } = melhor!
  const contratacoes: ContratacaoProposta[] = entrada.funcoes
    .filter((f) => (vagas[f.id] ?? 0) > 0)
    .map((f) => ({ funcaoId: f.id, nome: f.nome, quantidade: vagas[f.id] }))
  return { escala, contratacoes }
}

/** As três propostas (modelos) já com as vagas que cada uma exige. */
export function gerarPropostasComVagas(
  entrada: EntradaGerador,
  ordem: string[],
  furos: (escala: Escala) => number,
): Proposta[] {
  return MODELOS.map((m) => {
    const { escala, contratacoes } = gerarEscalaComVagas(entrada, m.modelo, ordem, furos)
    return {
      id: m.modelo,
      modelo: m.modelo,
      nome: m.nome,
      descricao: m.descricao,
      escala,
      ...(contratacoes.length > 0 ? { contratacoes } : {}),
    }
  })
}

/** Total de vagas de uma proposta. */
export const totalDeVagas = (c?: ContratacaoProposta[]): number => (c ?? []).reduce((s, x) => s + x.quantidade, 0)
