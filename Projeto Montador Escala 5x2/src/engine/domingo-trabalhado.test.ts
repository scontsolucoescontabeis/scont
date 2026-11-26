import { describe, expect, it } from 'vitest'
import type { DiaEscala, Escala } from '../types'
import { validarEscala } from './conformidade'

const T: DiaEscala = { tipo: 'trabalho', turnoId: 't' }
const F: DiaEscala = { tipo: 'folga' }
const D: DiaEscala = { tipo: 'dsr' }

function escala(dias: DiaEscala[]): Escala {
  return {
    inicio: '2026-12-20', // domingo
    dias: dias.length,
    funcionarios: [{ id: 'f', nome: 'Ana', funcaoId: 'x', sexo: 'F' }],
    turnos: [{ id: 't', nome: '08:00–17:24', inicio: '08:00', fim: '17:24', intervaloMin: 60 }],
    celulas: { f: dias },
  }
}
const alertas = (e: Escala) =>
  validarEscala({ escala: e, cobertura: [], feriados: [], empresaFuncionaFeriados: false, compensacaoDiaria: false }).alertas

describe('domingo trabalhado', () => {
  it('trabalhar no domingo com DSR + folga na semana e domingo de folga a cada 2 semanas não gera alerta', () => {
    //          dom seg ter qua qui sex sáb | dom seg ter qua qui sex sáb
    const e = escala([T, T, T, T, T, F, D, D, T, T, T, T, T, F])
    expect(alertas(e)).toEqual([])
  })

  it('domingo trabalhado numa semana sem nenhum dia de descanso continua alertando', () => {
    const e = escala([T, T, T, T, T, T, T, D, F, T, T, T, T, T])
    const a = alertas(e).filter((x) => x.regraId === 'domingoFeriadoTrabalhado')
    expect(a).toHaveLength(1)
    expect(a[0].mensagem).toContain('sem nenhum dia de descanso na semana')
  })
})
