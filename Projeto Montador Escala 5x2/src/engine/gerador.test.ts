import { describe, expect, it } from 'vitest'
import type { CoberturaTurno, Empresa, Funcao, Turno } from '../types'
import { validarEscala } from './conformidade'
import { calcularImpacto } from './impacto'
import { coberturaParaRegras, gerarPropostas, type EntradaGerador } from './gerador'

const turnos: Turno[] = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '17:00', intervaloMin: 60 }]
const funcoes: Funcao[] = [
  { id: 'atd', nome: 'Atendente', quantidade: 6, jornadaContratual: '44h', horasSemanaisAtuais: 44, salarioBase: 2000 },
]

function base(abreDomingo: boolean, cob: CoberturaTurno): EntradaGerador {
  const empresa: Empresa = {
    nome: 'Loja Teste',
    setor: 'Varejo',
    diasFuncionamento: [abreDomingo, true, true, true, true, true, true],
    horaAbertura: '08:00',
    horaFechamento: '17:00',
    funcionaFeriados: false,
    acordoColetivo: 'nao',
    compensacaoDiaria: false,
  }
  return { empresa, funcoes, turnos, cobertura: { t1: cob }, feriados: [], inicio: '2026-12-21', semanas: 4 }
}

describe('gerador de propostas', () => {
  it('gera 3 propostas sem violações legais vermelhas (empresa fecha domingo)', () => {
    const e = base(false, { util: 4, sab: 3, dom: 0 })
    const props = gerarPropostas(e)
    expect(props).toHaveLength(3)
    for (const p of props) {
      const r = validarEscala({
        escala: p.escala,
        cobertura: coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento),
        feriados: [],
        empresaFuncionaFeriados: false,
        compensacaoDiaria: false,
      })
      expect(r.alertas.filter((a) => a.severidade === 'vermelho'), p.nome).toEqual([])
    }
  })

  it('cobre domingo no rodízio e mantém 2 repousos por semana', () => {
    const e = base(true, { util: 4, sab: 4, dom: 2 })
    const p = gerarPropostas(e).find((x) => x.modelo === 'rodizio_domingo')!
    const r = validarEscala({
      escala: p.escala,
      cobertura: coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento),
      feriados: [],
      empresaFuncionaFeriados: false,
      compensacaoDiaria: false,
    })
    expect(r.alertas.filter((a) => a.regraId.endsWith('repousosSemanais'))).toEqual([])
  })
})

describe('calculadora de impacto', () => {
  it('44h -> 42h na etapa 1: déficit de 2h por pessoa', () => {
    const r = calcularImpacto(funcoes, 'etapa1')
    expect(r.rotulo).toBe('ESTIMATIVA')
    expect(r.deficitHorasSemana).toBe(12)
    expect(r.contratacoesEquivalentes).toBeCloseTo(12 / 42, 5)
    expect(r.custoMensalContratando!).toBeGreaterThan(r.custoMensalAtual!)
    expect(r.custoMensalHoraExtra!).toBeGreaterThan(r.custoMensalAtual!)
  })

  it('sem salário informado, custos ficam nulos', () => {
    const r = calcularImpacto([{ ...funcoes[0], salarioBase: undefined }], 'etapa2')
    expect(r.custoMensalAtual).toBeNull()
    expect(r.deficitHorasSemana).toBe(24)
  })
})
