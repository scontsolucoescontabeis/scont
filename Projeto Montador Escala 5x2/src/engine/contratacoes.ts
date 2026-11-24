/**
 * Quadro sugerido de contratações para cobrir a cobertura mínima informada.
 * Função pura — tudo é ESTIMATIVA.
 *
 * Lógica: por período do estabelecimento, soma-se a demanda semanal em
 * pessoa-dia (mínimo de pessoas × dias de funcionamento × duração do período ÷
 * jornada diária de uma pessoa, que é limitada a 8h24 líquidas + intervalo).
 * Cada pessoa trabalha, no máximo, 5 dias/semana (5x2) e não passa do limite
 * semanal da etapa. Pessoas necessárias = pessoa-dia ÷ dias por pessoa.
 */
import { REGRAS, limitesDaEtapa, type EtapaId, type RegrasLegais } from '../config/regras'
import type { CoberturaTurno, Empresa, Funcao, MinimosDia, ParametrosCusto, Turno } from '../types'
import { minutosDe } from './datas'
import { intervaloParaBruto } from './jornada'

export interface LinhaTurnoQuadro {
  turnoId: string
  nome: string
  presencasSemana: number
  turnosPorPessoa: number
  necessarios: number
  /** Quantas pessoas bastariam numa escala 6x1 (6 turnos/semana, jornada de 44h dividida em 6 dias) — só para comparação. */
  necessariosNa6x1: number
}

export interface LinhaFuncaoQuadro {
  funcaoId: string
  nome: string
  atual: number
  sugerido: number
  contratar: number
  custoMensal: number | null
}

export interface QuadroContratacoes {
  etapa: Exclude<EtapaId, 'legado'>
  linhasTurno: LinhaTurnoQuadro[]
  necessarioTotal: number
  equipeAtual: number
  contratar: number
  porFuncao: LinhaFuncaoQuadro[]
  custoMensal: number | null
  rotulo: 'ESTIMATIVA'
}

function demandaDia(c: MinimosDia, dow: number): number {
  return dow === 0 ? c.dom : dow === 6 ? c.sab : c.util
}

/** Distribui `total` unidades proporcionalmente a `pesos` (maior resto). */
function distribuir(total: number, pesos: number[]): number[] {
  const soma = pesos.reduce((a, b) => a + b, 0)
  if (soma === 0 || total === 0) return pesos.map(() => 0)
  const exatos = pesos.map((p) => (p / soma) * total)
  const base = exatos.map(Math.floor)
  let resto = total - base.reduce((a, b) => a + b, 0)
  const ordem = exatos.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r)
  for (const { i } of ordem) {
    if (resto <= 0) break
    base[i] += 1
    resto -= 1
  }
  return base
}

export function calcularQuadro(
  entrada: {
    empresa: Empresa
    funcoes: Funcao[]
    turnos: Turno[]
    cobertura: Record<string, CoberturaTurno>
    custo: ParametrosCusto
  },
  etapa: Exclude<EtapaId, 'legado'>,
  regras: RegrasLegais = REGRAS,
): QuadroContratacoes {
  const { empresa, funcoes, turnos, cobertura, custo } = entrada
  const limiteHoras = limitesDaEtapa(etapa, regras).jornadaSemanalMax

  // O período é do estabelecimento; cada pessoa cumpre a jornada legal (≤ 8h24 líquidas + intervalo).
  const liquida = Math.min(regras.jornadaDiariaMax * 60, Math.floor((limiteHoras * 60) / 5))
  const intervalo = intervaloParaBruto(liquida)
  const bruto = Math.max(1, liquida + Math.max(intervalo, intervaloParaBruto(liquida + intervalo)))
  const porPessoa = Math.max(1, Math.min(5, Math.floor((limiteHoras * 60) / Math.max(1, liquida))))
  const duracaoDe = (t: Turno) => Math.max(1, (minutosDe(t.fim) - minutosDe(t.inicio) + 1440) % 1440 || 1440)
  const presencasDe = (m: MinimosDia) =>
    [0, 1, 2, 3, 4, 5, 6].reduce((s, d) => s + (empresa.diasFuncionamento[d] ? demandaDia(m, d) : 0), 0)

  // Pessoas necessárias de cada função com mínimo próprio (soma dos períodos).
  const necessarioFn = new Map<string, number>()
  for (const f of funcoes) {
    const dias = turnos.reduce((s, t) => {
      const m = cobertura[t.id]?.porFuncao?.[f.id]
      return m ? s + Math.ceil((presencasDe(m) * duracaoDe(t)) / bruto) : s
    }, 0)
    if (dias > 0) necessarioFn.set(f.id, Math.ceil(dias / porPessoa))
  }

  const linhasTurno: LinhaTurnoQuadro[] = turnos
    .filter((t) => cobertura[t.id])
    .map((t) => {
      const c = cobertura[t.id]
      const somaFn = (d: number) =>
        Object.entries(c.porFuncao ?? {})
          .filter(([id]) => funcoes.some((f) => f.id === id))
          .reduce((s, [, m]) => s + demandaDia(m, d), 0)
      const presencas = [0, 1, 2, 3, 4, 5, 6].reduce(
        (s, d) => s + (empresa.diasFuncionamento[d] ? Math.max(demandaDia(c, d), somaFn(d)) : 0),
        0,
      )
      const duracao = duracaoDe(t)
      const diasPessoa = Math.ceil((presencas * duracao) / bruto)
      return {
        turnoId: t.id,
        nome: t.nome,
        presencasSemana: diasPessoa,
        turnosPorPessoa: porPessoa,
        necessarios: Math.ceil(diasPessoa / porPessoa),
        necessariosNa6x1: Math.ceil(diasPessoa / 6),
      }
    })

  const necessarioTotal = linhasTurno.reduce((s, l) => s + l.necessarios, 0)
  const equipeAtual = funcoes.reduce((s, f) => s + f.quantidade, 0)
  // Cada função com mínimo próprio precisa de, no mínimo, as pessoas que ele exige; o que sobrar
  // do total é distribuído proporcionalmente à equipe atual.
  const base = funcoes.map((f) => Math.max(0, (necessarioFn.get(f.id) ?? 0) - f.quantidade))
  const faltaTotal = Math.max(0, necessarioTotal - (equipeAtual + base.reduce((a, b) => a + b, 0)))
  const resto = distribuir(faltaTotal, funcoes.map((f) => f.quantidade))
  const extras = base.map((b, i) => b + resto[i])
  const contratar = extras.reduce((a, b) => a + b, 0)
  const fator = 1 + custo.encargosPct / 100
  const temSalario = funcoes.some((f) => f.salarioBase && f.salarioBase > 0)

  const porFuncao: LinhaFuncaoQuadro[] = funcoes.map((f, i) => ({
    funcaoId: f.id,
    nome: f.nome,
    atual: f.quantidade,
    sugerido: f.quantidade + extras[i],
    contratar: extras[i],
    custoMensal: f.salarioBase && f.salarioBase > 0 ? extras[i] * f.salarioBase * fator : null,
  }))

  return {
    etapa,
    linhasTurno,
    necessarioTotal,
    equipeAtual,
    contratar,
    porFuncao,
    custoMensal: temSalario ? porFuncao.reduce((s, p) => s + (p.custoMensal ?? 0), 0) : null,
    rotulo: 'ESTIMATIVA',
  }
}
