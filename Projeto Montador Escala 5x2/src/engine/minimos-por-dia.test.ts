import { describe, expect, it } from 'vitest'
import type { CoberturaTurno, Empresa, Funcao, Turno } from '../types'
import { validarEscala } from './conformidade'
import { calcularQuadro } from './contratacoes'
import { coberturaParaRegras, gerarEscala, gerarPropostas, perfilNecessidade, type EntradaGerador } from './gerador'
import { CUSTO_PADRAO } from './impacto'

const seisDias = [false, true, true, true, true, true, true] // seg–sáb
const empresa = (dias = seisDias): Empresa => ({
  nome: 'Loja',
  setor: 'Varejo',
  diasFuncionamento: dias,
  horaAbertura: '08:00',
  horaFechamento: '17:00',
  funcionaFeriados: true,
  acordoColetivo: 'nao',
  compensacaoDiaria: false,
})
const turnos: Turno[] = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '17:00', intervaloMin: 60 }]
const funcoes = (q: number): Funcao[] => [
  { id: 'a', nome: 'Atendente', quantidade: q, jornadaContratual: '44h', horasSemanaisAtuais: 44 },
]
const resumo = (rs: ReturnType<typeof coberturaParaRegras>) => rs.map((r) => [r.id, r.minimo, r.diasSemana])

describe('coberturaParaRegras com mínimo por dia', () => {
  it('todos os dias úteis iguais: mesma saída de antes (mesmos ids e dias)', () => {
    const sem = coberturaParaRegras({ t1: { util: 2, sab: 1, dom: 0 } }, seisDias)
    const com = coberturaParaRegras({ t1: { util: 2, sab: 1, dom: 0, porDia: { 1: 2, 3: 2, 5: 2 } } }, seisDias)
    expect(com).toEqual(sem)
    expect(resumo(sem)).toEqual([
      ['t1-util', 2, [1, 2, 3, 4, 5]],
      ['t1-sab', 1, [6]],
    ])
  })

  it('quarta = 4 e os demais 2: regras separadas que dividem os dias úteis abertos', () => {
    const rs = coberturaParaRegras({ t1: { util: 2, sab: 0, dom: 0, porDia: { 3: 4 } } }, seisDias)
    expect(resumo(rs)).toEqual([
      ['t1-util-1', 2, [1, 2, 4, 5]],
      ['t1-util-3', 4, [3]],
    ])
  })

  it('dias fechados ficam de fora (e, se o resto for igual, volta o id de antes)', () => {
    const fechadoQua = [false, true, true, false, true, true, false]
    expect(resumo(coberturaParaRegras({ t1: { util: 2, sab: 0, dom: 0, porDia: { 3: 4 } } }, fechadoQua))).toEqual([
      ['t1-util', 2, [1, 2, 4, 5]],
    ])
    const fechadoSex = [false, true, true, true, true, false, false]
    expect(resumo(coberturaParaRegras({ t1: { util: 2, sab: 0, dom: 0, porDia: { 3: 4 } } }, fechadoSex))).toEqual([
      ['t1-util-1', 2, [1, 2, 4]],
      ['t1-util-3', 4, [3]],
    ])
  })

  it('dia com mínimo 0 não gera regra', () => {
    const rs = coberturaParaRegras({ t1: { util: 2, sab: 0, dom: 0, porDia: { 1: 0 } } }, seisDias)
    expect(resumo(rs)).toEqual([['t1-util-2', 2, [2, 3, 4, 5]]])
  })

  it('mínimo por função também respeita o dia', () => {
    const fns = [{ id: 'cx', nome: 'Caixa' }]
    const rs = coberturaParaRegras(
      { t1: { util: 3, sab: 0, dom: 0, porFuncao: { cx: { util: 1, sab: 0, dom: 0, porDia: { 5: 2 } } } } },
      seisDias,
      fns,
    )
    expect(resumo(rs.filter((r) => r.funcaoId === 'cx'))).toEqual([
      ['t1-cx-util-1', 1, [1, 2, 3, 4]],
      ['t1-cx-util-5', 2, [5]],
    ])
    expect(rs.find((r) => r.id === 't1-cx-util-5')?.rotulo).toBe('Caixa')
    // Função com dias iguais mantém o id antigo.
    const igual = coberturaParaRegras(
      { t1: { util: 3, sab: 0, dom: 0, porFuncao: { cx: { util: 1, sab: 0, dom: 0, porDia: { 5: 1 } } } } },
      seisDias,
      fns,
    )
    expect(igual.filter((r) => r.funcaoId).map((r) => r.id)).toEqual(['t1-cx-util'])
  })
})

describe('perfilNecessidade com mínimo por dia', () => {
  it('cada dia útil usa o próprio mínimo', () => {
    const p = perfilNecessidade(empresa(), turnos, { t1: { util: 2, sab: 1, dom: 0, porDia: { 2: 3, 5: 4 } } }, ['a'])
    const slot10h = 40
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => p[d][slot10h])).toEqual([0, 2, 3, 2, 2, 4, 1])
  })

  it('mínimo por função por dia entra no total', () => {
    const p = perfilNecessidade(
      empresa(),
      turnos,
      { t1: { util: 1, sab: 0, dom: 0, porFuncao: { a: { util: 1, sab: 0, dom: 0, porDia: { 4: 3 } } } } },
      ['a'],
    )
    expect(p[4][40]).toBe(3)
    expect(p[3][40]).toBe(1)
  })
})

describe('gerador com mínimo por dia', () => {
  const entrada = (cob: CoberturaTurno, n = 6): EntradaGerador => ({
    empresa: empresa(),
    funcoes: funcoes(n),
    turnos,
    cobertura: { t1: cob },
    feriados: [],
    inicio: '2026-12-20',
    semanas: 4,
  })

  it('sexta com 4 e seg–qui com 2 (6 pessoas): a sexta fica coberta na melhor proposta', () => {
    const e = entrada({ util: 2, sab: 2, dom: 0, porDia: { 5: 4 } })
    const regras = coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento)
    const avaliadas = gerarPropostas(e).map((p) => {
      const alertas = validarEscala({
        escala: p.escala,
        cobertura: regras,
        feriados: [],
        empresaFuncionaFeriados: true,
        periodos: e.turnos,
        compensacaoDiaria: false,
      }).alertas.filter((a) => a.regraId === 'cobertura')
      return { p, alertas }
    })
    const melhor = avaliadas.reduce((a, b) => (b.alertas.length < a.alertas.length ? b : a))
    const sextas = melhor.alertas.filter((a) => a.data && new Date(`${a.data}T12:00:00`).getDay() === 5)
    expect(sextas).toEqual([])
    // Em toda sexta, ao menos 4 pessoas trabalham.
    const esc = melhor.p.escala
    for (let i = 0; i < esc.dias; i++) {
      const d = new Date(`${esc.inicio}T12:00:00`)
      d.setDate(d.getDate() + i)
      if (d.getDay() !== 5) continue
      const presentes = esc.funcionarios.filter((f) => esc.celulas[f.id][i].tipo === 'trabalho').length
      expect(presentes, `dia ${i}`).toBeGreaterThanOrEqual(4)
    }
  })

  it('porDia igual ao util gera exatamente a mesma escala', () => {
    for (const m of ['fixo', 'rodizio_domingo', 'folga_movel'] as const) {
      const sem = gerarEscala(entrada({ util: 2, sab: 2, dom: 0 }), m)
      const com = gerarEscala(entrada({ util: 2, sab: 2, dom: 0, porDia: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 } }), m)
      expect(com, m).toEqual(sem)
    }
  })
})

describe('quadro de contratações com mínimo por dia', () => {
  const quadro = (cob: CoberturaTurno, n: number) =>
    calcularQuadro({ empresa: empresa(), funcoes: funcoes(n), turnos, cobertura: { t1: cob }, custo: CUSTO_PADRAO }, 'etapa1')

  it('só a sexta pedindo 4 aumenta a necessidade', () => {
    const todos2 = quadro({ util: 2, sab: 2, dom: 0 }, 0)
    const sexta4 = quadro({ util: 2, sab: 2, dom: 0, porDia: { 5: 4 } }, 0)
    expect(sexta4.turnosSemana).toBe(todos2.turnosSemana + 2)
    expect(sexta4.necessarioTotal).toBeGreaterThan(todos2.necessarioTotal)
    expect(sexta4.necessarioTotal).toBeGreaterThanOrEqual(4)
  })

  it('equipe que dá conta de 2 todos os dias, mas não de 4 na sexta, precisa contratar', () => {
    const n = quadro({ util: 2, sab: 2, dom: 0 }, 0).necessarioTotal
    expect(quadro({ util: 2, sab: 2, dom: 0 }, n).contratar).toBe(0)
    expect(quadro({ util: 2, sab: 2, dom: 0, porDia: { 5: 4 } }, n).contratar).toBeGreaterThan(0)
  })

  it('porDia igual ao util: mesmo quadro', () => {
    expect(quadro({ util: 2, sab: 2, dom: 0, porDia: { 3: 2 } }, 3)).toEqual(quadro({ util: 2, sab: 2, dom: 0 }, 3))
  })
})
