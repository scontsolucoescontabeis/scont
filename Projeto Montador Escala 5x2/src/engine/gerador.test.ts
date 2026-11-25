import { describe, expect, it } from 'vitest'
import type { CoberturaTurno, Empresa, Funcao, Turno } from '../types'
import { corrigirTudo } from './autocorrecao'
import { horasLiquidasMin, validarEscala } from './conformidade'
import { calcularImpacto } from './impacto'
import { diaDaSemana } from './datas'
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
  return { empresa, funcoes, turnos, cobertura: { t1: cob }, feriados: [], inicio: '2026-12-20', semanas: 4 }
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
          const dow = i % 7 // a escala começa no domingo
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
          const dow = i % 7
          if (dow === 0 || dow === 6) expect(c.tipo, `${p.nome} dia ${i}`).not.toBe('trabalho')
        })
      }
    }
  })

  it('com só o domingo fechado, domingo é DSR para todos', () => {
    const e = base(false, { util: 3, sab: 3, dom: 0 })
    for (const p of gerarPropostas(e)) {
      for (const f of p.escala.funcionarios) {
        expect(p.escala.celulas[f.id][0].tipo, p.nome).not.toBe('trabalho')
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
        expect(horasLiquidasMin(t), p.nome).toBeLessThanOrEqual(8 * 60 + 24)
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

describe('repouso semanal', () => {
  it('toda semana completa tem exatamente 1 DSR e 1 folga por empregado', () => {
    for (const abre of [false, true]) {
      const e = base(abre, { util: 4, sab: 3, dom: abre ? 2 : 0 })
      for (const p of gerarPropostas(e)) {
        for (const f of p.escala.funcionarios) {
          const c = p.escala.celulas[f.id]
          for (let s = 0; s < e.semanas; s++) {
            const sem = c.slice(s * 7, s * 7 + 7).map((x) => x.tipo)
            expect(sem.filter((t) => t === 'dsr'), `${p.nome} ${f.nome} sem ${s}`).toHaveLength(1)
            expect(sem.filter((t) => t === 'folga'), `${p.nome} ${f.nome} sem ${s}`).toHaveLength(1)
          }
        }
      }
    }
  })
})

describe('rodízio de domingos', () => {
  it('aplica a todos: cada empregado folga e trabalha domingos, mesmo após a correção automática', () => {
    const e = base(true, { util: 3, sab: 3, dom: 3 })
    e.funcoes = [{ id: 'atd', nome: 'Atendente', quantidade: 6, jornadaContratual: '44h', horasSemanaisAtuais: 44 }]
    e.semanas = 5
    const cob = coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento)
    const prop = gerarPropostas(e).find((p) => p.modelo === 'rodizio_domingo')!
    const { escala } = corrigirTudo(prop.escala, (x) =>
      validarEscala({ escala: x, cobertura: cob, feriados: [], empresaFuncionaFeriados: false, periodos: e.turnos, compensacaoDiaria: false }),
    )
    for (const f of escala.funcionarios) {
      const dom = [0, 1, 2, 3, 4].map((s) => escala.celulas[f.id][s * 7].tipo)
      expect(dom.includes('dsr'), `${f.nome} ${dom}`).toBe(true)
      expect(dom.includes('trabalho'), `${f.nome} ${dom}`).toBe(true)
    }
  })
})

describe('início da escala', () => {
  it('começa no domingo, mesmo que a data informada seja outro dia', () => {
    const e = base(true, { util: 3, sab: 3, dom: 2 })
    e.inicio = '2026-12-23' // quarta
    for (const p of gerarPropostas(e)) {
      expect(p.escala.inicio, p.nome).toBe('2026-12-20')
      expect(diaDaSemana(p.escala.inicio)).toBe(0)
    }
  })
})

describe('jornada diária gerada', () => {
  it('é de 8h24 líquidas na 1ª etapa (42h÷5) e de 8h na 2ª (40h÷5), com 1h de intervalo', () => {
    const e1 = base(true, { util: 3, sab: 3, dom: 2 })
    for (const p of gerarPropostas(e1)) {
      for (const t of p.escala.turnos) {
        expect(horasLiquidasMin(t), p.nome).toBe(8 * 60 + 24)
        expect(t.intervaloMin).toBe(60)
      }
    }
    const e2 = { ...base(true, { util: 3, sab: 3, dom: 2 }), inicio: '2027-12-19' }
    for (const p of gerarPropostas(e2)) {
      for (const t of p.escala.turnos) expect(horasLiquidasMin(t), p.nome).toBe(8 * 60)
    }
  })
})

describe('horários dentro do funcionamento', () => {
  it('as jornadas de 9h24 ficam entre abertura e fechamento quando cabem', () => {
    const e = base(false, { util: 3, sab: 2, dom: 0 })
    e.empresa.horaAbertura = '08:00'
    e.empresa.horaFechamento = '18:00'
    e.turnos = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '17:24', intervaloMin: 0 }]
    for (const p of gerarPropostas(e)) {
      for (const t of p.escala.turnos) {
        expect(t.inicio >= '08:00' && t.fim <= '18:00', `${p.nome} ${t.nome}`).toBe(true)
      }
    }
  })
})

describe('rodízio de domingos escalonado', () => {
  it('não coloca todos os empregados em DSR no mesmo domingo, mesmo com cobertura baixa', () => {
    const e = base(true, { util: 4, sab: 4, dom: 1 }) // 6 empregados, 1 pessoa exigida no domingo
    e.semanas = 6
    const p = gerarPropostas(e).find((x) => x.modelo === 'rodizio_domingo')!
    const { funcionarios, celulas, inicio } = p.escala
    for (let s = 0; s < 6; s++) {
      const folgas = funcionarios.filter((f) => celulas[f.id][s * 7].tipo !== 'trabalho').length
      expect(folgas, `domingo da semana ${s + 1}`).toBeLessThanOrEqual(Math.ceil(funcionarios.length / 3))
      expect(diaDaSemana(inicio), 'a escala começa no domingo').toBe(0)
    }
    // cada empregado folga ao menos 1 domingo a cada 3 semanas
    for (const f of funcionarios) {
      const dom = [0, 1, 2, 3, 4, 5].map((s) => celulas[f.id][s * 7].tipo === 'trabalho')
      for (let i = 0; i + 2 < dom.length; i++) expect(dom.slice(i, i + 3).every(Boolean), f.nome).toBe(false)
    }
  })
})
