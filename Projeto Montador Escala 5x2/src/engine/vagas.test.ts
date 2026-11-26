import { describe, expect, it } from 'vitest'
import type { CoberturaTurno, Empresa, Funcao, PessoaEscala, Turno } from '../types'
import { REGRAS_PESSOAIS_PADRAO } from '../config/regras'
import { analisar } from '../utils/analise'
import { criarMedidorDeFuros, ordemDeVagasDosDados } from '../utils/vagas'
import { corrigirTudo } from './autocorrecao'
import { criarFuncionarios, gerarEscala, gerarPropostas, type EntradaGerador } from './gerador'
import { minutosDe } from './datas'
import { CONTRATOS_PARCIAIS, gerarEscalaComVagas, gerarPropostasComVagas, ordemDasVagas, totalDeVagas } from './vagas'

const turnos: Turno[] = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '17:00', intervaloMin: 60 }]

function fnc(id: string, nome: string, quantidade: number, pessoas?: PessoaEscala[]): Funcao {
  return { id, nome, quantidade, jornadaContratual: '44h', horasSemanaisAtuais: 44, pessoas }
}

function entrada(funcoes: Funcao[], cob: CoberturaTurno, abreDomingo = false): EntradaGerador {
  const empresa: Empresa = {
    nome: 'Loja',
    setor: 'Varejo',
    diasFuncionamento: [abreDomingo, true, true, true, true, true, true],
    horaAbertura: '08:00',
    horaFechamento: '17:00',
    funcionaFeriados: false,
    acordoColetivo: 'nao',
    compensacaoDiaria: false,
  }
  return { empresa, funcoes, turnos, cobertura: { t1: cob }, feriados: [], inicio: '2026-12-20', semanas: 5 }
}

const dados = (e: EntradaGerador) => ({
  empresa: e.empresa,
  funcoes: e.funcoes,
  turnos: e.turnos,
  cobertura: e.cobertura,
  feriados: [],
})
/** Faltas de gente que contratar resolve (depois das correções automáticas; as com ausência não contam). */
const furosDe = (e: EntradaGerador) => criarMedidorDeFuros(dados(e))
const ordemDo = (e: EntradaGerador) =>
  ordemDeVagasDosDados({ ...dados(e), custo: { encargosPct: 0, horaExtraPct: 0 }, etapaImpacto: 'etapa1', regrasPessoais: REGRAS_PESSOAIS_PADRAO })

describe('ordemDasVagas', () => {
  const fs = [fnc('a', 'Atendente', 4), fnc('c', 'Caixa', 2), fnc('s', 'Supervisor', 1)]
  it('começa pelas vagas sugeridas (a função com mais vagas primeiro) e termina com a folga', () => {
    expect(ordemDasVagas(fs, { a: 1, c: 2 }, 2)).toEqual(['c', 'a', 'c', 'a', 'c'])
  })
  it('sem vagas sugeridas, só a folga, da maior equipe para a menor', () => {
    expect(ordemDasVagas(fs, {}, 3)).toEqual(['a', 'c', 's'])
  })
  it('sem funções, nada', () => {
    expect(ordemDasVagas([], { a: 2 })).toEqual([])
  })
})

describe('criarFuncionarios com vagas', () => {
  it('acrescenta "Vaga n — função", marcada como vaga, depois da equipe', () => {
    const l = criarFuncionarios([fnc('a', 'Atendente', 2)], { a: 2 })
    expect(l.map((f) => f.id)).toEqual(['a-1', 'a-2', 'a-vaga-1', 'a-vaga-2'])
    expect(l[2]).toEqual({ id: 'a-vaga-1', nome: 'Vaga 1 — Atendente', funcaoId: 'a', vaga: true })
    expect(l[0].vaga).toBeUndefined()
  })
  it('funciona com equipe nominal e ignora função sem vagas', () => {
    const p: PessoaEscala = { id: '7', nome: 'Ana', escalar: true, jornadaPadrao: true, menor: false, estagiario: false, ferias: [] }
    const l = criarFuncionarios([fnc('a', 'Atendente', 1, [p]), fnc('c', 'Caixa', 1)], { a: 1 })
    expect(l.map((f) => f.id)).toEqual(['a-7', 'a-vaga-1', 'c-1'])
  })
  it('sem vagas, igual a antes', () => {
    const fs = [fnc('a', 'Atendente', 3)]
    expect(criarFuncionarios(fs, {})).toEqual(criarFuncionarios(fs))
  })
})

describe('gerarEscalaComVagas', () => {
  it('equipe suficiente: nenhuma vaga e a escala é exatamente a de gerarEscala', () => {
    const e = entrada([fnc('a', 'Atendente', 6)], { util: 2, sab: 2, dom: 0 })
    for (const m of ['fixo', 'rodizio_domingo', 'folga_movel'] as const) {
      const r = gerarEscalaComVagas(e, m, ordemDo(e), furosDe(e))
      expect(r.contratacoes).toEqual([])
      expect(r.escala).toEqual(gerarEscala(e, m))
      expect(r.escala.funcionarios.some((f) => f.vaga)).toBe(false)
    }
  })

  it('equipe curta: acrescenta vagas escaladas e zera as faltas de cobertura nos 3 modelos', () => {
    const e = entrada([fnc('a', 'Atendente', 2)], { util: 3, sab: 3, dom: 0 })
    const props = gerarPropostasComVagas(e, ordemDo(e), furosDe(e))
    expect(props).toHaveLength(3)
    for (const p of props) {
      const n = totalDeVagas(p.contratacoes)
      expect(n).toBeGreaterThan(0)
      const vagas = p.escala.funcionarios.filter((f) => f.vaga)
      expect(vagas).toHaveLength(n)
      expect(p.contratacoes).toEqual([{ funcaoId: 'a', nome: 'Atendente', quantidade: n }])
      expect(furosDe(e)(p.escala)).toBe(0)
      // cada vaga tem escala própria: trabalha, folga e tem DSR
      for (const v of vagas) {
        const tipos = p.escala.celulas[v.id].map((c) => c.tipo)
        expect(tipos.filter((t) => t === 'trabalho').length).toBeGreaterThan(0)
        expect(tipos.some((t) => t === 'dsr' || t === 'folga')).toBe(true)
      }
      // e a equipe atual segue com os mesmos funcionários
      expect(p.escala.funcionarios.filter((f) => !f.vaga).map((f) => f.id)).toEqual(['a-1', 'a-2'])
    }
  })

  it('é o mínimo: uma vaga a menos deixa falta de cobertura', () => {
    const e = entrada([fnc('a', 'Atendente', 2)], { util: 3, sab: 3, dom: 0 })
    for (const p of gerarPropostasComVagas(e, ordemDo(e), furosDe(e))) {
      const n = totalDeVagas(p.contratacoes)
      expect(furosDe(e)(gerarEscala({ ...e, vagas: n > 1 ? { a: n - 1 } : undefined }, p.modelo))).toBeGreaterThan(0)
    }
  })

  it('as vagas respeitam a legislação (nenhuma delas gera alerta vermelho de jornada/repouso)', () => {
    const e = entrada([fnc('a', 'Atendente', 2)], { util: 3, sab: 3, dom: 0 })
    for (const p of gerarPropostasComVagas(e, ordemDo(e), furosDe(e))) {
      const vagaIds = new Set(p.escala.funcionarios.filter((f) => f.vaga).map((f) => f.id))
      const corrigida = corrigirTudo(p.escala, (x) => analisar(dados(e), x)).escala
      const ruins = analisar(dados(e), corrigida).alertas.filter(
        (a) => a.severidade === 'vermelho' && a.funcionarioId && vagaIds.has(a.funcionarioId),
      )
      expect(ruins).toEqual([])
    }
  })

  it('distribui as vagas entre funções com mínimo próprio', () => {
    const cob: CoberturaTurno = { util: 3, sab: 3, dom: 0, porFuncao: { c: { util: 2, sab: 2, dom: 0 } } }
    const e = entrada([fnc('a', 'Atendente', 2), fnc('c', 'Caixa', 1)], cob)
    const props = gerarPropostasComVagas(e, ordemDo(e), furosDe(e))
    for (const p of props) {
      expect(furosDe(e)(p.escala)).toBe(0)
      expect((p.contratacoes ?? []).some((c) => c.funcaoId === 'c')).toBe(true)
    }
  })

  it('falta de gente só por férias não vira contratação', () => {
    const ferias: PessoaEscala = {
      id: '1', nome: 'Ana', escalar: true, jornadaPadrao: true, menor: false, estagiario: false,
      ferias: [{ inicio: '2026-12-21', fim: '2026-12-27' }],
    }
    const outros: PessoaEscala[] = [2, 3, 4].map((i) => ({
      id: String(i), nome: `P${i}`, escalar: true, jornadaPadrao: true, menor: false, estagiario: false, ferias: [],
    }))
    const e = entrada([fnc('a', 'Atendente', 4, [ferias, ...outros])], { util: 3, sab: 3, dom: 0 })
    for (const m of ['fixo', 'rodizio_domingo', 'folga_movel'] as const) {
      const r = gerarEscalaComVagas(e, m, ordemDo(e), furosDe(e))
      expect(r.contratacoes).toEqual([])
    }
  })

  it('não passa da ordem dada: com poucas vagas possíveis, fica com a que deixou menos faltas', () => {
    const e = entrada([fnc('a', 'Atendente', 1)], { util: 5, sab: 5, dom: 0 })
    const r = gerarEscalaComVagas(e, 'fixo', ['a'], furosDe(e))
    expect(totalDeVagas(r.contratacoes)).toBeLessThanOrEqual(1)
  })

  it('o modelo gerarPropostas continua igual (sem vagas)', () => {
    const e = entrada([fnc('a', 'Atendente', 2)], { util: 3, sab: 3, dom: 0 })
    expect(gerarPropostas(e).every((p) => p.contratacoes === undefined && !p.escala.funcionarios.some((f) => f.vaga))).toBe(true)
  })
})

describe('vaga em tempo parcial', () => {
  // 1 pessoa o dia todo e 2 no pico do meio do dia (11h–15h): falta "meia pessoa", não uma inteira.
  const periodos: Turno[] = [
    { id: 't1', nome: 'Dia', inicio: '08:00', fim: '17:24', intervaloMin: 0 },
    { id: 't2', nome: 'Pico', inicio: '11:00', fim: '15:00', intervaloMin: 0 },
  ]
  const e: EntradaGerador = {
    ...entrada([fnc('a', 'Atendente', 2)], { util: 1, sab: 1, dom: 0 }),
    turnos: periodos,
    cobertura: { t1: { util: 1, sab: 1, dom: 0 }, t2: { util: 2, sab: 1, dom: 0 } },
  }
  const ordem = ordemDasVagas(e.funcoes, { a: 1 }, 2)

  it('sem permitir parcial, a vaga é em tempo integral', () => {
    for (const p of gerarPropostasComVagas(e, ordem, furosDe(e))) {
      expect(p.contratacoes?.every((c) => !c.parciais)).toBe(true)
      expect(p.escala.funcionarios.filter((f) => f.vaga).every((f) => f.horasSemanais === undefined)).toBe(true)
    }
  })

  it('permitindo parcial, usa a vaga de menos horas quando ela basta e cobre tudo', () => {
    const props = gerarPropostasComVagas(e, ordem, furosDe(e), CONTRATOS_PARCIAIS)
    const comParcial = props.filter((p) => p.contratacoes?.some((c) => c.parciais?.length))
    expect(comParcial.length).toBeGreaterThan(0)
    for (const p of comParcial) {
      expect(furosDe(e)(p.escala)).toBe(0)
      const v = p.escala.funcionarios.find((f) => f.horasSemanais)!
      expect(v.nome).toMatch(/tempo parcial/)
      expect(CONTRATOS_PARCIAIS.map((c) => c.horas)).toContain(v.horasSemanais)
      // jornada menor que a cheia, trabalhando 5 dias por semana
      const turnos = new Map(p.escala.turnos.map((t) => [t.id, t]))
      const horas = p.escala.celulas[v.id]
        .filter((c) => c.tipo === 'trabalho')
        .map((c) => {
          const t = turnos.get(c.turnoId!)!
          return (minutosDe(t.fim) - minutosDe(t.inicio) + 1440) % 1440 - t.intervaloMin
        })
      expect(Math.max(...horas)).toBeLessThanOrEqual((v.horasSemanais! * 60) / (v.diasSemana ?? 5))
    }
  })

  it('não troca por parcial quando só uma vaga inteira resolve', () => {
    const e2 = entrada([fnc('a', 'Atendente', 2)], { util: 3, sab: 3, dom: 0 })
    for (const p of gerarPropostasComVagas(e2, ordemDo(e2), furosDe(e2), CONTRATOS_PARCIAIS)) {
      expect(furosDe(e2)(p.escala)).toBe(0)
    }
  })
})
