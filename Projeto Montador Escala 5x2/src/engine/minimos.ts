/**
 * Mínimo de pessoas por dia da semana. `MinimosDia.util` vale para segunda a
 * sexta, exceto nos dias úteis com valor próprio em `porDia`. Funções puras.
 */
import type { DiaUtil, MinimosDia } from '../types'

export const DIAS_UTEIS: readonly DiaUtil[] = [1, 2, 3, 4, 5]

const ehDiaUtil = (d: number): d is DiaUtil => Number.isInteger(d) && d >= 1 && d <= 5
const valido = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

/** Mínimo efetivo no dia da semana `dow` (0 = domingo ... 6 = sábado); fora disso, 0. */
export function minimoDoDia(m: MinimosDia, dow: number): number {
  if (dow === 0) return m.dom
  if (dow === 6) return m.sab
  if (!ehDiaUtil(dow)) return 0
  const v = m.porDia?.[dow]
  return valido(v) ? v : m.util
}

/** Mínimos efetivos de segunda a sexta, nessa ordem. */
export function valoresDosDiasUteis(m: MinimosDia): [number, number, number, number, number] {
  const [a, b, c, d, e] = DIAS_UTEIS.map((dow) => minimoDoDia(m, dow))
  return [a, b, c, d, e]
}

/** Algum dia útil tem mínimo diferente de `util`. */
export function temMinimosPorDia(m: MinimosDia): boolean {
  return DIAS_UTEIS.some((d) => minimoDoDia(m, d) !== m.util)
}

/** Define o mínimo de um dia (dia útil → `porDia`; sábado/domingo → `sab`/`dom`). */
export function definirMinimoPorDia<T extends MinimosDia>(m: T, dow: number, v: number): T {
  const valor = Math.max(0, Math.floor(Number.isFinite(v) ? v : 0))
  if (dow === 0) return { ...m, dom: valor }
  if (dow === 6) return { ...m, sab: valor }
  if (!ehDiaUtil(dow)) return m
  return { ...m, porDia: { ...m.porDia, [dow]: valor } }
}

/** Volta a um único número para segunda a sexta (remove `porDia`). */
export function agruparDiasUteis<T extends MinimosDia>(m: T, valor: number): T {
  const r = { ...m, util: Math.max(0, Math.floor(Number.isFinite(valor) ? valor : 0)) }
  delete r.porDia
  return r
}

/** Valor mais comum entre os dias úteis indicados (padrão: todos); empate → o maior. */
export function minimoMaisComum(m: MinimosDia, dias: readonly number[] = DIAS_UTEIS): number {
  const conta = new Map<number, number>()
  for (const d of dias.filter(ehDiaUtil)) {
    const v = minimoDoDia(m, d)
    conta.set(v, (conta.get(v) ?? 0) + 1)
  }
  let melhor = m.util
  let vezes = 0
  for (const [v, n] of conta) {
    if (n > vezes || (n === vezes && v > melhor)) {
      melhor = v
      vezes = n
    }
  }
  return melhor
}

/**
 * Agrupa os dias úteis indicados (já filtrados pelos abertos) por mínimo, na
 * ordem do primeiro dia de cada grupo.
 */
export function gruposDiasUteis(m: MinimosDia, dias: readonly number[]): { minimo: number; dias: number[] }[] {
  const grupos: { minimo: number; dias: number[] }[] = []
  for (const d of dias) {
    const v = minimoDoDia(m, d)
    const g = grupos.find((x) => x.minimo === v)
    if (g) g.dias.push(d)
    else grupos.push({ minimo: v, dias: [d] })
  }
  return grupos
}
