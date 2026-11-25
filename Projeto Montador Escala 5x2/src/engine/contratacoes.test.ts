import { describe, expect, it } from 'vitest'
import { REGRAS_PESSOAIS_PADRAO } from '../config/regras'
import type { CoberturaTurno, Empresa, Funcao, PessoaEscala, Turno } from '../types'
import { validarEscala } from './conformidade'
import { CUSTO_PADRAO } from './impacto'
import { calcularQuadro } from './contratacoes'
import { coberturaParaRegras, gerarPropostas, type EntradaGerador } from './gerador'

const turno: Turno = { id: 't1', nome: 'Comercial', inicio: '08:00', fim: '17:00', intervaloMin: 60 } // 8h
const empresa = (dias: boolean[], abre = '08:00', fecha = '17:00'): Empresa => ({
  nome: 'X',
  setor: '',
  diasFuncionamento: dias,
  horaAbertura: abre,
  horaFechamento: fecha,
  funcionaFeriados: false,
  acordoColetivo: 'nao',
  compensacaoDiaria: false,
})
const seisDias = [false, true, true, true, true, true, true] // seg–sáb
const cincoDias = [false, true, true, true, true, true, false] // seg–sex
const seteDias = [true, true, true, true, true, true, true]
const funcoes = (q: number, sal?: number, horas = 44): Funcao[] => [
  { id: 'a', nome: 'Atendente', quantidade: q, jornadaContratual: '44h', horasSemanaisAtuais: horas, salarioBase: sal },
]
const periodo = (id: string, inicio: string, fim: string): Turno => ({ id, nome: `${inicio}–${fim}`, inicio, fim, intervaloMin: 0 })
const todos = (m: number): CoberturaTurno => ({ util: m, sab: m, dom: m })
function pessoa(id: string, extra: Partial<PessoaEscala> = {}): PessoaEscala {
  return { id, nome: `P${id}`, escalar: true, jornadaPadrao: false, menor: false, estagiario: false, ferias: [], ...extra }
}
const nominal = (id: string, pessoas: PessoaEscala[]): Funcao => ({
  id,
  nome: id,
  quantidade: pessoas.filter((p) => p.escalar).length,
  jornadaContratual: '44h',
  horasSemanaisAtuais: 44,
  pessoas,
})

describe('quadro de contratações', () => {
  it('2 pessoas por dia, seg–sáb: 12 turnos/semana → 3 pessoas na 5x2 (2 na 6x1)', () => {
    const q = calcularQuadro(
      { empresa: empresa(seisDias), funcoes: funcoes(2), turnos: [turno], cobertura: { t1: { util: 2, sab: 2, dom: 0 } }, custo: CUSTO_PADRAO },
      'etapa1',
    )
    expect(q.linhasTurno[0].presencasSemana).toBe(12)
    expect(q.linhasTurno[0].necessarios).toBe(3)
    expect(q.linhasTurno[0].necessariosNa6x1).toBe(2)
    expect(q.turnosSemana).toBe(12)
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

  it('período de 10h na etapa 2 (jornada 8h+1h): precisa de 2 camadas (entrada 07:00 e 08:00)', () => {
    // Antes (pessoa-hora) dava 14 pessoa-dia e 3 pessoas — errado: uma jornada de 9h não cobre 10h.
    const t9: Turno = { id: 't1', nome: 'Longo', inicio: '07:00', fim: '17:00', intervaloMin: 60 }
    const q = calcularQuadro(
      { empresa: empresa(seisDias), funcoes: funcoes(2), turnos: [t9], cobertura: { t1: { util: 2, sab: 2, dom: 0 } }, custo: CUSTO_PADRAO },
      'etapa2',
    )
    expect(q.linhasTurno[0].turnosPorPessoa).toBe(5)
    expect(q.linhasTurno[0].presencasSemana).toBe(24)
    expect(q.linhasTurno[0].necessarios).toBe(6)
  })

  it('(a) período 08–12 com mínimo 3 em 5 dias: 15 turnos inteiros → 3 pessoas (não 2)', () => {
    const q = calcularQuadro(
      {
        empresa: empresa(cincoDias, '08:00', '12:00'),
        funcoes: funcoes(0),
        turnos: [periodo('p', '08:00', '12:00')],
        cobertura: { p: { util: 3, sab: 0, dom: 0 } },
        custo: CUSTO_PADRAO,
      },
      'etapa1',
    )
    expect(q.turnosSemana).toBe(15)
    expect(q.necessarioTotal).toBe(3)
    expect(q.contratar).toBe(3)
  })

  it('(b) janela 08–20 com mínimo 3, 7 dias: 42 turnos em 2 camadas → 10 pessoas (nunca a resposta antiga)', () => {
    const q = calcularQuadro(
      {
        empresa: empresa(seteDias, '08:00', '20:00'),
        funcoes: funcoes(0),
        turnos: [periodo('p', '08:00', '20:00')],
        cobertura: { p: todos(3) },
        custo: CUSTO_PADRAO,
      },
      'etapa1',
    )
    expect(q.turnosSemana).toBe(42)
    // ceil(42/5) = 9 só bastaria se cada pessoa trocasse de horário entre os dias; o gerador dá a cada
    // pessoa um horário fixo, então cada camada (08:00 e 10:30, 21 turnos cada) precisa de 5 pessoas.
    expect(q.necessarioTotal).toBe(10)
    // Fórmula antiga: ceil(21 × 12h ÷ 9h24) = 27 pessoa-dia → 6 pessoas.
    expect(q.necessarioTotal).toBeGreaterThan(6)
  })

  it('(c) períodos vizinhos 08–12 (3) e 12–20 (2): o total sai do perfil combinado', () => {
    const q = calcularQuadro(
      {
        empresa: empresa(cincoDias, '08:00', '20:00'),
        funcoes: funcoes(0),
        turnos: [periodo('m', '08:00', '12:00'), periodo('t', '12:00', '20:00')],
        cobertura: { m: { util: 3, sab: 0, dom: 0 }, t: { util: 2, sab: 0, dom: 0 } },
        custo: CUSTO_PADRAO,
      },
      'etapa1',
    )
    // 3 entram às 08:00 (cobrem até 17:24) e 2 às 10:30 (cobrem a noite) → 25 turnos, 5 pessoas.
    expect(q.turnosSemana).toBe(25)
    expect(q.necessarioTotal).toBe(5)
  })

  it('(c) turnos compartilhados: 08–12 (2) e 12–17 (2) cabem nas mesmas 2 pessoas', () => {
    const q = calcularQuadro(
      {
        empresa: empresa(cincoDias, '08:00', '17:00'),
        funcoes: funcoes(0),
        turnos: [periodo('m', '08:00', '12:00'), periodo('t', '12:00', '17:00')],
        cobertura: { m: { util: 2, sab: 0, dom: 0 }, t: { util: 2, sab: 0, dom: 0 } },
        custo: CUSTO_PADRAO,
      },
      'etapa1',
    )
    expect(q.linhasTurno.map((l) => l.necessarios)).toEqual([2, 2])
    expect(q.necessarioTotal).toBe(2)
    expect(q.turnosSemana).toBe(10)
  })

  it('(d) equipe de 6 em tempo integral e necessidade de 10 → contratar 4', () => {
    const q = calcularQuadro(
      {
        empresa: empresa(seteDias, '08:00', '20:00'),
        funcoes: funcoes(6),
        turnos: [periodo('p', '08:00', '20:00')],
        cobertura: { p: todos(3) },
        custo: CUSTO_PADRAO,
      },
      'etapa1',
    )
    expect(q.equipeAtual).toBe(6)
    expect(q.equipeEquivalente).toBe(6)
    expect(q.contratar).toBe(4)
  })

  it('(d) equipe de 6 e necessidade de 9 (seg–sáb, 08–17, mínimo 7) → contratar 3', () => {
    // 6 dias × 7 = 42 turnos, 1 camada → ceil(42/5) = 9.
    const q = calcularQuadro(
      { empresa: empresa(seisDias), funcoes: funcoes(6), turnos: [turno], cobertura: { t1: { util: 7, sab: 7, dom: 0 } }, custo: CUSTO_PADRAO },
      'etapa1',
    )
    expect(q.necessarioTotal).toBe(9)
    expect(q.contratar).toBe(3)
  })

  it('(e) 3 efetivos + 3 estagiários (30h) valem ≈ 5,1 em tempo integral', () => {
    const f = nominal('a', [
      pessoa('1'),
      pessoa('2'),
      pessoa('3'),
      pessoa('4', { estagiario: true }),
      pessoa('5', { estagiario: true, horasSemanais: 44 }), // nem com 44h cadastradas passa do limite do estágio
      pessoa('6', { estagiario: true }),
      pessoa('7', { escalar: false }),
    ])
    const q = calcularQuadro(
      { empresa: empresa(seisDias), funcoes: [f], turnos: [turno], cobertura: { t1: { util: 7, sab: 7, dom: 0 } }, custo: CUSTO_PADRAO },
      'etapa1',
    )
    expect(q.equipeAtual).toBe(6)
    expect(q.equipeEquivalente).toBeCloseTo(5.1, 5)
    expect(q.contratar).toBe(4) // ceil(9 − 5,14)
  })

  it('(f) pessoas com 22h semanais contam ≈ metade', () => {
    const q = calcularQuadro(
      { empresa: empresa(seisDias), funcoes: funcoes(4, undefined, 22), turnos: [turno], cobertura: { t1: { util: 2, sab: 2, dom: 0 } }, custo: CUSTO_PADRAO },
      'etapa1',
    )
    expect(q.equipeAtual).toBe(4)
    expect(q.equipeEquivalente).toBeCloseTo(2.1, 5) // 4 × 22/42
    expect(q.contratar).toBe(1) // ceil(3 − 2,1)
  })

  it('(g) mínimo próprio de uma função força contratação nela', () => {
    const fs: Funcao[] = [
      { id: 'a', nome: 'Atendente', quantidade: 6, jornadaContratual: '44h', horasSemanaisAtuais: 44 },
      { id: 'g', nome: 'Gerente', quantidade: 1, jornadaContratual: '44h', horasSemanaisAtuais: 44 },
    ]
    const q = calcularQuadro(
      {
        empresa: empresa(seisDias),
        funcoes: fs,
        turnos: [turno],
        cobertura: { t1: { util: 3, sab: 3, dom: 0, porFuncao: { g: { util: 1, sab: 1, dom: 0 } } } },
        custo: CUSTO_PADRAO,
      },
      'etapa1',
    )
    // Total: 18 turnos → 4 pessoas (a equipe de 7 basta); gerente: 6 turnos → 2 pessoas, há 1.
    expect(q.necessarioTotal).toBe(4)
    expect(q.porFuncao.find((p) => p.funcaoId === 'g')!.contratar).toBe(1)
    expect(q.porFuncao.find((p) => p.funcaoId === 'a')!.contratar).toBe(0)
    expect(q.contratar).toBe(1)
  })

  it('(h) art. 386: 5 mulheres cobrindo 3 no domingo precisam de reforço só com a regra ligada', () => {
    const mulheres = nominal('a', ['1', '2', '3', '4', '5'].map((id) => pessoa(id, { sexo: 'F' })))
    const base = {
      empresa: empresa(seteDias),
      funcoes: [mulheres],
      turnos: [turno],
      cobertura: { t1: todos(3) },
      custo: CUSTO_PADRAO,
    }
    const desligado = calcularQuadro(base, 'etapa1', undefined, { ...REGRAS_PESSOAIS_PADRAO, mulheresDomingoQuinzenal: false })
    expect(desligado.necessarioTotal).toBe(5)
    expect(desligado.contratar).toBe(0)
    expect(desligado.extraDomingo).toBe(0)
    expect(desligado.observacoes.join(' ')).not.toMatch(/386/)

    const ligado = calcularQuadro(base, 'etapa1', undefined, { ...REGRAS_PESSOAIS_PADRAO, mulheresDomingoQuinzenal: true })
    // Cada domingo folgam ceil(5/2) = 3 mulheres; só 2 trabalham. Com +1 pessoa (ciclo do setor) chega a 3.
    expect(ligado.extraDomingo).toBe(1)
    expect(ligado.contratar).toBe(1)
    expect(ligado.observacoes.join(' ')).toMatch(/art\. 386/)
    // Padrão = regra ligada.
    expect(calcularQuadro(base, 'etapa1').contratar).toBe(1)
  })

  it('rodízio de domingos (Lei 10.101): mínimo 5 em 7 dias exige 8 pessoas, não 7', () => {
    const q = calcularQuadro(
      { empresa: empresa(seteDias), funcoes: funcoes(0), turnos: [turno], cobertura: { t1: todos(5) }, custo: CUSTO_PADRAO },
      'etapa1',
    )
    expect(q.turnosSemana).toBe(35)
    expect(q.necessarioTotal).toBe(8)
  })

  it('sem cobertura informada não pede ninguém', () => {
    const q = calcularQuadro(
      { empresa: empresa(seisDias), funcoes: funcoes(2), turnos: [turno], cobertura: {}, custo: CUSTO_PADRAO },
      'etapa1',
    )
    expect(q.necessarioTotal).toBe(0)
    expect(q.contratar).toBe(0)
  })
})

describe('(i) quadro × gerador: com a equipe sugerida a escala cobre; com 1 a menos, não', () => {
  type Cenario = { nome: string; periodos: Turno[]; cob: Record<string, CoberturaTurno>; abre: string; fecha: string; domingo: boolean }
  const cenarios: Cenario[] = []
  for (const [abre, fecha] of [
    ['08:00', '12:00'],
    ['08:00', '18:00'],
    ['08:00', '20:00'],
  ]) {
    for (const m of [1, 2, 3, 4]) {
      for (const domingo of [false, true]) {
        cenarios.push({
          nome: `${abre}–${fecha}, mínimo ${m}, domingo ${domingo ? 'aberto' : 'fechado'}`,
          periodos: [periodo('p', abre, fecha)],
          cob: { p: { util: m, sab: m, dom: domingo ? m : 0 } },
          abre,
          fecha,
          domingo,
        })
      }
    }
  }
  cenarios.push(
    {
      nome: '08–12 (3) + 12–20 (2), domingo fechado',
      periodos: [periodo('m', '08:00', '12:00'), periodo('t', '12:00', '20:00')],
      cob: { m: { util: 3, sab: 3, dom: 0 }, t: { util: 2, sab: 2, dom: 0 } },
      abre: '08:00',
      fecha: '20:00',
      domingo: false,
    },
    {
      nome: '08–12 (2) + 12–18 (3), domingo aberto',
      periodos: [periodo('m', '08:00', '12:00'), periodo('t', '12:00', '18:00')],
      cob: { m: todos(2), t: todos(3) },
      abre: '08:00',
      fecha: '18:00',
      domingo: true,
    },
  )

  const empresaDe = (c: Cenario): Empresa => ({
    ...empresa([c.domingo, true, true, true, true, true, true], c.abre, c.fecha),
    setor: 'Varejo',
    funcionaFeriados: true,
  })

  /** Menor nº de alertas de cobertura entre as 3 propostas do gerador. */
  function faltasCobertura(c: Cenario, n: number): number {
    const e: EntradaGerador = {
      empresa: empresaDe(c),
      funcoes: funcoes(n),
      turnos: c.periodos,
      cobertura: c.cob,
      feriados: [],
      inicio: '2026-12-20', // 1ª etapa (42h)
      semanas: 6,
    }
    const regras = coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento)
    return Math.min(
      ...gerarPropostas(e).map(
        (p) =>
          validarEscala({ escala: p.escala, cobertura: regras, feriados: [], empresaFuncionaFeriados: true, periodos: e.turnos, compensacaoDiaria: false })
            .alertas.filter((a) => a.regraId === 'cobertura').length,
      ),
    )
  }

  it('art. 386 no gerador: 5 mulheres não cobrem 3 aos domingos; com +1 (sugerido pelo quadro) cobrem', () => {
    const c: Cenario = { nome: '', periodos: [periodo('p', '08:00', '17:00')], cob: { p: todos(3) }, abre: '08:00', fecha: '17:00', domingo: true }
    const mulheres = ['1', '2', '3', '4', '5'].map((id) => pessoa(id, { sexo: 'F' }))
    const faltas = (ps: PessoaEscala[]) => {
      const e: EntradaGerador = {
        empresa: empresaDe(c),
        funcoes: [nominal('a', ps)],
        turnos: c.periodos,
        cobertura: c.cob,
        feriados: [],
        inicio: '2026-12-20',
        semanas: 6,
        regrasPessoais: REGRAS_PESSOAIS_PADRAO,
      }
      const regras = coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento)
      return Math.min(
        ...gerarPropostas(e).map(
          (p) =>
            validarEscala({ escala: p.escala, cobertura: regras, feriados: [], empresaFuncionaFeriados: true, periodos: e.turnos, compensacaoDiaria: false, regrasPessoais: REGRAS_PESSOAIS_PADRAO })
              .alertas.filter((a) => a.regraId === 'cobertura').length,
        ),
      )
    }
    const q = calcularQuadro({ empresa: empresaDe(c), funcoes: [nominal('a', mulheres)], turnos: c.periodos, cobertura: c.cob, custo: CUSTO_PADRAO }, 'etapa1')
    expect(q.contratar).toBe(1)
    expect(faltas(mulheres)).toBeGreaterThan(0)
    expect(faltas([...mulheres, pessoa('6', { sexo: 'M' })])).toBe(0)
  })

  for (const c of cenarios) {
    it(c.nome, () => {
      const n = calcularQuadro(
        { empresa: empresaDe(c), funcoes: funcoes(0), turnos: c.periodos, cobertura: c.cob, custo: CUSTO_PADRAO },
        'etapa1',
      ).necessarioTotal
      expect(faltasCobertura(c, n), `${n} pessoas deveriam cobrir`).toBe(0)
      if (c.periodos.length === 1) expect(faltasCobertura(c, n - 1), `${n - 1} pessoas não deveriam cobrir`).toBeGreaterThan(0)
    })
  }
})
