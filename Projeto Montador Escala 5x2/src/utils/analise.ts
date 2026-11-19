import { REGRAS } from '../config/regras'
import { validarEscala } from '../engine/conformidade'
import { coberturaParaRegras } from '../engine/gerador'
import { somarDias } from '../engine/datas'
import type { Dados } from '../store/useStore'
import type { DiaEscala, Escala, ResultadoConformidade, Turno } from '../types'

export type DadosAnalise = Pick<Dados, 'empresa' | 'cobertura' | 'feriados'>

export function analisar(dados: DadosAnalise, escala: Escala): ResultadoConformidade {
  return validarEscala({
    escala,
    cobertura: coberturaParaRegras(dados.cobertura, dados.empresa.diasFuncionamento),
    feriados: dados.feriados.map((f) => f.data),
    empresaFuncionaFeriados: dados.empresa.funcionaFeriados,
    compensacaoDiaria: dados.empresa.compensacaoDiaria,
    regras: REGRAS,
  })
}

export const NOME_TIPO: Record<DiaEscala['tipo'], string> = {
  trabalho: 'Trabalho',
  folga: 'Folga',
  dsr: 'DSR (descanso semanal)',
  feriado: 'Feriado',
  ausencia: 'Atestado/Férias',
}

export const SIGLA_TIPO: Record<DiaEscala['tipo'], string> = {
  trabalho: 'T',
  folga: 'F',
  dsr: 'DSR',
  feriado: 'FER',
  ausencia: 'AUS',
}

export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function datasDaEscala(e: Escala): string[] {
  return Array.from({ length: e.dias }, (_, i) => somarDias(e.inicio, i))
}

export function rotuloTurno(t: Turno | undefined): string {
  return t ? `${t.inicio}–${t.fim}` : ''
}

export function formatarMoeda(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarData(d: string): string {
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}
