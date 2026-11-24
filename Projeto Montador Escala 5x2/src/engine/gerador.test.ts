import { describe, expect, it } from 'vitest'
import type { CoberturaTurno, Empresa, Funcao, Turno } from '../types'
import { corrigirTudo } from './autocorrecao'
import { horasLiquidasMin, validarEscala } from './conformidade'
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
        periodos: e.turnos,
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
        periodos: e.turnos,
      compensacaoDiaria: false,
    })
    expect(r.alertas.filter((a) => a.regraId.endsWith('repousosSemanais'))).toEqual([])
  })
})

describe('empresa que não funciona no fim de semana', () => {
  it('nunca escala ninguém no sábado/domingo (todas as propostas)', () => {
    const e = base(false, { util: 2, sab: 0, dom: 0 })
    e.empresa.diasFuncionamento = [false, true, true, true, true, true, false]
    for (const p of gerarPropostas({ ...e, funcoes: [{ ...funcoes[0], quantidade: 5 }] })) {
      for (const f of p.escala.funcionarios) {
        p.escala.celulas[f.id].forEach((c, i) => {
          const dow = (i + 1) % 7 // a escala começa na segunda
          if (dow === 0 || dow === 6) expect(c.tipo, `${p.nome} dia ${i}`).not.toBe('trabalho')
        })
      }
    }
  })

  it('continua sem trabalho no fim de semana depois da correção automática', () => {
    const e = base(false, { util: 3, sab: 0, dom: 0 })
    e.empresa.diasFuncionamento = [false, true, true, true, true, true, false]
    const regras = coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento)
    const validar = (x: Parameters<typeof validarEscala>[0]['escala']) =>
      validarEscala({ escala: x, cobertura: regras, feriados: [], empresaFuncionaFeriados: false,
        periodos: e.turnos, compensacaoDiaria: false })
    for (const p of gerarPropostas({ ...e, funcoes: [{ ...funcoes[0], quantidade: 6 }] })) {
      const r = corrigirTudo(p.escala, validar)
      for (const f of r.escala.funcionarios) {
        r.escala.celulas[f.id].forEach((c, i) => {
          const dow = (i + 1) % 7
          if (dow === 0 || dow === 6) expect(c.tipo, `${p.nome} dia ${i}`).not.toBe('trabalho')
        })
      }
    }
  })

  it('com só o domingo fechado, domingo é DSR para todos', () => {
    const e = base(false, { util: 3, sab: 3, dom: 0 })
    for (const p of gerarPropostas(e)) {
      for (const f of p.escala.funcionarios) {
        expect(p.escala.celulas[f.id][6].tipo, p.nome).not.toBe('trabalho')
      }
    }
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

describe('período de cobertura longo (estabelecimento aberto o dia todo)', () => {
  it('ninguém trabalha o período inteiro: jornada ≤ 8h, interjornada ok e cobertura mantida', () => {
    const e = base(true, { util: 2, sab: 2, dom: 2 })
    e.empresa.horaAbertura = '06:00'
    e.empresa.horaFechamento = '23:00'
    e.turnos = [{ id: 't1', nome: 'Dia todo', inicio: '06:00', fim: '23:00', intervaloMin: 0 }]
    e.funcoes = [{ id: 'atd', nome: 'Atendente', quantidade: 10, jornadaContratual: '44h', horasSemanaisAtuais: 44 }]
    for (const p of gerarPropostas(e)) {
      for (const t of p.escala.turnos) {
        expect(horasLiquidasMin(t), p.nome).toBeLessThanOrEqual(8 * 60)
      }
      const r = validarEscala({
        escala: p.escala,
        cobertura: coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento),
        feriados: [],
        empresaFuncionaFeriados: false,
        periodos: e.turnos,
        compensacaoDiaria: false,
      })
      const graves = r.alertas.filter((a) =>
        ['jornadaDiariaMax', 'interjornadaMinHoras', 'intrajornada'].includes(a.regraId),
      )
      expect(graves, p.nome).toEqual([])
      expect(p.escala.turnos.length, p.nome).toBeGreaterThan(1)
    }
  })
})
