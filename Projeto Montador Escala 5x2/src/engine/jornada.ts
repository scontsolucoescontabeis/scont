/**
 * Jornada individual do empregado (horário de trabalho), separada da cobertura
 * do estabelecimento. Sem horário fixo na função, sai da carga semanal em 5
 * dias, limitada à jornada diária máxima, com o intervalo legal.
 */
import { REGRAS, REGRAS_PESSOAIS_PADRAO, etapaVigente, limitesDaEtapa } from '../config/regras'
import type { Funcao, Funcionario, PessoaEscala, RegrasPessoais } from '../types'
import { domingoDaSemana, minutosDe, somarDias } from './datas'

/** Teto semanal (h) da etapa vigente na semana (domingo a sábado) que contém `inicio`. */
export function tetoSemanalNaData(inicio: string): number {
  return limitesDaEtapa(etapaVigente(somarDias(domingoDaSemana(inicio), 6), REGRAS), REGRAS).jornadaSemanalMax
}

/**
 * Horário de funcionamento do dia (minutos) a usar para recortar um período [ini, fim): só recorta quando o período
 * toca esse horário; um período inteiramente fora dele (ex.: produção antes de abrir ao público) vale por inteiro.
 */
export function recorteDoDia(
  janela: { ini: number; fim: number } | undefined,
  ini: number,
  fim: number,
): { ini: number; fim: number } | undefined {
  return janela && ini < janela.fim && fim > janela.ini ? janela : undefined
}

/** Intervalo mínimo para uma jornada de duração bruta `brutoMin`. */
export function intervaloParaBruto(brutoMin: number): number {
  const { acimaDeHoras, minLongoMinutos, acimaDeHorasCurto, minCurtoMinutos } = REGRAS.intrajornada
  if (brutoMin > acimaDeHoras * 60) return minLongoMinutos
  if (brutoMin > acimaDeHorasCurto * 60) return minCurtoMinutos
  return 0
}

/**
 * Menor intervalo que torna legal uma jornada de duração BRUTA `brutoMin` (o intervalo sai da jornada, e a
 * duração líquida que sobra é que define o mínimo). Usada quando o dia é mais curto que a jornada cheia.
 */
export function intervaloMinimoDaJornada(brutoMin: number): number {
  const { minCurtoMinutos, minLongoMinutos } = REGRAS.intrajornada
  for (const i of [0, minCurtoMinutos, minLongoMinutos]) {
    if (i >= intervaloParaBruto(brutoMin - i)) return i
  }
  return minLongoMinutos
}

export interface JornadaPessoa {
  /** Duração bruta (entrada → saída), em minutos. */
  bruto: number
  intervaloMin: number
  /** Minuto do dia da entrada, quando a função tem horário fixo. */
  inicioFixo?: number
}

/**
 * `tetoSemanalH`: limite semanal da etapa vigente; a jornada diária líquida sai de min(carga da função, teto) ÷ 5,
 * limitada à jornada diária máxima e a `diariaMaxMin` (limites por pessoa, em minutos líquidos).
 */
export function jornadaDaFuncao(f: Funcao, tetoSemanalH = Infinity, diariaMaxMin = Infinity): JornadaPessoa {
  if (f.entrada && f.saida) {
    const ini = minutosDe(f.entrada)
    const bruto = (minutosDe(f.saida) - ini + 1440) % 1440 || 1440
    return { bruto, intervaloMin: f.intervaloMin ?? intervaloParaBruto(bruto), inicioFixo: ini }
  }
  const semanal = Math.min(f.horasSemanaisAtuais > 0 ? f.horasSemanaisAtuais : 44, tetoSemanalH)
  const liquida = Math.min(Math.round(REGRAS.jornadaDiariaMax * 60), Math.round((semanal * 60) / 5), diariaMaxMin)
  if (f.intervaloMin !== undefined) return { bruto: liquida + f.intervaloMin, intervaloMin: f.intervaloMin }
  let intervalo = intervaloParaBruto(liquida)
  intervalo = Math.max(intervalo, intervaloParaBruto(liquida + intervalo))
  return { bruto: liquida + intervalo, intervaloMin: intervalo }
}

/** Limites do estagiário (Lei 11.788/2008 art. 10): semana configurada; dia = semana ÷ 5, até 6 h (8 h com 40 h). */
export function limitesEstagio(regras: RegrasPessoais = REGRAS_PESSOAIS_PADRAO): { semanalH: number; diariaMin: number } {
  const semanalH = regras.estagioHorasSemanais
  const tetoDia = semanalH >= 40 ? REGRAS.pessoas.estagioHorasDiaMax40 : REGRAS.pessoas.estagioHorasDiaMax
  return { semanalH, diariaMin: Math.min(Math.round((semanalH * 60) / 5), tetoDia * 60) }
}

/**
 * Jornada de uma pessoa: as sobreposições dela (carga, horário fixo, intervalo) valem sobre as da função.
 * Estagiário (pelo cadastro, não pelo cargo) fica nos limites da Lei 11.788/2008; menor de 18, em 8 h/dia
 * (CLT arts. 411 e 413). Horário fixo (entrada/saída) é mantido: a conformidade aponta se passar do limite.
 */
export function jornadaDaPessoa(
  f: Funcao,
  p: PessoaEscala | undefined,
  tetoSemanalH = Infinity,
  regras: RegrasPessoais = REGRAS_PESSOAIS_PADRAO,
): JornadaPessoa {
  if (!p) return jornadaDaFuncao(f, tetoSemanalH)
  let teto = tetoSemanalH
  let diaria = Infinity
  if (p.estagiario) {
    const est = limitesEstagio(regras)
    teto = Math.min(teto, est.semanalH)
    diaria = Math.min(diaria, est.diariaMin)
  }
  if (p.menor) diaria = Math.min(diaria, REGRAS.pessoas.menorHorasDiaMax * 60)
  return jornadaDaFuncao(
    {
      ...f,
      horasSemanaisAtuais: p.horasSemanais ?? f.horasSemanaisAtuais,
      entrada: p.entrada ?? f.entrada,
      saida: p.saida ?? f.saida,
      intervaloMin: p.intervaloMin ?? f.intervaloMin,
    },
    teto,
    diaria,
  )
}

/**
 * Ciclo do domingo (semanas) de um funcionário: mulher com a regra do art. 386 ligada folga ao menos
 * 1 domingo a cada 2 semanas; os demais seguem o ciclo do setor.
 */
export function cicloDomingoDe(f: Funcionario, cicloSetor: number, regras: RegrasPessoais = REGRAS_PESSOAIS_PADRAO): number {
  return regras.mulheresDomingoQuinzenal && f.sexo === 'F'
    ? Math.min(cicloSetor, REGRAS.pessoas.domingoMulherCicloSemanas)
    : cicloSetor
}

/** O intervalo [ini, ini + bruto) (minutos, a partir de 00:00 do dia) toca a faixa noturna do menor (22h–5h). */
export function tocaNoturnoMenor(ini: number, bruto: number): boolean {
  const nIni = minutosDe(REGRAS.pessoas.menorNoturno.inicio)
  const nFim = minutosDe(REGRAS.pessoas.menorNoturno.fim)
  const fim = ini + bruto
  for (const base of [-1440, 0, 1440]) {
    if (Math.min(fim, base + 1440 + nFim) > Math.max(ini, base + nIni)) return true
  }
  return false
}
