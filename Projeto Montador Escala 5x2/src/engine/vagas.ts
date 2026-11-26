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
import { tetoSemanalNaData } from './jornada'

/** Cargas semanais (h) de tempo parcial que a busca experimenta, da menor para a maior (CLT art. 58-A: até 30 h, sem horas extras). */
export const HORAS_PARCIAIS = [20, 30]

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
  horasParciais: number[] = [],
): EscalaComVagas {
  type Plano = { vagas: Record<string, number>; parciais: Record<string, number[]> }
  const base = semFerias(entrada)
  const gerar = (e: EntradaGerador, p: Plano) => {
    const temVagas = Object.keys(p.vagas).length > 0 || Object.keys(p.parciais).length > 0
    return gerarEscala(temVagas ? { ...e, vagas: p.vagas, vagasParciais: p.parciais } : e, modelo)
  }
  const resultado = (escala: Escala, p: Plano): EscalaComVagas => ({
    escala,
    contratacoes: entrada.funcoes
      .filter((f) => (p.vagas[f.id] ?? 0) + (p.parciais[f.id]?.length ?? 0) > 0)
      .map((f) => ({
        funcaoId: f.id,
        nome: f.nome,
        quantidade: (p.vagas[f.id] ?? 0) + (p.parciais[f.id]?.length ?? 0),
        ...(p.parciais[f.id]?.length ? { parciais: p.parciais[f.id] } : {}),
      })),
  })

  let melhor: { n: number; escala: Escala; plano: Plano } | null = null
  let semMelhora = 0
  for (let k = 0; k <= ordem.length; k++) {
    const plano: Plano = { vagas: contar(ordem.slice(0, k)), parciais: {} }
    const escala = gerar(entrada, plano)
    const n = furos(base ? gerar(base, plano) : escala)
    if (!melhor || n < melhor.n) {
      melhor = { n, escala, plano }
      semMelhora = 0
    } else {
      semMelhora++
    }
    if (n === 0 || semMelhora >= TENTATIVAS_SEM_MELHORA) break
  }

  // Tempo parcial: se as vagas em tempo integral zeraram as faltas, tenta trocar as últimas 1 ou 2 por vagas de
  // menos horas (mais baratas) e fica com a combinação mais barata que ainda cobre tudo.
  if (melhor!.n === 0 && horasParciais.length > 0) {
    const nVagas = Object.values(melhor!.plano.vagas).reduce((a, b) => a + b, 0)
    const ids = ordem.slice(0, nVagas)
    const cheias = (fid: string) => {
      const f = entrada.funcoes.find((x) => x.id === fid)
      const h = f && f.horasSemanaisAtuais > 0 ? f.horasSemanaisAtuais : 44
      return Math.min(h, tetoSemanalNaData(entrada.inicio))
    }
    const custoCheio = ids.reduce((s, fid) => s + cheias(fid), 0)
    const candidatos: { plano: Plano; custo: number }[] = []
    for (const trocar of [1, 2]) {
      if (trocar > nVagas) continue
      for (const h of horasParciais) {
        const inteiras = ids.slice(0, nVagas - trocar)
        const parciaisIds = ids.slice(nVagas - trocar)
        if (parciaisIds.some((fid) => h >= cheias(fid))) continue
        const parciais: Record<string, number[]> = {}
        for (const fid of parciaisIds) (parciais[fid] ??= []).push(h)
        const custo = inteiras.reduce((s, fid) => s + cheias(fid), 0) + h * trocar
        if (custo < custoCheio) candidatos.push({ plano: { vagas: contar(inteiras), parciais }, custo })
      }
    }
    candidatos.sort((a, b) => a.custo - b.custo)
    for (const c of candidatos) {
      const escala = gerar(entrada, c.plano)
      if (furos(base ? gerar(base, c.plano) : escala) === 0) return resultado(escala, c.plano)
    }
  }
  return resultado(melhor!.escala, melhor!.plano)
}

/** As três propostas (modelos) já com as vagas que cada uma exige. */
export function gerarPropostasComVagas(
  entrada: EntradaGerador,
  ordem: string[],
  furos: (escala: Escala) => number,
  horasParciais: number[] = [],
): Proposta[] {
  return MODELOS.map((m) => {
    const { escala, contratacoes } = gerarEscalaComVagas(entrada, m.modelo, ordem, furos, horasParciais)
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
