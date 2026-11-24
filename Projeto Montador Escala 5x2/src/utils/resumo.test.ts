import { describe, expect, it } from 'vitest'
import type { DiaEscala, Escala, Turno } from '../types'
import { diasPreVigencia, minutosNoturnos, resumoAlertas, resumoPorEmpregado } from './resumo'

const T: Turno = { id: 't', nome: 'x', inicio: '14:00', fim: '22:45', intervaloMin: 60 }
const t: DiaEscala = { tipo: 'trabalho', turnoId: 't' }
const f: DiaEscala = { tipo: 'folga' }
const d: DiaEscala = { tipo: 'dsr' }

function escala(linha: DiaEscala[]): Escala {
  return {
    inicio: '2026-12-20',
    dias: linha.length,
    turnos: [T],
    funcionarios: [{ id: 'a', nome: 'A', funcaoId: 'x' }],
    celulas: { a: linha },
  }
}

describe('resumo do relatório', () => {
  it('conta minutos noturnos (22h–5h)', () => {
    expect(minutosNoturnos(T)).toBe(45)
    expect(minutosNoturnos({ ...T, inicio: '08:00', fim: '17:00' })).toBe(0)
  })

  it('horas por semana, teto, maior sequência e repousos seguidos', () => {
    // semana 1: DSR dom, T seg-sex... folga sáb (repousos seguidos: sáb+dom da próxima? aqui dom e sáb)
    const sem1 = [d, t, t, t, t, t, f] // 5 dias × 7h45
    const sem2 = [d, t, t, t, f, t, t]
    const r = resumoPorEmpregado(escala([...sem1, ...sem2]))[0]
    expect(r.horasSemana[0]).toBeCloseTo(5 * 7.75, 5)
    expect(r.tetoSemana).toEqual([42, 42])
    expect(r.maiorSequencia).toBe(5)
    expect(r.minutosNoturnosDia).toBe(45)
    // semana 1: dom e sáb não são adjacentes dentro da semana, mas sáb→dom da semana 2 sim
    expect(r.semanasRepousoSeguido).toBeGreaterThanOrEqual(1)
  })

  it('agrupa alertas por motivo e marca dias de pré-vigência', () => {
    const r = resumoAlertas({
      semaforo: 'amarelo',
      contagem: { vermelho: 0, amarelo: 3 },
      alertas: ['A', 'A', 'B'].map((titulo, i) => ({
        id: String(i), regraId: 'cobertura', severidade: 'amarelo' as const, titulo, mensagem: '', sugestao: '',
      })),
    })
    expect(r).toEqual([
      { nivel: 'amarelo', titulo: 'A', quantidade: 2 },
      { nivel: 'amarelo', titulo: 'B', quantidade: 1 },
    ])
    expect(diasPreVigencia(['2026-12-13', '2026-12-15', '2026-12-16'])).toEqual(['2026-12-13', '2026-12-15'])
  })
})
