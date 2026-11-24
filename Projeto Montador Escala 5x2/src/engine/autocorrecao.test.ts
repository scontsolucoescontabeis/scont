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
  // Escreva a semana como seg..dom; a escala usa semana domingo..sábado.
  linhas = linhas.map((l) => {
    const r: string[] = []
    for (let i = 0; i < l.length; i += 7) r.push(l[i + 6], ...l.slice(i, i + 6))
    return r
  })
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
    const e = esc('2026-12-20', [[...seis, ...seis, ...seis]], [T6])
    const antes = validar(e)
    expect(antes.alertas.some((a) => a.regraId === 'etapa1.repousosSemanais')).toBe(true)
    const r = corrigirTudo(e, validar)
    expect(r.aplicadas).toBeGreaterThan(0)
    expect(validar(r.escala).alertas.some((a) => a.regraId === 'etapa1.repousosSemanais')).toBe(false)
  })

  it('corrige interjornada e nunca piora a pontuação', () => {
    const e = esc('2026-12-20', [['tt', 't8', 'F', 'F', 'F', 'F', 'D']], [TT, T8])
    const r = corrigirTudo(e, validar)
    expect(validar(r.escala).alertas.some((a) => a.regraId === 'interjornadaMinHoras')).toBe(false)
    expect(pontuacao(validar(r.escala))).toBeLessThanOrEqual(pontuacao(validar(e)))
  })

  it('não altera escala já conforme', () => {
    const e = esc('2026-12-20', [['t8', 't8', 't8', 't8', 't8', 'F', 'D']], [T8])
    const r = corrigirTudo(e, validar)
    expect(r.aplicadas).toBe(0)
    expect(r.escala).toBe(e)
  })

  it('aplica a troca do domingo mesmo criando furo de cobertura, sem entrar em ciclo', () => {
    // 2 pessoas, domingo exige 2: ambas trabalham domingo e folgam seg/ter -> sem descanso no domingo
    const a = ['F', 'F', 't8', 't8', 't8', 't8', 't8']
    const e = esc('2026-12-20', [a, a], [T8])
    const cobertura = [{ id: 'c', turnoId: 't8', minimo: 2, diasSemana: [0] }]
    const v = (x: Escala) =>
      validarEscala({ escala: x, cobertura, feriados: [], empresaFuncionaFeriados: true, compensacaoDiaria: false })
    expect(v(e).alertas.some((x) => x.regraId === 'etapa1.repousoPreferencialDomingo')).toBe(true)
    const r = corrigirTudo(e, v)
    const depois = v(r.escala)
    // a 1ª troca vira furo amarelo (1 de 2); a 2ª deixaria o domingo vazio (vermelho) e é recusada
    expect(r.aplicadas).toBe(1)
    expect(depois.alertas.filter((x) => x.regraId === 'cobertura')[0].severidade).toBe('amarelo')
    expect(depois.contagem.vermelho).toBe(0)
  })
})
