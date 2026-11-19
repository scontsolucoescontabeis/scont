import { describe, expect, it } from 'vitest'
import type { DiaEscala, Escala, Turno } from '../types'
import { validarEscala } from './conformidade'
import { corrigirTudo, pontuacao } from './autocorrecao'

const T6: Turno = { id: 't6', nome: 'Seis por um', inicio: '08:00', fim: '16:20', intervaloMin: 60 }
const TT: Turno = { id: 'tt', nome: 'Tarde', inicio: '14:00', fim: '23:00', intervaloMin: 60 }
const T8: Turno = { id: 't8', nome: 'Comercial', inicio: '08:00', fim: '17:00', intervaloMin: 60 }

function esc(inicio: string, linhas: string[][], turnos: Turno[]): Escala {
  const conv = (c: string): DiaEscala =>
    c === 'F' ? { tipo: 'folga' } : c === 'D' ? { tipo: 'dsr' } : { tipo: 'trabalho', turnoId: c }
  return {
    inicio,
    dias: linhas[0].length,
    turnos,
    funcionarios: linhas.map((_, i) => ({ id: `f${i}`, nome: `F${i}`, funcaoId: 'x' })),
    celulas: Object.fromEntries(linhas.map((l, i) => [`f${i}`, l.map(conv)])),
  }
}

const validar = (e: Escala) =>
  validarEscala({ escala: e, cobertura: [], feriados: [], empresaFuncionaFeriados: true, compensacaoDiaria: false })

describe('correção automática em cadeia', () => {
  it('corrige falta de repouso em todas as semanas', () => {
    const seis = ['t6', 't6', 't6', 't6', 't6', 't6', 'F']
    const e = esc('2026-12-21', [[...seis, ...seis, ...seis]], [T6])
    const antes = validar(e)
    expect(antes.alertas.some((a) => a.regraId === 'etapa1.repousosSemanais')).toBe(true)
    const r = corrigirTudo(e, validar)
    expect(r.aplicadas).toBeGreaterThan(0)
    expect(validar(r.escala).alertas.some((a) => a.regraId === 'etapa1.repousosSemanais')).toBe(false)
  })

  it('corrige interjornada e nunca piora a pontuação', () => {
    const e = esc('2026-12-21', [['tt', 't8', 'F', 'F', 'F', 'F', 'D']], [TT, T8])
    const r = corrigirTudo(e, validar)
    expect(validar(r.escala).alertas.some((a) => a.regraId === 'interjornadaMinHoras')).toBe(false)
    expect(pontuacao(validar(r.escala))).toBeLessThanOrEqual(pontuacao(validar(e)))
  })

  it('não altera escala já conforme', () => {
    const e = esc('2026-12-21', [['t8', 't8', 't8', 't8', 't8', 'F', 'D']], [T8])
    const r = corrigirTudo(e, validar)
    expect(r.aplicadas).toBe(0)
    expect(r.escala).toBe(e)
  })
})
