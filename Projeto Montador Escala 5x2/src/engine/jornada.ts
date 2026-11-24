/**
 * Jornada individual do empregado (horário de trabalho), separada da cobertura
 * do estabelecimento. Sem horário fixo na função, sai da carga semanal em 5
 * dias, limitada à jornada diária máxima, com o intervalo legal.
 */
import { REGRAS } from '../config/regras'
import type { Funcao } from '../types'
import { minutosDe } from './datas'

/** Intervalo mínimo para uma jornada de duração bruta `brutoMin`. */
export function intervaloParaBruto(brutoMin: number): number {
  const { acimaDeHoras, minLongoMinutos, acimaDeHorasCurto, minCurtoMinutos } = REGRAS.intrajornada
  if (brutoMin > acimaDeHoras * 60) return minLongoMinutos
  if (brutoMin > acimaDeHorasCurto * 60) return minCurtoMinutos
  return 0
}

export interface JornadaPessoa {
  /** Duração bruta (entrada → saída), em minutos. */
  bruto: number
  intervaloMin: number
  /** Minuto do dia da entrada, quando a função tem horário fixo. */
  inicioFixo?: number
}

/** `tetoSemanalH`: limite semanal da etapa vigente; a jornada diária líquida sai de min(carga da função, teto) ÷ 5. */
export function jornadaDaFuncao(f: Funcao, tetoSemanalH = Infinity): JornadaPessoa {
  if (f.entrada && f.saida) {
    const ini = minutosDe(f.entrada)
    const bruto = (minutosDe(f.saida) - ini + 1440) % 1440 || 1440
    return { bruto, intervaloMin: f.intervaloMin ?? intervaloParaBruto(bruto), inicioFixo: ini }
  }
  const semanal = Math.min(f.horasSemanaisAtuais > 0 ? f.horasSemanaisAtuais : 44, tetoSemanalH)
  const liquida = Math.min(Math.round(REGRAS.jornadaDiariaMax * 60), Math.round((semanal * 60) / 5))
  let intervalo = intervaloParaBruto(liquida)
  intervalo = Math.max(intervalo, intervaloParaBruto(liquida + intervalo))
  return { bruto: liquida + intervalo, intervaloMin: intervalo }
}
