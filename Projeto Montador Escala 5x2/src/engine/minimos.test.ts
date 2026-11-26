import { describe, expect, it } from 'vitest'
import type { MinimosDia } from '../types'
import {
  agruparDiasUteis,
  definirMinimoPorDia,
  minimoDoDia,
  minimoMaisComum,
  temMinimosPorDia,
  valoresDosDiasUteis,
} from './minimos'

const base: MinimosDia = { util: 2, sab: 3, dom: 1 }

describe('minimoDoDia', () => {
  it('sem porDia: seg–sex = util, sábado = sab, domingo = dom', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => minimoDoDia(base, d))).toEqual([1, 2, 2, 2, 2, 2, 3])
  })

  it('porDia sobrepõe só o dia informado', () => {
    const m: MinimosDia = { ...base, porDia: { 3: 4, 5: 0 } }
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => minimoDoDia(m, d))).toEqual([1, 2, 2, 4, 2, 0, 3])
  })

  it('ignora chaves e valores inválidos', () => {
    const m = { ...base, porDia: { 0: 9, 6: 9, 7: 9, 2: Number.NaN, 4: -1 } } as unknown as MinimosDia
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => minimoDoDia(m, d))).toEqual([1, 2, 2, 2, 2, 2, 3])
    expect(minimoDoDia(m, 9)).toBe(0)
  })
})

describe('temMinimosPorDia', () => {
  it('falso sem porDia ou com valores iguais ao util', () => {
    expect(temMinimosPorDia(base)).toBe(false)
    expect(temMinimosPorDia({ ...base, porDia: {} })).toBe(false)
    expect(temMinimosPorDia({ ...base, porDia: { 1: 2, 5: 2 } })).toBe(false)
  })

  it('verdadeiro quando algum dia difere', () => {
    expect(temMinimosPorDia({ ...base, porDia: { 5: 4 } })).toBe(true)
  })

  it('chaves inválidas não contam', () => {
    expect(temMinimosPorDia({ ...base, porDia: { 6: 9 } } as unknown as MinimosDia)).toBe(false)
  })
})

describe('definirMinimoPorDia', () => {
  it('define o valor do dia útil e preserva os demais', () => {
    const m = definirMinimoPorDia({ ...base, porDia: { 1: 3 } }, 5, 4)
    expect(m).toEqual({ ...base, porDia: { 1: 3, 5: 4 } })
  })

  it('mantém valores explícitos mesmo iguais ao util', () => {
    expect(definirMinimoPorDia(base, 2, 2)).toEqual({ ...base, porDia: { 2: 2 } })
  })

  it('arredonda para baixo e não aceita negativo', () => {
    expect(definirMinimoPorDia(base, 3, -2).porDia?.[3]).toBe(0)
    expect(definirMinimoPorDia(base, 3, 2.7).porDia?.[3]).toBe(2)
  })

  it('sábado e domingo mudam sab/dom', () => {
    expect(definirMinimoPorDia(base, 6, 5)).toEqual({ ...base, sab: 5 })
    expect(definirMinimoPorDia(base, 0, 0)).toEqual({ ...base, dom: 0 })
  })

  it('não altera o objeto original', () => {
    const m: MinimosDia = { ...base, porDia: { 1: 3 } }
    definirMinimoPorDia(m, 1, 9)
    expect(m.porDia).toEqual({ 1: 3 })
  })
})

describe('agruparDiasUteis', () => {
  it('define util e remove porDia, preservando o resto', () => {
    const m = agruparDiasUteis({ ...base, porDia: { 5: 4 }, porFuncao: { a: base } } as MinimosDia, 3)
    expect(m).toEqual({ util: 3, sab: 3, dom: 1, porFuncao: { a: base } })
    expect('porDia' in m).toBe(false)
  })
})

describe('valoresDosDiasUteis e minimoMaisComum', () => {
  it('lista seg..sex com os valores efetivos', () => {
    expect(valoresDosDiasUteis({ ...base, porDia: { 5: 4 } })).toEqual([2, 2, 2, 2, 4])
  })

  it('mais comum entre os dias abertos; empate fica com o maior', () => {
    const m: MinimosDia = { ...base, porDia: { 1: 3, 2: 3, 5: 4 } }
    expect(minimoMaisComum(m)).toBe(3)
    expect(minimoMaisComum({ ...base, porDia: { 1: 4 } }, [1, 2])).toBe(4)
    expect(minimoMaisComum(base, [])).toBe(2)
  })
})
