import { describe, expect, it } from 'vitest'
import type { Empresa, Funcao, Turno } from '../types'
import { CUSTO_PADRAO } from './impacto'
import { calcularQuadro } from './contratacoes'

const turno: Turno = { id: 't1', nome: 'Comercial', inicio: '08:00', fim: '17:00', intervaloMin: 60 } // 8h
const empresa = (dias: boolean[]): Empresa => ({
  nome: 'X',
  setor: '',
  diasFuncionamento: dias,
  horaAbertura: '08:00',
  horaFechamento: '17:00',
  funcionaFeriados: false,
  acordoColetivo: 'nao',
  compensacaoDiaria: false,
})
const seisDias = [false, true, true, true, true, true, true] // seg–sáb
const funcoes = (q: number, sal?: number): Funcao[] => [
  { id: 'a', nome: 'Atendente', quantidade: q, jornadaContratual: '44h', horasSemanaisAtuais: 44, salarioBase: sal },
]

describe('quadro de contratações', () => {
  it('2 pessoas por dia, seg–sáb: 12 presenças/semana → 3 pessoas na 5x2 (2 na 6x1)', () => {
    const q = calcularQuadro(
      { empresa: empresa(seisDias), funcoes: funcoes(2), turnos: [turno], cobertura: { t1: { util: 2, sab: 2, dom: 0 } }, custo: CUSTO_PADRAO },
      'etapa1',
    )
    expect(q.linhasTurno[0].presencasSemana).toBe(12)
    expect(q.linhasTurno[0].necessarios).toBe(3)
    expect(q.linhasTurno[0].necessariosNa6x1).toBe(2)
    expect(q.contratar).toBe(1)
    expect(q.porFuncao[0].sugerido).toBe(3)
  })

  it('equipe suficiente: nada a contratar', () => {
    const q = calcularQuadro(
      { empresa: empresa(seisDias), funcoes: funcoes(5), turnos: [turno], cobertura: { t1: { util: 2, sab: 2, dom: 0 } }, custo: CUSTO_PADRAO },
      'etapa1',
    )
    expect(q.contratar).toBe(0)
  })

  it('calcula custo com salário informado e deixa nulo sem salário', () => {
    const base = { empresa: empresa(seisDias), turnos: [turno], cobertura: { t1: { util: 2, sab: 2, dom: 0 } }, custo: CUSTO_PADRAO }
    expect(calcularQuadro({ ...base, funcoes: funcoes(2, 2000) }, 'etapa1').custoMensal).toBeCloseTo(2000 * 1.7, 5)
    expect(calcularQuadro({ ...base, funcoes: funcoes(2) }, 'etapa1').custoMensal).toBeNull()
  })

  it('período de 10h na etapa 2 (40h): pessoa cumpre 8h+1h, então precisa de mais pessoa-dia que o período', () => {
    const t9: Turno = { id: 't1', nome: 'Longo', inicio: '07:00', fim: '17:00', intervaloMin: 60 }
    const q = calcularQuadro(
      { empresa: empresa(seisDias), funcoes: funcoes(2), turnos: [t9], cobertura: { t1: { util: 2, sab: 2, dom: 0 } }, custo: CUSTO_PADRAO },
      'etapa2',
    )
    expect(q.linhasTurno[0].turnosPorPessoa).toBe(5)
    expect(q.linhasTurno[0].presencasSemana).toBe(14)
    expect(q.linhasTurno[0].necessarios).toBe(3)
  })
})
