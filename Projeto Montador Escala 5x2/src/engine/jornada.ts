/**
 * Jornada individual do empregado (horário de trabalho), separada da cobertura
 * do estabelecimento. Sem horário fixo na função, sai da carga semanal em 5
 * dias, limitada à jornada diária máxima, com o intervalo legal.
 */
import { REGRAS, etapaVigente, limitesDaEtapa } from '../config/regras'
import type { Funcao, PessoaEscala } from '../types'
import { domingoDaSemana, minutosDe, somarDias } from './datas'

/** Teto semanal (h) da etapa vigente na semana (domingo a sábado) que contém `inicio`. */
export function tetoSemanalNaData(inicio: string): number {
  return limitesDaEtapa(etapaVigente(somarDias(domingoDaSemana(inicio), 6), REGRAS), REGRAS).jornadaSemanalMax
}

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
  if (f.intervaloMin !== undefined) return { bruto: liquida + f.intervaloMin, intervaloMin: f.intervaloMin }
  let intervalo = intervaloParaBruto(liquida)
  intervalo = Math.max(intervalo, intervaloParaBruto(liquida + intervalo))
  return { bruto: liquida + intervalo, intervaloMin: intervalo }
}

/** Jornada de uma pessoa: as sobreposições dela (carga, horário fixo, intervalo) valem sobre as da função. */
export function jornadaDaPessoa(f: Funcao, p: PessoaEscala | undefined, tetoSemanalH = Infinity): JornadaPessoa {
  if (!p) return jornadaDaFuncao(f, tetoSemanalH)
  return jornadaDaFuncao(
    {
      ...f,
      horasSemanaisAtuais: p.horasSemanais ?? f.horasSemanaisAtuais,
      entrada: p.entrada ?? f.entrada,
      saida: p.saida ?? f.saida,
      intervaloMin: p.intervaloMin ?? f.intervaloMin,
    },
    tetoSemanalH,
  )
}
